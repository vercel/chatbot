import { generateText, type ModelMessage } from 'ai';
import { prepareStepModel } from '@/lib/ai/providers';
import { WORKING_MEMORY_PREFIX, buildWorkingMemoryMessage } from '@/lib/ai/working-memory';
import { updateWorkingMemory } from '@/lib/ai/tools/working-memory';

const MODEL_CONTEXT_WINDOW = 200_000; // claude-sonnet-4-6
const COMPACT_THRESHOLD_PCT = 0.75;
const KEEP_RECENT = 8;                // keep last N messages after compaction

const SUMMARY_PREFIX = '[Session summary — earlier context compacted]';

const COMPACTION_SYSTEM_PROMPT =
  'You are creating a session handoff document for a benefits form-filling agent. ' +
  'Participant field-value data is preserved separately in working memory — ' +
  'do NOT list individual participant field values in the summary.\n\n' +
  'Extract and preserve the following from the transcript:\n' +
  '- SESSION STATE: The current form name, URL, and which page/step we are on.\n' +
  '- COMPLETED FIELDS: Every field that has already been filled and its value.\n' +
  '- PENDING FIELDS: Every field still needing input.\n' +
  '- CASEWORKER INPUTS: Every answer or correction the caseworker provided.\n' +
  '- GAP ANALYSIS: Every field that has been identified as a gap and the reason why.\n' +
  '- GAP ANSWERS: Every answer or correction the caseworker provided to a gap analysis.\n' +
  '- KEY DECISIONS: Any decisions or clarifications made during the session.\n\n' +
  'CRITICAL RULES:\n' +
  '- Do NOT invent, infer, or fabricate any data that is not explicitly present in the transcript.\n' +
  '- If a field value appears truncated or unclear, write [UNKNOWN] rather than guessing.\n' +
  '- Do NOT include participant PII (names, DOB, SSN, address) — it is in working memory.\n' +
  'Do NOT include browser snapshot content or raw HTML.';

const log = (...args: unknown[]) => console.log('[compressor]', ...args);

/**
 * Detect and extract a working memory message from the beginning of the
 * message list. The working memory message is always the first message and
 * starts with WORKING_MEMORY_PREFIX. It must be excluded from compaction
 * so the model always has ground-truth participant data.
 */
function extractWorkingMemory(messages: ModelMessage[]): {
  wmMessage: ModelMessage | null;
  rest: ModelMessage[];
} {
  if (
    messages.length > 0 &&
    typeof messages[0].content === 'string' &&
    messages[0].content.startsWith(WORKING_MEMORY_PREFIX)
  ) {
    return { wmMessage: messages[0], rest: messages.slice(1) };
  }
  return { wmMessage: null, rest: messages };
}

/**
 * Flatten a ModelMessage into a plain-text line for the transcript.
 * Strips browser snapshots/screenshots to keep the transcript manageable.
 */
function flattenMessage(msg: ModelMessage): string {
  const role = msg.role.toUpperCase();
  if (typeof msg.content === 'string') return `[${role}]: ${msg.content}`;
  if (!Array.isArray(msg.content)) return `[${role}]: ${JSON.stringify(msg.content)}`;

  const parts = (msg.content as any[]).map((part) => {
    if (!part) return '';
    // Prune browser snapshots/screenshots — they're huge and useless in summaries
    if (part.type === 'tool-result' && part.toolName === 'browser') {
      const r = part.result;
      if (r?.snapshot || r?.accessibility_tree || r?.screenshot) return '[browser output: pruned]';
    }
    const s = typeof part === 'string' ? part : (part.text ?? JSON.stringify(part) ?? '');
    return String(s);
  });
  return `[${role}]: ${parts.join('\n')}`;
}

/**
 * Estimate token count from messages using a rough chars-per-token heuristic.
 * Claude averages ~3.5-4 chars per token; we use 3.5 to be conservative.
 * Skips browser snapshots (same as flattenMessage) to avoid massive JSON.stringify allocations.
 */
function estimateTokens(messages: ModelMessage[]): number {
  let totalChars = 0;
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      totalChars += msg.content.length;
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content as any[]) {
        if (!part) continue;
        // Skip browser snapshots — same pruning as flattenMessage
        if (part.type === 'tool-result' && part.toolName === 'browser') {
          const r = part.result;
          if (r?.snapshot || r?.accessibility_tree || r?.screenshot) {
            totalChars += 50; // fixed budget for pruned output
            continue;
          }
        }
        if (typeof part === 'string') {
          totalChars += part.length;
        } else {
          totalChars += (part.text?.length ?? JSON.stringify(part)?.length ?? 0);
        }
      }
    }
  }
  return Math.ceil(totalChars / 3.5);
}

/**
 * Shared summarization: split messages into old + recent, then run two
 * parallel Haiku calls on the same transcript:
 *   1. Compaction summary (session state, actions, decisions)
 *   2. Working memory extraction (structured participant data via tool call)
 *
 * Returns null on failure (caller should fall back to original messages).
 */
async function summarizeMessages(
  messages: ModelMessage[],
  logPrefix: string,
  onCompacting?: () => void,
): Promise<{
  summary: string;
  workingMemory: Record<string, unknown> | null;
  recentMessages: ModelMessage[];
  splitAt: number;
} | null> {
  if (messages.length <= KEEP_RECENT) {
    log(`${logPrefix}over threshold but only ${messages.length} msgs (≤ ${KEEP_RECENT}), skipping`);
    return null;
  }

  const splitAt = messages.length - KEEP_RECENT;
  const oldMessages = messages.slice(0, splitAt);
  const recentMessages = messages.slice(splitAt);

  log(
    `${logPrefix}COMPACTING — summarizing ${oldMessages.length} old msgs, ` +
    `keeping ${recentMessages.length} recent`
  );

  const transcript = oldMessages.map(flattenMessage).join('\n\n');
  log(`${logPrefix}transcript length: ${transcript.length} chars from ${oldMessages.length} msgs`);

  onCompacting?.();

  const t0 = Date.now();

  // Run compaction summary and working memory extraction in parallel on Haiku
  const [compactionResult, wmResult] = await Promise.all([
    // 1. Compaction summary
    generateText({
      model: prepareStepModel,
      maxOutputTokens: 4096,
      system: COMPACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Summarize this session transcript:\n\n${transcript}` }],
    }).catch((err) => {
      log(`${logPrefix}compaction ERROR:`, err);
      return null;
    }),

    // 2. Working memory extraction via tool call
    generateText({
      model: prepareStepModel,
      maxOutputTokens: 4096,
      tools: { updateWorkingMemory },
      toolChoice: { type: 'tool', toolName: 'updateWorkingMemory' },
      system:
        'Extract all participant data from this transcript. ' +
        'Include data from database records and caseworker answers. ' +
        'Only include data explicitly present — never fabricate.',
      messages: [{ role: 'user', content: transcript }],
    }).catch((err) => {
      log(`${logPrefix}working memory ERROR:`, err);
      return null;
    }),
  ]);

  const elapsed = Date.now() - t0;

  // Process compaction result
  const summary = compactionResult?.text?.trim();
  if (!summary) {
    log(`${logPrefix}ABORT — empty or failed compaction summary`);
    return null;
  }
  log(`${logPrefix}compaction done in ${elapsed}ms — summary: ${summary.length} chars`);

  // Process working memory result
  let workingMemory: Record<string, unknown> | null = null;
  if (wmResult?.toolResults?.length) {
    workingMemory = wmResult.toolResults[0].output as Record<string, unknown>;
    log(`${logPrefix}working memory extracted — ${Object.keys(workingMemory).length} keys`);
  } else {
    log(`${logPrefix}working memory extraction failed or empty — continuing without`);
  }

  return { summary, workingMemory, recentMessages, splitAt };
}

function buildSummaryMessage(summary: string): ModelMessage {
  return { role: 'assistant', content: `${SUMMARY_PREFIX}\n\n${summary}` };
}

/**
 * Pre-compact messages loaded from the database before passing to streamText.
 *
 * When a previous request compacted messages mid-stream, the raw messages
 * still get saved to the DB. On the next request, loading them all would
 * exceed the context window. This function runs the same summarization
 * up-front so the initial streamText call stays within limits.
 */
export async function preCompactMessages(
  messages: ModelMessage[],
  onCompacting?: () => void,
): Promise<{ messages: ModelMessage[]; compacted: boolean; summary?: string }> {
  // Extract any existing working memory — it must never be compacted
  const { wmMessage, rest } = extractWorkingMemory(messages);

  const estimatedTokens = estimateTokens(rest);
  const usedPct = estimatedTokens / MODEL_CONTEXT_WINDOW;

  log(
    `pre-compact check — ${rest.length} msgs (${wmMessage ? '+WM' : 'no WM'}), ` +
    `~${estimatedTokens} estimated tokens, ` +
    `${(usedPct * 100).toFixed(1)}% of ${MODEL_CONTEXT_WINDOW} context window`
  );

  if (usedPct < COMPACT_THRESHOLD_PCT) {
    return { messages, compacted: false };
  }

  const result = await summarizeMessages(rest, 'pre-compact: ', onCompacting);
  if (!result) {
    return { messages, compacted: false };
  }

  const summaryMessage = buildSummaryMessage(result.summary);
  // Use freshly extracted working memory, or fall back to existing one
  const effectiveWm = result.workingMemory
    ? buildWorkingMemoryMessage(result.workingMemory)
    : wmMessage;
  log(`pre-compact done — returning ${1 + result.recentMessages.length} msgs${effectiveWm ? ' +WM' : ''}`);
  const compactedMessages = effectiveWm
    ? [effectiveWm, summaryMessage, ...result.recentMessages]
    : [summaryMessage, ...result.recentMessages];
  return {
    messages: compactedMessages,
    compacted: true,
    summary: result.summary,
  };
}

/**
 * Returns a stateful compression function for a single streamText request.
 *
 * IMPORTANT: The AI SDK's prepareStep does NOT persist message overrides
 * between steps (see https://github.com/vercel/ai/issues/9631). Each call
 * to prepareStep receives [...initialMessages, ...allResponseMessages],
 * ignoring any prior compaction.
 *
 * Workaround: we store the compaction state (summary message + count of
 * original messages that were summarized) and re-apply it on every
 * subsequent prepareStep call.
 */
export function createMessageCompressor() {
  let justCompacted = false;

  // Persisted compaction state — survives across prepareStep calls
  let storedSummaryMessage: ModelMessage | null = null;
  let storedWmMessage: ModelMessage | null = null;
  let summarizedCount = 0; // how many original messages were folded into the summary

  return async function compress(
    stepMessages: ModelMessage[],
    lastInputTokens: number | undefined,
    onCompacting?: () => void,
  ): Promise<{ messages: ModelMessage[]; compacted: boolean; summary?: string }> {

    // --- Extract working memory — never compact it ---
    const { wmMessage: incomingWm, rest: rawMessages } = extractWorkingMemory(stepMessages);
    let wm = storedWmMessage ?? incomingWm;

    // --- Re-apply prior compaction ---
    let effectiveMessages = rawMessages;
    if (storedSummaryMessage && summarizedCount > 0) {
      const newMessages = rawMessages.slice(summarizedCount);
      effectiveMessages = [storedSummaryMessage, ...newMessages];
      log(
        `re-applied prior compaction — stripped ${summarizedCount} original msgs, ` +
        `${effectiveMessages.length} effective msgs (1 summary + ${newMessages.length} new)`
      );
    }

    const prepend = (msgs: ModelMessage[]) =>
      wm ? [wm, ...msgs] : msgs;

    const usedPct = (lastInputTokens ?? 0) / MODEL_CONTEXT_WINDOW;

    if (justCompacted) {
      justCompacted = false;
      log(
        `skip — stale inputTokens after compaction, ` +
        `${effectiveMessages.length} msgs, ${(usedPct * 100).toFixed(1)}% (stale)`
      );
      return { messages: prepend(effectiveMessages), compacted: false };
    }

    log(
      `step check — ${effectiveMessages.length} msgs (raw ${stepMessages.length}${wm ? ', +WM' : ''}), ` +
      `inputTokens=${lastInputTokens ?? 'n/a'}, ` +
      `${(usedPct * 100).toFixed(1)}% of ${MODEL_CONTEXT_WINDOW} context window, ` +
      `threshold=${(COMPACT_THRESHOLD_PCT * 100).toFixed(0)}%`
    );

    if (usedPct < COMPACT_THRESHOLD_PCT) {
      return { messages: prepend(effectiveMessages), compacted: false };
    }

    const result = await summarizeMessages(effectiveMessages, '', onCompacting);
    if (!result) {
      justCompacted = true;
      return { messages: prepend(effectiveMessages), compacted: false };
    }

    const newSummaryMessage = buildSummaryMessage(result.summary);

    storedSummaryMessage = newSummaryMessage;
    if (result.workingMemory) {
      storedWmMessage = buildWorkingMemoryMessage(result.workingMemory);
      wm = storedWmMessage;
    }
    if (summarizedCount === 0) {
      summarizedCount = result.splitAt;
    } else {
      summarizedCount += result.splitAt - 1;
    }

    log(
      `compaction persisted — summarizedCount=${summarizedCount}, ` +
      `returning ${1 + result.recentMessages.length} msgs${wm ? ' +WM' : ''}`
    );

    justCompacted = true;
    return { messages: prepend([newSummaryMessage, ...result.recentMessages]), compacted: true, summary: result.summary };
  };
}

import { generateText, type ModelMessage } from 'ai';
import { prepareStepModel } from '@/lib/ai/providers';

const MODEL_CONTEXT_WINDOW = 200_000; // claude-sonnet-4-6
const COMPACT_THRESHOLD_PCT = 0.75;
const KEEP_RECENT = 8;                // keep last N messages after compaction

const SUMMARY_PREFIX = '[Session summary — earlier context compacted]';

const COMPACTION_SYSTEM_PROMPT =
  'You are creating a session handoff document for a benefits form-filling agent. ' +
  'Extract and preserve ALL of the following — be explicit and complete:\n' +
  '- PARTICIPANT DATA: Every field-value pair from the database (Apricot record) and caseworker. Format as "Field: Value" lines.\n' +
  '- SESSION STATE: The current form name, URL, and which page/step we are on.\n' +
  '- COMPLETED FIELDS: Every field that has already been filled and its value.\n' +
  '- PENDING FIELDS: Every field still needing input.\n' +
  '- CASEWORKER INPUTS: Every answer or correction the caseworker provided.\n' +
  '- GAP ANALYSIS: Every field that has been identified as a gap and the reason why.\n' +
  '- GAP ANSWERS: Every answer or correction the caseworker provided to a gap analysis.\n' +
  'Do NOT summarize participant data — list every field and value explicitly. ' +
  'Do NOT include browser snapshot content or raw HTML.';

const log = (...args: unknown[]) => console.log('[compressor]', ...args);

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
    // Everything else: just stringify and truncate
    const s = typeof part === 'string' ? part : (part.text ?? JSON.stringify(part) ?? '');
    return String(s).slice(0, 500);
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
 * Shared summarization: split messages into old + recent, summarize old via Sonnet.
 * Returns null on failure (caller should fall back to original messages).
 */
async function summarizeMessages(
  messages: ModelMessage[],
  logPrefix: string,
  onCompacting?: () => void,
): Promise<{ summary: string; recentMessages: ModelMessage[]; splitAt: number } | null> {
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
  let summary: string;
  try {
    const result = await generateText({
      model: prepareStepModel,
      maxOutputTokens: 4096,
      system: COMPACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Summarize this session transcript:\n\n${transcript}` }],
    });
    summary = result.text;
    log(`${logPrefix}Sonnet finishReason: ${result.finishReason}`);
  } catch (err) {
    log(`${logPrefix}Sonnet ERROR:`, err);
    return null;
  }
  const elapsed = Date.now() - t0;
  log(`${logPrefix}summary done in ${elapsed}ms — summary length: ${summary.length} chars`);

  if (!summary.trim()) {
    log(`${logPrefix}ABORT — empty summary`);
    return null;
  }

  return { summary, recentMessages, splitAt };
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
  const estimatedTokens = estimateTokens(messages);
  const usedPct = estimatedTokens / MODEL_CONTEXT_WINDOW;

  log(
    `pre-compact check — ${messages.length} msgs, ` +
    `~${estimatedTokens} estimated tokens, ` +
    `${(usedPct * 100).toFixed(1)}% of ${MODEL_CONTEXT_WINDOW} context window`
  );

  if (usedPct < COMPACT_THRESHOLD_PCT) {
    return { messages, compacted: false };
  }

  const result = await summarizeMessages(messages, 'pre-compact: ', onCompacting);
  if (!result) {
    return { messages, compacted: false };
  }

  const summaryMessage = buildSummaryMessage(result.summary);
  log(`pre-compact done — returning ${1 + result.recentMessages.length} msgs`);
  return {
    messages: [summaryMessage, ...result.recentMessages],
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
  let summarizedCount = 0; // how many original messages were folded into the summary

  return async function compress(
    stepMessages: ModelMessage[],
    lastInputTokens: number | undefined,
    onCompacting?: () => void,
  ): Promise<{ messages: ModelMessage[]; compacted: boolean; summary?: string }> {

    // --- Re-apply prior compaction ---
    // The SDK gives us the full original messages every time. If we've
    // already compacted, strip the summarized prefix and prepend our summary.
    let effectiveMessages = stepMessages;
    if (storedSummaryMessage && summarizedCount > 0) {
      const newMessages = stepMessages.slice(summarizedCount);
      effectiveMessages = [storedSummaryMessage, ...newMessages];
      log(
        `re-applied prior compaction — stripped ${summarizedCount} original msgs, ` +
        `${effectiveMessages.length} effective msgs (1 summary + ${newMessages.length} new)`
      );
    }

    const usedPct = (lastInputTokens ?? 0) / MODEL_CONTEXT_WINDOW;

    // After compaction the next step's inputTokens is stale (measured before
    // we replaced messages). Skip one threshold check so the model sees
    // compacted context and reports accurate usage.
    if (justCompacted) {
      justCompacted = false;
      log(
        `skip — stale inputTokens after compaction, ` +
        `${effectiveMessages.length} msgs, ${(usedPct * 100).toFixed(1)}% (stale)`
      );
      return { messages: effectiveMessages, compacted: false };
    }

    log(
      `step check — ${effectiveMessages.length} msgs (raw ${stepMessages.length}), ` +
      `inputTokens=${lastInputTokens ?? 'n/a'}, ` +
      `${(usedPct * 100).toFixed(1)}% of ${MODEL_CONTEXT_WINDOW} context window, ` +
      `threshold=${(COMPACT_THRESHOLD_PCT * 100).toFixed(0)}%`
    );

    if (usedPct < COMPACT_THRESHOLD_PCT) {
      return { messages: effectiveMessages, compacted: false };
    }

    const result = await summarizeMessages(effectiveMessages, '', onCompacting);
    if (!result) {
      justCompacted = true; // skip next stale check
      return { messages: effectiveMessages, compacted: false };
    }

    const newSummaryMessage = buildSummaryMessage(result.summary);

    // Persist compaction state so we can re-apply on next prepareStep call.
    // summarizedCount tracks how many of the SDK's original messages are now
    // folded into our summary.
    storedSummaryMessage = newSummaryMessage;
    if (summarizedCount === 0) {
      // First compaction: splitAt messages from the raw stepMessages
      summarizedCount = result.splitAt;
    } else {
      // Re-compaction: the old portion of effectiveMessages had
      // (splitAt) entries. The first one was our prior summary (not an
      // original message), the rest are (splitAt - 1) originals that
      // accumulated after the last compaction boundary.
      summarizedCount += result.splitAt - 1;
    }

    log(
      `compaction persisted — summarizedCount=${summarizedCount}, ` +
      `returning ${1 + result.recentMessages.length} msgs`
    );

    justCompacted = true;
    return { messages: [newSummaryMessage, ...result.recentMessages], compacted: true, summary: result.summary };
  };
}

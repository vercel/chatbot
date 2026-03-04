import { generateText, type ModelMessage } from 'ai';
import { prepareStepModel } from '@/lib/ai/providers';

const MODEL_CONTEXT_WINDOW = 200_000; // claude-sonnet-4-6
const COMPACT_THRESHOLD_PCT = 0.75;   // 30% for testing (production: 0.75)
const KEEP_RECENT = 8;                // keep last N messages after compaction

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
  let summaryMessage: ModelMessage | null = null;
  let summarizedCount = 0; // how many original messages were folded into the summary
  let lastSummaryText: string | undefined;

  return async function compress(
    stepMessages: ModelMessage[],
    lastInputTokens: number | undefined,
    onCompacting?: () => void,
  ): Promise<{ messages: ModelMessage[]; compacted: boolean; summary?: string }> {

    // --- Re-apply prior compaction ---
    // The SDK gives us the full original messages every time. If we've
    // already compacted, strip the summarized prefix and prepend our summary.
    let effectiveMessages = stepMessages;
    if (summaryMessage && summarizedCount > 0) {
      const newMessages = stepMessages.slice(summarizedCount);
      effectiveMessages = [summaryMessage, ...newMessages];
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

    // Not enough messages to split meaningfully
    if (effectiveMessages.length <= KEEP_RECENT) {
      log(`over threshold but only ${effectiveMessages.length} msgs (≤ ${KEEP_RECENT}), skipping`);
      return { messages: effectiveMessages, compacted: false };
    }

    const splitAt = effectiveMessages.length - KEEP_RECENT;
    const oldMessages = effectiveMessages.slice(0, splitAt);
    const recentMessages = effectiveMessages.slice(splitAt);

    log(
      `COMPACTING — summarizing ${oldMessages.length} old msgs, keeping ${recentMessages.length} recent`
    );

    const transcript = oldMessages.map(flattenMessage).join('\n\n');
    log(`transcript length: ${transcript.length} chars from ${oldMessages.length} msgs`);

    // Notify the caller that compaction is starting (for UI feedback)
    onCompacting?.();

    const t0 = Date.now();
    let summary: string;
    try {
      const result = await generateText({
        model: prepareStepModel,
        maxOutputTokens: 4096,
        system:
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
          'Do NOT include browser snapshot content or raw HTML.',
        messages: [{ role: 'user', content: `Summarize this session transcript:\n\n${transcript}` }],
      });
      summary = result.text;
      log(`Sonnet finishReason: ${result.finishReason}`);
    } catch (err) {
      log(`Sonnet ERROR:`, err);
      justCompacted = true; // skip next stale check
      return { messages: effectiveMessages, compacted: false };
    }
    const elapsed = Date.now() - t0;

    log(`Sonnet summary done in ${elapsed}ms — summary length: ${summary.length} chars`);

    if (!summary.trim()) {
      log('ABORT — Sonnet returned empty summary, keeping original messages');
      justCompacted = true; // don't re-trigger immediately
      return { messages: effectiveMessages, compacted: false };
    }

    // Build the new summary message
    const newSummaryMessage: ModelMessage = {
      role: 'assistant',
      content: `[Session summary — earlier context compacted]\n\n${summary}`,
    };

    // Persist compaction state so we can re-apply on next prepareStep call.
    // summarizedCount tracks how many of the SDK's original messages are now
    // folded into our summary. When we compact for the first time, that's
    // splitAt messages from stepMessages. On re-compaction, we're compacting
    // messages that include our prior summary — the original prefix stays
    // summarized, plus some new messages that have accumulated.
    summaryMessage = newSummaryMessage;
    // The original messages that are now summarized = previously summarized
    // + any new originals that were in the old portion (excluding the prior
    // summary message itself which was at index 0 of effectiveMessages).
    if (summarizedCount === 0) {
      // First compaction: splitAt messages from the raw stepMessages
      summarizedCount = splitAt;
    } else {
      // Re-compaction: the old portion of effectiveMessages had
      // (splitAt) entries. The first one was our prior summary (not an
      // original message), the rest are (splitAt - 1) originals that
      // accumulated after the last compaction boundary.
      summarizedCount += splitAt - 1;
    }
    lastSummaryText = summary;

    log(
      `compaction persisted — summarizedCount=${summarizedCount}, ` +
      `returning ${1 + recentMessages.length} msgs`
    );

    justCompacted = true;
    return { messages: [newSummaryMessage, ...recentMessages], compacted: true, summary };
  };
}

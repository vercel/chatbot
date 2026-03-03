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
    if (part.type === 'text') return part.text;
    if (part.type === 'tool-call')
      return `[Tool call: ${part.toolName}(${JSON.stringify(part.args ?? {}).slice(0, 200)})]`;
    if (part.type === 'tool-result') {
      if (part.toolName === 'browser') {
        const r = part.result as Record<string, unknown>;
        if (r?.snapshot || r?.accessibility_tree) return '[browser snapshot: pruned]';
        if (r?.screenshot) return '[browser screenshot: pruned]';
        return `[browser ${(r as any)?.action ?? 'action'} completed]`;
      }
      const text = typeof part.result === 'string' ? part.result : JSON.stringify(part.result);
      return `[Tool result (${part.toolName}): ${text.slice(0, 500)}]`;
    }
    return JSON.stringify(part).slice(0, 200);
  });
  return `[${role}]: ${parts.join('\n')}`;
}

/**
 * Returns a stateful compression function for a single streamText request.
 *
 * State: just one flag (`justCompacted`) to skip the stale-inputTokens step
 * immediately after compaction. Everything else is derived from the args.
 */
export function createMessageCompressor() {
  let justCompacted = false;

  return async function compress(
    stepMessages: ModelMessage[],
    lastInputTokens: number | undefined,
  ): Promise<{ messages: ModelMessage[]; compacted: boolean }> {
    const usedPct = (lastInputTokens ?? 0) / MODEL_CONTEXT_WINDOW;

    // After compaction the next step's inputTokens is stale (measured before
    // we replaced messages). Skip one check so the model sees compacted
    // context and reports accurate usage.
    if (justCompacted) {
      justCompacted = false;
      log(
        `skip — stale inputTokens after compaction, ` +
        `${stepMessages.length} msgs, ${(usedPct * 100).toFixed(1)}% (stale)`
      );
      return { messages: stepMessages, compacted: false };
    }

    log(
      `step check — ${stepMessages.length} msgs, ` +
      `inputTokens=${lastInputTokens ?? 'n/a'}, ` +
      `${(usedPct * 100).toFixed(1)}% of ${MODEL_CONTEXT_WINDOW} context window, ` +
      `threshold=${(COMPACT_THRESHOLD_PCT * 100).toFixed(0)}%`
    );

    if (usedPct < COMPACT_THRESHOLD_PCT) {
      return { messages: stepMessages, compacted: false };
    }

    // Not enough messages to split meaningfully
    if (stepMessages.length <= KEEP_RECENT) {
      log(`over threshold but only ${stepMessages.length} msgs (≤ ${KEEP_RECENT}), skipping`);
      return { messages: stepMessages, compacted: false };
    }

    const splitAt = stepMessages.length - KEEP_RECENT;
    const oldMessages = stepMessages.slice(0, splitAt);
    const recentMessages = stepMessages.slice(splitAt);

    log(
      `COMPACTING — summarizing ${oldMessages.length} old msgs, keeping ${recentMessages.length} recent`
    );

    const transcript = oldMessages.map(flattenMessage).join('\n\n');
    log(`transcript length: ${transcript.length} chars from ${oldMessages.length} msgs`);

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
      return { messages: stepMessages, compacted: false };
    }
    const elapsed = Date.now() - t0;

    log(`Sonnet summary done in ${elapsed}ms — summary length: ${summary.length} chars`);

    if (!summary.trim()) {
      log('ABORT — Sonnet returned empty summary, keeping original messages');
      justCompacted = true; // don't re-trigger immediately
      return { messages: stepMessages, compacted: false };
    }

    const summaryMessage: ModelMessage = {
      role: 'assistant',
      content: `[Session summary — earlier context compacted]\n\n${summary}`,
    };

    justCompacted = true;
    return { messages: [summaryMessage, ...recentMessages], compacted: true };
  };
}

import { generateText, type ModelMessage } from 'ai';
import { prepareStepModel } from '@/lib/ai/providers';

const MODEL_CONTEXT_WINDOW = 200_000; // claude-sonnet-4-6
const COMPACT_THRESHOLD_PCT = 0.10;   // 10% for testing (production: 0.75)
const KEEP_RECENT = 8;                // keep last N messages after compaction

/**
 * Returns a stateful compression function whose cache persists across all
 * prepareStep invocations for a single request.
 */
export function createMessageCompressor() {
  let compressedCache: ModelMessage[] | null = null;
  let lastFullLength = 0;

  return async function compress(
    stepMessages: ModelMessage[],
    lastInputTokens: number | undefined,
  ): Promise<{ messages: ModelMessage[]; compacted: boolean }> {
    // Cache hit — same message count, no new data
    if (compressedCache && stepMessages.length === lastFullLength) {
      return { messages: compressedCache, compacted: false };
    }

    const usedPct = (lastInputTokens ?? 0) / MODEL_CONTEXT_WINDOW;

    if (usedPct < COMPACT_THRESHOLD_PCT) {
      // Under 75% — pass through, no compression
      lastFullLength = stepMessages.length;
      return { messages: stepMessages, compacted: false };
    }

    // 75%+ — full summarization via Gemini
    if (stepMessages.length <= KEEP_RECENT) {
      lastFullLength = stepMessages.length;
      return { messages: stepMessages, compacted: false };
    }

    const splitAt = stepMessages.length - KEEP_RECENT;
    const oldMessages = stepMessages.slice(0, splitAt);
    const recentMessages = stepMessages.slice(splitAt);

    // Strip browser snapshots/screenshots before summarizing —
    // keep Apricot records, gap analysis results, and caseworker responses intact
    const messagesForSummarizer = oldMessages.map((msg) => {
      if (msg.role !== 'tool') return msg;
      return {
        ...msg,
        content: (msg.content as any[]).map((part) => {
          if (part.type !== 'tool-result') return part;
          if (part.toolName !== 'browser') return part;
          const r = part.result as Record<string, unknown>;
          if (r?.snapshot || r?.accessibility_tree) {
            return { ...part, content: '[browser snapshot: pruned]' };
          }
          if (r?.screenshot) {
            return { ...part, content: '[browser screenshot: pruned]' };
          }
          return { ...part, content: `[browser ${(r as any)?.action ?? 'action'} completed]` };
        }),
      };
    });

    const { text: summary } = await generateText({
      model: prepareStepModel,
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
      messages: messagesForSummarizer,
    });

    const summaryMessage: ModelMessage = {
      role: 'assistant',
      content: `[Session summary — earlier context compacted]\n\n${summary}`,
    };

    const result = [summaryMessage, ...recentMessages];
    compressedCache = result;
    lastFullLength = stepMessages.length;
    return { messages: result, compacted: true };
  };
}

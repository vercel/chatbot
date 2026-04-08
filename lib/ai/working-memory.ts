import type { ModelMessage } from 'ai';

export const WORKING_MEMORY_PREFIX =
  '[WORKING MEMORY — Authoritative participant data for this session]';

/**
 * Build a synthetic user message containing the working memory JSON.
 * This message is injected as the first message in the context and is
 * excluded from compaction so the model always has ground-truth data.
 */
export function buildWorkingMemoryMessage(
  memory: Record<string, unknown>,
): ModelMessage {
  return {
    role: 'user' as const,
    content:
      `${WORKING_MEMORY_PREFIX}\n\n` +
      `${JSON.stringify(memory, null, 2)}\n\n` +
      'This is the authoritative participant data for this session. ' +
      'Always prefer this data over anything in conversation history or compaction summaries. ' +
      'Do NOT modify or re-interpret these values.',
  };
}

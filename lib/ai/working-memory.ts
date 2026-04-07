import type { ModelMessage } from 'ai';
import type { ChatMessage } from '@/lib/types';

export const WORKING_MEMORY_PREFIX =
  '[WORKING MEMORY — Authoritative participant data for this session]';

/**
 * Reconstruct working memory from the message history by finding the last
 * updateWorkingMemory tool invocation. Each call contains the full state
 * (replace semantics), so only the most recent one matters.
 */
export function reconstructWorkingMemory(
  messages: ChatMessage[],
): Record<string, unknown> | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;

    for (let j = msg.parts.length - 1; j >= 0; j--) {
      const part = msg.parts[j] as any;
      if (
        part.type === 'tool-updateWorkingMemory' &&
        (part.state === 'output-available' ||
          part.state === 'input-available')
      ) {
        return part.input ?? null;
      }
    }
  }

  return null;
}

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

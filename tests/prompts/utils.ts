import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';

const mockUsage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 20, text: 20, reasoning: 0 },
};

const mockFinishReason = { unified: 'stop' as const, raw: 'stop' };

export function getResponseChunksByPrompt(
  _prompt: unknown,
  includeReasoning = false
): LanguageModelV3StreamPart[] {
  const chunks: LanguageModelV3StreamPart[] = [];

  if (includeReasoning) {
    chunks.push(
      { type: 'reasoning-start', id: 'r1' },
      { type: 'reasoning-delta', id: 'r1', delta: 'Let me think about this.' },
      { type: 'reasoning-end', id: 'r1' }
    );
  }

  chunks.push(
    { type: 'text-start', id: 't1' },
    { type: 'text-delta', id: 't1', delta: 'Hello, world!' },
    { type: 'text-end', id: 't1' },
    {
      type: 'finish',
      finishReason: mockFinishReason,
      usage: mockUsage,
    }
  );

  return chunks;
}

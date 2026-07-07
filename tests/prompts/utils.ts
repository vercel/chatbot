import type { LanguageModelV3StreamPart } from "@ai-sdk/provider";

const mockUsage = {
  inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 10, total: 10 },
  outputTokens: { reasoning: 0, text: 20, total: 20 },
};

export function getResponseChunksByPrompt(
  _prompt: unknown,
  includeReasoning = false
): LanguageModelV3StreamPart[] {
  const chunks: LanguageModelV3StreamPart[] = [];

  if (includeReasoning) {
    chunks.push(
      { id: "r1", type: "reasoning-start" },
      { delta: "Let me think about this.", id: "r1", type: "reasoning-delta" },
      { id: "r1", type: "reasoning-end" }
    );
  }

  chunks.push(
    { id: "t1", type: "text-start" },
    { delta: "Hello, world!", id: "t1", type: "text-delta" },
    { id: "t1", type: "text-end" },
    {
      finishReason: { raw: "stop", unified: "stop" },
      type: "finish",
      usage: mockUsage,
    }
  );

  return chunks;
}

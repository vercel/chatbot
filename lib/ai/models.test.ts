import type { LanguageModelV3GenerateResult } from "@ai-sdk/provider";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { getResponseChunksByPrompt } from "@/tests/prompts/utils";

const mockUsage = {
  inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 10, total: 10 },
  outputTokens: { reasoning: 0, text: 20, total: 20 },
};

const mockFinishReason = { raw: undefined, unified: "stop" as const };

const mockGenerateResult: LanguageModelV3GenerateResult = {
  content: [{ text: "Hello, world!", type: "text" }],
  finishReason: mockFinishReason,
  usage: mockUsage,
  warnings: [],
};

const titleGenerateResult: LanguageModelV3GenerateResult = {
  content: [{ text: "This is a test title", type: "text" }],
  finishReason: mockFinishReason,
  usage: mockUsage,
  warnings: [],
};

export const chatModel = new MockLanguageModelV3({
  doGenerate: mockGenerateResult,
  doStream: async ({ prompt }) => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 500,
      chunks: getResponseChunksByPrompt(prompt),
      initialDelayInMs: 1000,
    }),
  }),
});

export const reasoningModel = new MockLanguageModelV3({
  doGenerate: mockGenerateResult,
  doStream: async ({ prompt }) => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 500,
      chunks: getResponseChunksByPrompt(prompt, true),
      initialDelayInMs: 1000,
    }),
  }),
});

export const titleModel = new MockLanguageModelV3({
  doGenerate: titleGenerateResult,
  doStream: async () => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 500,
      chunks: [
        { id: "1", type: "text-start" as const },
        { delta: "This is a test title", id: "1", type: "text-delta" as const },
        { id: "1", type: "text-end" as const },
        {
          finishReason: mockFinishReason,
          type: "finish" as const,
          usage: mockUsage,
        },
      ],
      initialDelayInMs: 1000,
    }),
  }),
});

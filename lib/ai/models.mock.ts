import type { LanguageModel } from "ai";

const mockResponses: Record<string, string> = {
  default: "This is a mock response for testing.",
  weather: "The weather in San Francisco is sunny and 72°F.",
  greeting: "Hello! How can I help you today?",
};

const mockUsage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 20, text: 20, reasoning: 0 },
};

function getResponseForPrompt(prompt: unknown): string {
  const promptStr = JSON.stringify(prompt).toLowerCase();

  if (promptStr.includes("weather") || promptStr.includes("temperature")) {
    return mockResponses.weather;
  }
  if (
    promptStr.includes("hello") ||
    promptStr.includes("hi") ||
    promptStr.includes("hey")
  ) {
    return mockResponses.greeting;
  }

  return mockResponses.default;
}

const createMockModel = (): LanguageModel =>
  ({
    specificationVersion: "v3",
    provider: "mock",
    modelId: "mock-model",
    defaultObjectGenerationMode: "tool",
    supportedUrls: {},
    doGenerate: async ({ prompt }: { prompt: unknown }) => ({
      finishReason: "stop",
      usage: mockUsage,
      content: [{ type: "text", text: getResponseForPrompt(prompt) }],
      warnings: [],
    }),
    doStream: ({ prompt }: { prompt: unknown }) => {
      const response = getResponseForPrompt(prompt);
      const words = response.split(" ");

      return {
        stream: new ReadableStream({
          async start(controller) {
            controller.enqueue({ type: "text-start", id: "t1" });
            for (const word of words) {
              controller.enqueue({
                type: "text-delta",
                id: "t1",
                delta: `${word} `,
              });
              await new Promise((resolve) => {
                setTimeout(resolve, 10);
              });
            }
            controller.enqueue({ type: "text-end", id: "t1" });
            controller.enqueue({
              type: "finish",
              finishReason: "stop",
              usage: mockUsage,
            });
            controller.close();
          },
        }),
      };
    },
  }) as unknown as LanguageModel;

const createMockTitleModel = (): LanguageModel =>
  ({
    specificationVersion: "v3",
    provider: "mock",
    modelId: "mock-title-model",
    defaultObjectGenerationMode: "tool",
    supportedUrls: {},
    doGenerate: async () => ({
      finishReason: "stop",
      usage: {
        inputTokens: { total: 5, noCache: 5, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 5, text: 5, reasoning: 0 },
      },
      content: [{ type: "text", text: "Test Conversation" }],
      warnings: [],
    }),
    doStream: () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "text-start", id: "t1" });
          controller.enqueue({
            type: "text-delta",
            id: "t1",
            delta: "Test Conversation",
          });
          controller.enqueue({ type: "text-end", id: "t1" });
          controller.enqueue({
            type: "finish",
            finishReason: "stop",
            usage: {
              inputTokens: {
                total: 5,
                noCache: 5,
                cacheRead: 0,
                cacheWrite: 0,
              },
              outputTokens: { total: 5, text: 5, reasoning: 0 },
            },
          });
          controller.close();
        },
      }),
    }),
  }) as unknown as LanguageModel;

export const chatModel = createMockModel();
export const titleModel = createMockTitleModel();

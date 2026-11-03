import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { gateway, type UIMessage } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { generateTitleFromUserMessage } from "@/lib/ai/generate-title";
import { titleModel } from "@/lib/ai/models";

afterEach(() => {
  mock.restoreAll();
});

function mockTitleModel() {
  const model = new MockLanguageModelV3({
    doGenerate: {
      content: [{ text: '## "Weather in NYC"', type: "text" }],
      finishReason: { raw: undefined, unified: "stop" },
      usage: {
        inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 10, total: 10 },
        outputTokens: { reasoning: 0, text: 20, total: 20 },
      },
      warnings: [],
    },
  });
  mock.method(gateway, "languageModel", () => model);
  return model;
}

function getUserPrompt(model: MockLanguageModelV3) {
  const message = model.doGenerateCalls[0].prompt.find(
    (entry) => entry.role === "user"
  );
  assert.ok(message);
  return message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function userMessage(parts: UIMessage["parts"]): UIMessage {
  return { id: "test-message", parts, role: "user" };
}

test("generates a title from text parts and preserves provider routing", async () => {
  const model = mockTitleModel();
  const title = await generateTitleFromUserMessage({
    message: userMessage([
      { text: "Weather ", type: "text" },
      {
        mediaType: "image/png",
        type: "file",
        url: "https://example.com/image.png",
      },
      { text: "in NYC", type: "text" },
    ]),
  });

  assert.equal(title, "Weather in NYC");
  assert.equal(getUserPrompt(model), "Weather in NYC");
  assert.deepEqual(
    model.doGenerateCalls[0].providerOptions?.gateway?.order,
    titleModel.gatewayOrder
  );
});

test("bounds the combined title prompt across multiple text parts", async () => {
  const model = mockTitleModel();
  await generateTitleFromUserMessage({
    message: userMessage([
      { text: "a".repeat(1500), type: "text" },
      { text: "b".repeat(1500), type: "text" },
    ]),
  });

  assert.equal(getUserPrompt(model), "a".repeat(1500) + "b".repeat(500));
});

test("preserves a title prompt at the character limit", async () => {
  const model = mockTitleModel();
  const text = "a".repeat(2000);
  await generateTitleFromUserMessage({
    message: userMessage([{ text, type: "text" }]),
  });

  assert.equal(getUserPrompt(model), text);
});

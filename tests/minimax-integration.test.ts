/**
 * Integration test for MiniMax provider.
 * Run with: MINIMAX_API_KEY=<key> npx tsx tests/minimax-integration.test.ts
 */

const API_KEY = process.env.MINIMAX_API_KEY;
const BASE_URL = process.env.MINIMAX_BASE_URL || "https://api.minimax.io/v1";

async function testBasicChat() {
  console.log("Testing MiniMax basic chat...");
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "MiniMax-M2.5",
      messages: [{ role: "user", content: 'Say "MiniMax test passed"' }],
      max_tokens: 20,
      temperature: 1.0,
    }),
  });

  if (!response.ok) {
    throw new Error(`Chat API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content in response");
  }
  console.log(`  Response: ${content}`);
  console.log("  PASSED");
}

async function testStreaming() {
  console.log("Testing MiniMax streaming...");
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "MiniMax-M2.5",
      messages: [{ role: "user", content: "Count 1 to 3" }],
      max_tokens: 50,
      stream: true,
      temperature: 1.0,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Streaming API error: ${response.status} ${response.statusText}`
    );
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let chunks = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    if (text.includes("data:")) chunks++;
  }

  if (chunks < 1) {
    throw new Error("Expected multiple streaming chunks");
  }
  console.log(`  Received ${chunks} chunks`);
  console.log("  PASSED");
}

async function testModelList() {
  console.log("Testing model list includes MiniMax...");

  // Dynamically import models to verify they're correctly defined
  const models = await import("../lib/ai/models");

  const minimaxModels = models.chatModels.filter((m) =>
    m.id.startsWith("minimax/")
  );

  if (minimaxModels.length !== 2) {
    throw new Error(`Expected 2 MiniMax models, got ${minimaxModels.length}`);
  }

  const hasM25 = minimaxModels.some((m) => m.id === "minimax/MiniMax-M2.5");
  const hasHighspeed = minimaxModels.some(
    (m) => m.id === "minimax/MiniMax-M2.5-highspeed"
  );

  if (!hasM25 || !hasHighspeed) {
    throw new Error("Missing expected MiniMax models");
  }

  if (!models.allowedModelIds.has("minimax/MiniMax-M2.5")) {
    throw new Error("MiniMax-M2.5 not in allowedModelIds");
  }

  const minimaxGroup = models.modelsByProvider["minimax"];
  if (!minimaxGroup || minimaxGroup.length !== 2) {
    throw new Error("MiniMax not properly grouped in modelsByProvider");
  }

  console.log("  Models:", minimaxModels.map((m) => m.id).join(", "));
  console.log("  PASSED");
}

async function main() {
  console.log("=== MiniMax Integration Tests ===\n");

  // Model list test (no API key needed)
  await testModelList();

  if (!API_KEY) {
    console.log(
      "\nSkipping API tests (set MINIMAX_API_KEY to run full tests)"
    );
    return;
  }

  await testBasicChat();
  await testStreaming();

  console.log("\n=== All tests passed ===");
}

main().catch((error) => {
  console.error("\nTEST FAILED:", error.message);
  process.exit(1);
});

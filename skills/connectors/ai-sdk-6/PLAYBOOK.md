# AI SDK 6 — Connector Playbook

**Version:** 6.0.116 | **Type:** SDK Reference | **Primary Domain:** mcp-edits
**Also In:** agent-payments, reporting, support-triage, customer-comms, lead-flow
**Source:** ai-sdk.dev, github.com/vercel/ai

## When to Use This Connector

Use the AI SDK 6 connector when:
- Building chat, agent, or generative UI interfaces
- Streaming text, structured data, or tool calls from LLMs
- Managing agentic loops with tool calling and step control
- Implementing resumable streams for crash recovery
- Integrating OpenAI, Anthropic, Google, or custom providers
- Using MCP (Model Context Protocol) tools in agent pipelines
- Building workflows with AI SDK integration

## Capabilities (7 Registered Functions)

### 1. `generateText`
Non-interactive text generation. Returns full text, tool calls, usage.
**Use when:** Drafting emails, summarizing content, agent tool use.
**Signature:** `generateText({ model, prompt, system?, tools?, onFinish? })`
**Returns:** `{ text, toolCalls, toolResults, usage, totalUsage, steps, finishReason }`

### 2. `streamText`
Interactive streaming text generation with backpressure.
**Use when:** Chatbots, real-time content generation, progressive rendering.
**Signature:** `streamText({ model, prompt, system?, tools?, onChunk?, onError?, onFinish? })`
**Returns:** `{ textStream, fullStream, toUIMessageStreamResponse(), pipeTextStreamToResponse() }`

### 3. `Output.object()` / `Output.array()`
Structured data generation with Zod schemas.
**Use when:** Information extraction, classification, synthetic data, form filling.
**Signature:** `Output.object({ schema: z.object({...}) })`
**Returns:** Typed, schema-validated output via `result.output`

### 4. `tool()`
Define tools with Zod input schemas for LLM tool calling.
**Use when:** Creating callable tools for agents, API integrations, code execution.
**Signature:** `tool({ description, inputSchema, execute })`
**Returns:** Tool definition compatible with generateText/streamText

### 5. `ToolLoopAgent`
Full agent class with automatic tool-calling loop management.
**Use when:** Autonomous agents that reason and act iteratively.
**Signature:** `new ToolLoopAgent({ model, instructions, tools?, stopWhen?, output? })`
**Methods:** `.generate()`, `.stream()`, `createAgentUIStreamResponse()`

### 6. `useChat` (AI SDK UI)
React hook for building chat interfaces with streaming, tool display, and message persistence.
**Use when:** React/Next.js chat UI with @ai-sdk/react.
**Signature:** `useChat({ id?, messages?, resume?, transport? })`
**Returns:** `{ messages, status, sendMessage, stop, addToolApprovalResponse }`

### 7. Resumable Streams
Mid-stream recovery after page reload or network interruption.
**Use when:** Long-running generations that survive client disconnects.
**Package:** `resumable-stream` (Redis-based)
**API:** `createResumableStreamContext()`, `createNewResumableStream()`, `resumeExistingStream()`

## Provider Architecture

AI SDK 6 uses a `provider/model` naming convention:
```ts
model: "anthropic/claude-sonnet-4.5"
model: "openai/gpt-4.1"
model: "google/gemini-2.5-pro"
```

Three configuration modes:
1. **Gateway** — managed routing (Vercel AI Gateway)
2. **Provider** — direct provider connection with API key
3. **Custom** — fully custom provider implementation via `@ai-sdk/provider`

## Common Patterns

### Pattern 1: Basic Chat Streaming
```ts
import { streamText } from 'ai';
export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({ model: "anthropic/claude-sonnet-4.5", messages });
  return result.toUIMessageStreamResponse();
}
```

### Pattern 2: Agent with Tool Calling
```ts
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';
const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4.5",
  instructions: "You are a helpful assistant with access to customer tools.",
  tools: {
    lookupCustomer: tool({
      description: "Find customer by email or phone",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => ({ id: "cust_123", name: "Alice" }),
    }),
  },
  stopWhen: stepCountIs(20),
});
```

### Pattern 3: Resumable Stream
```ts
import { createResumableStreamContext } from 'resumable-stream';
const streamContext = createResumableStreamContext({ waitUntil: after });
const result = streamText({
  model,
  messages,
  onFinish: () => saveChat({ activeStreamId: null }),
  experimental_transform: [
    smoothStream(),
    consumeSseStream(async (stream) => {
      const streamId = await streamContext.createNewResumableStream(stream);
      saveChat({ activeStreamId: streamId });
    }),
  ],
});
```

## Edge Cases & Gotchas

1. **Backpressure**: `streamText` only generates tokens as consumed. Always consume the stream.
2. **Tool Approval**: Tools without `execute` functions need client approval — use `addToolApprovalResponse`.
3. **stopWhen**: Default 20-step limit. Increase for complex multi-step agents.
4. **Error handling**: `streamText` suppresses errors; use `onError` callback.
5. **Stream cleanup**: On stop, simulate `finish-step` + `finish` events for well-formed streams.
6. **activeStreamId race**: Clear before starting new generation to prevent stale resumptions.

## Cross-References

- Connector: `workflow-devkit` — AI SDK workflows
- Connector: `vercel` — Vercel deployment for AI SDK apps
- Connector: `github` — Code generation + PR creation
- Skill: `skill-creator` — Generate skills using AI SDK patterns
- Playbook: `playbook-os/domains/mcp-edits/playbook.md`

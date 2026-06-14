# AI SDK 6 — Skill Definition

**Type:** SDK Reference | **Version:** 6.0.116
**Triggers:** "streamText", "generateText", "ToolLoopAgent", "useChat", "ai-sdk", "vercel ai", "AI SDK 6", "resumable streams", "tool calling AI SDK", "@ai-sdk/react"

## Skill Activation

This skill activates when:
- User asks how to use AI SDK 6 functions (streamText, generateText, ToolLoopAgent)
- User wants to build chat/agent/generative UI with the AI SDK
- User needs to implement resumable streams for crash recovery
- User asks about tool calling, MCP integration, or agent patterns
- User wants to migrate from AI SDK 5 to 6
- Any code referencing `import { ... } from 'ai'` or `@ai-sdk/*`

## Core Knowledge

See PLAYBOOK.md for full reference. Quick reference:

### streamText — Streaming chat generation
```ts
import { streamText } from 'ai';
const result = streamText({
  model: "anthropic/claude-sonnet-4.5",
  messages,
  tools: { myTool },
  onChunk: ({ chunk }) => { /* handle chunk */ },
  onError: ({ error }) => { /* handle error */ },
  onFinish: ({ text, usage }) => { /* persist */ },
});
return result.toUIMessageStreamResponse();
```

### generateText — One-shot generation
```ts
import { generateText } from 'ai';
const { text, toolCalls, usage } = await generateText({
  model: "anthropic/claude-sonnet-4.5",
  prompt: "Summarize this document...",
});
```

### ToolLoopAgent — Autonomous agents
```ts
import { ToolLoopAgent, tool, stepCountIs } from 'ai';
const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4.5",
  instructions: "You are an expert developer.",
  tools: { /* ... */ },
  stopWhen: stepCountIs(20),
});
const { text } = await agent.generate({ prompt: "Build me a REST API" });
```

## Common Use Cases in Neptune

1. **Chat streaming**: Uses `streamText` with `toUIMessageStreamResponse()` in `/api/chat/route.ts`
2. **Agent dispatch**: Uses `ToolLoopAgent` for autonomous task execution
3. **Tool execution**: Tool definitions using `tool()` with Zod schemas
4. **Crash recovery**: Resumable streams with Redis for chat persistence
5. **Structured output**: `Output.object()` for extracting typed data from LLM responses

## Anti-Patterns

- DON'T use `generateText` for chat — use `streamText` for interactive experiences
- DON'T forget `stepCountIs()` limit on agents — default is 20, infinite loops possible
- DON'T call `stop()` without a dedicated stop endpoint for resumable streams
- DON'T mix `generateText` and `streamText` tool patterns — they have different error handling
- DON'T skip `onError` callback in production streams

## Related Skills

- `workflow-devkit` — Durable AI workflows
- `skill-creator` — Generate new Neptune skills with AI SDK patterns
- `mcp-edits` — Code generation + PR creation flow
- `vps-operations` — Deploy AI SDK apps to VPS

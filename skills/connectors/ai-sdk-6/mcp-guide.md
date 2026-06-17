---
type: "connector"
name: "Mcp Guide"
description: "Auto-generated description for Mcp Guide"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# AI SDK 6 — MCP Bridge Guide

**Purpose:** How Neptune exposes AI SDK 6 as a connector with MCP-compatible tool registration.

## MCP Tools (5 Registered)

### 1. `ai_sdk_stream_text`
Stream text from an LLM with tools.

**Input Schema:**
```json
{ "provider": "string", "model": "string", "messages": "array", "tools": "object?", "system": "string?" }
```

**Output:** UIMessageStreamResponse (SSE)

### 2. `ai_sdk_generate_text`
Generate text in one shot.

**Input Schema:**
```json
{ "provider": "string", "model": "string", "prompt": "string", "system": "string?", "tools": "object?" }
```

**Output:** `{ text, toolCalls, usage }`

### 3. `ai_sdk_create_agent`
Create and run a ToolLoopAgent.

**Input Schema:**
```json
{ "provider": "string", "model": "string", "instructions": "string", "tools": "object", "maxSteps": "number?" }
```

**Output:** `{ text, steps, usage }`

### 4. `ai_sdk_structured_output`
Extract structured data using Output.object().

**Input Schema:**
```json
{ "provider": "string", "model": "string", "prompt": "string", "schema": "object" }
```

**Output:** Typed JSON per schema

### 5. `ai_sdk_resume_stream`
Check and resume an active stream.

**Input Schema:**
```json
{ "chatId": "string" }
```

**Output:** UIMessageStreamResponse or 204 No Content

## Integration with Neptune V2

When Neptune V2 needs to call an AI SDK tool, it:
1. Maps the V2 agent action → AI SDK connector capability
2. Translates Zod schemas ↔ JSON Schema for cross-agent compatibility
3. Handles streaming responses with proper SSE forwarding
4. Tracks token usage per call for billing/analytics

## Provider Configuration

Supported providers via the `provider` field:
- `anthropic` — Claude models
- `openai` — GPT models  
- `google` — Gemini models
- `vercel` — AI Gateway (managed routing)
- Custom providers via `@ai-sdk/provider` interface

API keys configured via environment variables:
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`

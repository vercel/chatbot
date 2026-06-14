# Workflow DevKit — MCP Bridge Guide

**Purpose:** How Neptune exposes Workflow DevKit as a connector with MCP-compatible tool registration.

## MCP Tools (4 Registered)

### 1. `workflow_create`
Create a new workflow definition.

**Input Schema:**
```json
{ "id": "string", "handler": "string (serialized)", "trigger": "string?" }
```

**Output:** `{ workflowId, status: "registered" }`

### 2. `workflow_start`
Start a workflow execution.

**Input Schema:**
```json
{ "workflowId": "string", "input": "object" }
```

**Output:** `{ runId, status: "running" }`

### 3. `workflow_status`
Check workflow execution status.

**Input Schema:**
```json
{ "runId": "string" }
```

**Output:** `{ runId, status, steps: [{ name, status, result? }] }`

### 4. `workflow_cancel`
Cancel a running workflow.

**Input Schema:**
```json
{ "runId": "string", "force": "boolean?" }
```

**Output:** `{ runId, status: "cancelled" | "terminated" }`

## Durable Execution Model

```
┌──────────────────────────────────────────────────────┐
│  Workflow Execution                                   │
│                                                       │
│  Step 1 ✓ (stored)                                   │
│  Step 2 ✓ (stored)                                   │
│  Step 3 → CRASH ←                                    │
│                                                       │
│  ── RESTART ──                                       │
│                                                       │
│  Step 1 ✓ (replayed from store)                      │
│  Step 2 ✓ (replayed from store)                      │
│  Step 3 → RUN (fresh execution)                      │
│  Step 4 → RUN                                        │
│  ✓ Complete                                           │
└──────────────────────────────────────────────────────┘
```

## Integration with Neptune V2

When Neptune V2 dispatches a workflow:
1. V2 agent creates workflow with `workflow_create`
2. V2 triggers execution with `workflow_start`
3. Progress tracked via `workflow_status` polling
4. Cancelled via `workflow_cancel` if user aborts

## Compatibility Notes

- Workflow DevKit is in Beta (v0.0.0) — APIs may change
- Requires Node.js 18+ for `AsyncLocalStorage` support
- Compatible with AI SDK 6 (v6.0.116+)
- Redis recommended for production (state persistence)
- Vercel KV or Upstash Redis supported as state store

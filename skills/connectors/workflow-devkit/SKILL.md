---
type: "connector"
name: "SKILL"
description: "Auto-generated description for SKILL"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Workflow DevKit — Skill Definition

**Type:** SDK Reference | **Version:** 0.0.0 (Beta)
**Triggers:** "workflow", "durable workflow", "step.run", "createWorkflow", "@ai-sdk/workflow", "workflow SDK", "resumable workflow", "durable execution"

## Skill Activation

This skill activates when:
- User asks about building durable/resumable workflows
- User wants to chain AI SDK calls with crash recovery
- User needs multi-step business processes (payments, data pipelines, approvals)
- User asks about `createWorkflow`, `step.run`, `workflow.sleep`
- User wants to integrate workflows with AI SDK 6 `streamText`/`generateText`
- Any code referencing `import { ... } from '@ai-sdk/workflow'`

## Core Knowledge

See PLAYBOOK.md for full reference. Quick reference:

### Creating a Workflow
```ts
import { createWorkflow } from '@ai-sdk/workflow';

const myWorkflow = createWorkflow({
  id: 'my-workflow',
  handler: async ({ input }) => {
    // Durable steps — survive crashes
    const step1 = await step.run('step-1', async () => {
      return await someApiCall(input);
    });

    // Durable sleep — survives restarts
    await workflow.sleep(5000);

    // Wait for external event
    const event = await hooks.waitFor('webhook.event');

    return { step1, event };
  },
});
```

### Triggering a Workflow
```ts
// From API route
const handle = await myWorkflow.start({ customerId: '123' });
const status = await handle.status();
const result = await handle.result();
```

### AI SDK Integration
```ts
const aiWorkflow = createWorkflow({
  id: 'ai-process',
  handler: async ({ input }) => {
    const analysis = await step.run('ai-analysis', async () => {
      const { text } = await generateText({
        model: 'anthropic/claude-sonnet-4.5',
        prompt: `Analyze: ${input.query}`,
      });
      return text;
    });
    return { analysis };
  },
});
```

## Common Use Cases in Neptune

1. **Payment processing**: Durable multi-step billing with validation → charge → confirmation
2. **Data pipelines**: Fan-out processing with per-item durability
3. **Approval workflows**: Human-in-the-loop via `hooks.waitFor()`
4. **Scheduled jobs**: `workflow.sleepUntil()` for delayed operations
5. **Crash recovery**: Automatic resume after VPS restart or deployment

## Anti-Patterns

- DON'T use non-serializable inputs inside `step.run()` — results must be JSON-serializable
- DON'T run workflows without timeout configuration — they can hang indefinitely
- DON'T call `workflow.sleep()` in non-workflow contexts (e.g., API routes) — use `setTimeout`
- DON'T rely on global state inside workflow handlers — they may replay on different machines
- DON'T put `step.run()` inside conditional branches that depend on non-deterministic data

## Related Skills

- `ai-sdk-6` — AI SDK integration with workflows
- `billing-and-payments` — Payment workflow implementation
- `mcp-edits` — Code generation workflows
- `vps-operations` — Deploy and manage workflow infrastructure

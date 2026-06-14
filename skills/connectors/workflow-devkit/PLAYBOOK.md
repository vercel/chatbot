# Workflow DevKit — Connector Playbook

**Version:** 0.0.0 (Beta) | **Type:** SDK Reference | **Primary Domain:** mcp-edits
**Also In:** agent-payments, billing-flow, credit-disputes, support-triage
**Source:** workflow-sdk.dev, github.com/vercel/workflow

## When to Use This Connector

Use the Workflow DevKit connector when:
- Building durable, resumable workflows that survive restarts
- Chaining AI SDK calls with guaranteed execution
- Implementing multi-step business processes with checkpoints
- Handling external webhooks, events, and long-running operations
- Fan-out/fan-in patterns across microservices
- Scheduling future work or retries with backoff

## Core Concepts

### Workflows
A workflow is a durable function. It runs sequentially but automatically persists state after each step, enabling crash recovery. The runtime replays the workflow from the last checkpoint.

### Steps
Each `step.run()` call is a unit of durability. Step results are stored, so on replay the stored value is returned rather than re-executing. Steps must be deterministic — same input → same stored result.

### Durability
The defining feature: if a process crashes mid-workflow, it resumes from the last completed step automatically. No manual checkpoint code needed.

## Capabilities (6 Registered Functions)

### 1. `createWorkflow()`
Define a durable workflow function.
**Use when:** Building any multi-step operation that must survive failures.
**Signature:** `createWorkflow({ id, trigger?, handler })`
**Returns:** Workflow instance with `.start()` method.

### 2. `step.run()`
Atomic unit of durability. Executes once, stores result, replays from cache.
**Use when:** Any operation that should not be repeated on retry (API calls, DB writes, payments).
**Signature:** `step.run(name, async () => { /* durable work */ })`
**Returns:** Stored result (fresh on first run, cached on replay).

### 3. `workflow.sleep()`
Durable sleep — survives process restarts. Unlike `setTimeout`, the workflow pauses AND persists.
**Use when:** Waiting for external events, rate limiting, scheduled delays.
**Signature:** `await workflow.sleep(milliseconds)` or `await workflow.sleepUntil(Date)`

### 4. `workflow.start()`
Trigger a workflow execution and track its state.
**Use when:** Kicking off a workflow from an API route or event handler.
**Signature:** `const handle = await workflow.start(input)`
**Returns:** WorkflowHandle with `.status()`, `.result()`, `.cancel()`

### 5. `hooks.waitFor()`
Pause workflow until an external event arrives via webhook.
**Use when:** Human-in-the-loop approvals, payment confirmations, external service callbacks.
**Signature:** `await hooks.waitFor('payment.confirmed', timeout?)`
**Returns:** Event payload when received.

### 6. `workflow.cancel()` / `workflow.terminate()`
Gracefully stop or forcefully terminate a running workflow.
**Use when:** User cancels operation, timeout exceeded, business rule change.
**Signature:** `await handle.cancel()` / `await handle.terminate()`

## Integration with AI SDK

Workflows integrate with AI SDK 6 for AI-powered durable operations:

```ts
import { createWorkflow } from '@ai-sdk/workflow';
import { generateText, streamText } from 'ai';

const analyzeAndAct = createWorkflow({
  id: 'customer-analysis',
  handler: async ({ input }) => {
    // Step 1: Analyze customer data (runs once, stored)
    const analysis = await step.run('analyze', async () => {
      const { text } = await generateText({
        model: 'anthropic/claude-sonnet-4.5',
        prompt: `Analyze: ${input.customerData}`,
      });
      return text;
    });

    // Step 2: Durable sleep while waiting
    await workflow.sleep(30000);

    // Step 3: Generate action plan
    const plan = await step.run('plan', async () => {
      const { text } = await generateText({
        model: 'anthropic/claude-sonnet-4.5',
        prompt: `Create plan based on: ${analysis}`,
        tools: { /* business tools */ },
      });
      return text;
    });

    return { analysis, plan };
  },
});
```

## Common Patterns

### Pattern 1: Payment Processing with Retries
```ts
const processPayment = createWorkflow({
  id: 'payment-processor',
  handler: async ({ input }) => {
    // Step 1: Validate card
    const validation = await step.run('validate', async () => {
      return await nmiConnector.validateCard(input.cardDetails);
    });

    if (!validation.success) {
      throw new Error('Card validation failed');
    }

    // Step 2: Charge (durable — won't double-charge on retry)
    const charge = await step.run('charge', async () => {
      return await nmiConnector.chargeCard(input.cardDetails, input.amount);
    });

    // Step 3: Wait for webhook confirmation
    const confirmation = await hooks.waitFor('payment.settled', 60000);

    return { validation, charge, confirmation };
  },
});
```

### Pattern 2: Fan-Out Data Processing
```ts
const batchProcess = createWorkflow({
  id: 'batch-processor',
  handler: async ({ input }) => {
    const results = [];
    for (const item of input.items) {
      const result = await step.run(`process-${item.id}`, async () => {
        return await thirdPartyApi.process(item);
      });
      results.push(result);
    }
    return { processed: results.length };
  },
});
```

## Error Handling

1. **Non-deterministic errors** (network, timeout): Workflow retries from last step
2. **Deterministic errors** (validation, business logic): Re-thrown on replay, must be caught
3. **Step failures**: `step.run()` catches errors; workflow continues unless you re-throw
4. **Workflow timeout**: Configurable per workflow; auto-cancelled if exceeded
5. **Idempotency keys**: Use `headers.idempotencyKey` for payment/API calls inside steps

## Serialization Constraints

Steps can only pass serializable data. Supported types:
- JSON primitives (string, number, boolean, null)
- Arrays and plain objects
- Date objects
- Custom types must implement `toJSON()`

NOT supported: functions, class instances, Promises, streams, WeakMaps

## Cross-References

- Connector: `ai-sdk-6` — AI SDK integration
- Connector: `nmi` — Payment processing in workflows
- Connector: `slack` — Slack notifications from workflows
- Connector: `base44` — Customer data in durable workflows
- Skill: `billing-and-payments` — Payment workflow patterns

---
name: hermes-vps
version: "1.0.0"
scope: connector
domain: vps-dispatch
type: ephemeral-dispatch-connector
priority: P0
auto_load: true
model_routing:
  default: "deepseek/deepseek-v4-pro"
  runtime: claude_sdk
  maxTurns: 60
intent_tags:
  - "send to vps"
  - "dispatch to vps"
  - "send prd to vps"
  - "run on vps"
  - "fix on vps"
  - "quick fix vps"
  - "vps please"
  - "execute on vps"
  - "send this task"
  - "kick off mission"
trigger_words:
  - "send to vps"
  - "dispatch to vps"
  - "send prd to vps"
  - "run on vps"
  - "fix on vps"
  - "quick fix vps"
  - "vps please"
  - "execute on vps"
  - "send this task"
  - "kick off mission"
associated_connectors:
  - base44
  - slack
  - vps
headline: |
  Quick VPS Claude SDK session dispatch. Triggered by intent words like
  send/dispatch/execute/run/fix + vps. User describes a task and the connector
  ships it to /home/hermes/ Claude SDK runtime via Base44 hybridDispatch.
  For PRD-driven sessions, accept full prompt as goal. Distinguish from
  neptune-v2-handoff which is long PR coding.
access: internal
cardinals:
  - Slack #jarvis-admin C0AQDDC3HAB only
  - Do NOT touch neptune-v2 or Twenty
  - Reserve 50 turns for landing
  - Follow neptune-chat AGENTS.md
---
# Hermes VPS Dispatch Connector

> **Version:** 1.0.0 | **Architecture:** Ephemeral VPS Claude SDK Dispatch
> **Priority:** P0 (quick-fix operations)
> **Distinction:** DIFFERENT from neptune-v2-handoff (long PR coding sessions)

## Identity

You are the **Hermes VPS Dispatch Connector** — the rapid-fire dispatch channel to the
VPS Claude SDK agent. When a user says "hey ajay", "quick fix", or "run on vps", you
handle the entire dispatch lifecycle: open a dispatch session, stream progress, allow
cancellation, and post results to Slack #jarvis-admin.

## Core Intent

Quick ephemeral dispatch of Claude SDK tasks to the VPS. Not for PR coding or
multi-file refactors. Think: "run this query", "check that log", "fix this config",
"analyze this error" — tasks that complete in under 60 turns.

## Key Difference from neptune-v2-handoff

| Aspect | hermes-vps (THIS) | neptune-v2-handoff |
|--------|-------------------|-------------------|
| Use case | Quick fixes, research, log checks | PR coding, multi-file refactors |
| Duration | < 60 turns, ephemeral | Long-running, session-persisted |
| Backend | Base44 hybridDispatch → VPS Claude SDK | Neptune V2 sandbox sessions |
| UI | DispatchModal + VpsProgressCard | HandoffTile with SSE stream |
| Profile | deepseek-v4-pro / claude_sdk | Configurable per task |
| Slack | Result synthesis to #jarvis-admin | PR card rendering |

## Architecture

```
User Chat Input (trigger word detected)
  │
  ├─→ VpsDispatchButton (lightning bolt ⚡)
  │     └─→ VpsDispatchModal (prompt + confirm)
  │           └─→ hermesVpsClient.dispatch()
  │                 └─→ Base44 hybridDispatch (profile=deepseek-v4-pro, runtime=claude_sdk, maxTurns=60)
  │                       └─→ VPS Claude SDK agent runs task
  │
  ├─→ VpsProgressCard (inline message card)
  │     ├─→ Poll every 10s via hermesVpsClient.poll()
  │     ├─→ Cancel button → hermesVpsClient.cancel()
  │     └─→ Complete/error → result summary + Slack thread link
  │
  └─→ Slack #jarvis-admin synthesis
        └─→ Post thread with: task summary, duration, result, dispatchId
```

## HermesVpsClient

```typescript
// client.ts — wraps Base44 hybridDispatch
const client = new HermesVpsClient({
  profile: "deepseek-v4-pro",
  runtime: "claude_sdk",
  maxTurns: 60,
});

// Dispatch
const result = await client.dispatch({ prompt, context? });
// → { dispatchId, status: "dispatched" | "queued", pollUrl }

// Poll
const status = await client.poll(dispatchId);
// → { status: "running" | "completed" | "failed", progress?, result? }

// Cancel
const cancelled = await client.cancel(dispatchId);
// → { success: boolean, dispatchId }
```

## Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| dispatch | `(prompt: string, context?: string) => DispatchResult` | Fire a task to VPS Claude SDK |
| poll | `(dispatchId: string) => PollResult` | Check task status (every 10s) |
| cancel | `(dispatchId: string) => CancelResult` | Cancel a running dispatch |

## UI Components

| Component | Location | Description |
|-----------|----------|-------------|
| VpsDispatchButton | `components/chat/vps-dispatch-button.tsx` | Lightning bolt ⚡ in composer footer |
| VpsDispatchModal | `components/chat/vps-dispatch-modal.tsx` | Prompt input + confirm dispatch |
| VpsProgressCard | `components/chat/vps-progress-card.tsx` | Inline progress with poll/cancel |

## Trigger Detection

The playbook router scans user input for trigger words. On match, it:
1. Highlights the VpsDispatchButton in the composer
2. Loads this SKILL.md for operational context
3. Routes to hermesVpsClient for dispatch flow

## Self-Healing Rules

| Error Pattern | Root Cause | Fix |
|---------------|-----------|-----|
| hybridDispatch timeout | VPS agent queue full | Retry with 5s backoff, max 3 attempts |
| poll returns "lost" | Session expired on VPS | Mark failed, offer re-dispatch |
| cancel not acknowledged | Agent already completed | Show final result instead |
| Slack post fails | Token expired | Fallback to in-chat result only |
| dispatchId not found | Base44 DB miss | Validate dispatchId format, retry dispatch |

## Slack Synthesis

On completion, post to #jarvis-admin (C0AQDDC3HAB):
```
🧵 Hermes VPS Dispatch Complete
   Task: <summary>
   Duration: <elapsed>
   Turns used: <N>/60
   Result: <1-line summary>
   Dispatch ID: <dispatchId>
```

## Environment Variables

```
BASE44_API_KEY          # Required — Base44 service token
BASE44_FUNCTIONS_URL    # Required — Base44 functions endpoint
SLACK_BOT_TOKEN         # Required — for #jarvis-admin synthesis
JARVIS_ADMIN_CHANNEL_ID # Required — C0AQDDC3HAB
```

## Cardinal Rules

1. NEVER use for long-running PR coding tasks — redirect to neptune-v2-handoff
2. Slack #jarvis-admin ONLY (C0AQDDC3HAB) — never newleaf-admin
3. Do NOT touch neptune-v2 connector or Twenty
4. Reserve 50 turns for landing phase
5. Follow neptune-chat AGENTS.md conventions
6. All commits author: abhiswami2121@gmail.com

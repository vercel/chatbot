# Hermes VPS Dispatch Connector — Documentation

## Quick Start

```typescript
import { dispatchToVps, pollVpsDispatch, cancelVpsDispatch } from "@/playbook-skills/connectors/hermes-vps/actions";

// 1. Dispatch a task
const result = await dispatchToVps("Check the error logs for payment failures");

// 2. Poll every 10s
const status = await pollVpsDispatch(result.dispatchId!);

// 3. Cancel if needed
await cancelVpsDispatch(result.dispatchId!);
```

## Architecture

```
Browser                    Next.js API Route             VPS Bridge              Base44
──────                     ────────────────             ──────────              ──────
VpsDispatchButton ──→  POST /api/hermes-vps/dispatch ──→ /tool/base44/ ──→ hybridDispatch()
                                                          invokeFunction
VpsProgressCard  ──→  GET /api/hermes-vps/poll/:id   ──→ /tool/base44/ ──→ hybridDispatchPoll()
                                                          invokeFunction
Cancel button    ──→  POST /api/hermes-vps/cancel/:id ──→ /tool/base44/ ──→ hybridDispatchCancel()
                                                          invokeFunction
```

## Trigger Words

Any of these in user input activate the VPS dispatch flow:

| Trigger Word | Example |
|-------------|---------|
| `send to vps` | "send to vps: analyze the payment logs" |
| `dispatch to vps` | "dispatch to vps: run health check" |
| `send prd to vps` | "send prd to vps: implement billing v2" |
| `run on vps` | "run on vps the error log analyzer" |
| `fix on vps` | "fix on vps the SSL cert issue" |
| `quick fix vps` | "quick fix vps nginx config" |
| `vps please` | "vps please check disk space" |
| `execute on vps` | "execute on vps the db migration script" |
| `send this task` | "send this task to check the queue depth" |
| `kick off mission` | "kick off mission: full credit sweep sync" |

## API Routes

### POST /api/hermes-vps/dispatch
```json
// Request
{ "prompt": "Check error logs", "context": "optional extra context" }

// Response
{ "success": true, "dispatchId": "dsp_abc123", "status": "dispatched" }
```

### POST /api/hermes-vps/poll
```json
// Request
{ "dispatchId": "dsp_abc123" }

// Response
{
  "success": true,
  "dispatchId": "dsp_abc123",
  "status": "running",
  "progress": { "turnsUsed": 12, "maxTurns": 60, "currentStep": "analyzing logs" },
  "elapsedMs": 45000
}
```

### POST /api/hermes-vps/cancel
```json
// Request
{ "dispatchId": "dsp_abc123" }

// Response
{ "success": true, "dispatchId": "dsp_abc123", "message": "Cancelled" }
```

## Env Variables

```
BASE44_API_KEY          # Base44 service token
BASE44_FUNCTIONS_URL    # Base44 functions endpoint
VPS_BRIDGE_URL          # VPS bridge URL (default: http://localhost:8400)
NEPTUNE_INTERNAL_TOKEN  # VPS bridge auth token
SLACK_BOT_TOKEN         # Slack bot for #jarvis-admin synthesis
JARVIS_ADMIN_CHANNEL_ID # C0AQDDC3HAB
```

## Differences from neptune-v2-handoff

| | hermes-vps | neptune-v2-handoff |
|---|---|---|
| **Use case** | Quick fixes, log checks, queries | PR coding, multi-file refactors |
| **Duration** | < 60 turns | Long-running |
| **Backend** | Base44 hybridDispatch | Neptune V2 sandbox |
| **UI** | VpsProgressCard (poll) | HandoffTile (SSE stream) |
| **Profile** | deepseek-v4-pro | Configurable |
| **Max turns** | 60 | Unlimited |

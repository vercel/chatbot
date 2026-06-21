---
name: slack-reporting
description: Shared Slack reporting protocol for ALL loops. Mandatory contract: what to report, when, where, and format. Channel: #jarvis-admin (C0AQDDC3HAB) ONLY. Never #newleaf-admin (C096PSS45Q9).
version: 1.0.0
domain: loop-engineering
priority: P0
channel: C0AQDDC3HAB
requires:
  connectors: [slack]
  functions: [send_message, send_thread_reply]
---

# Slack Reporting Skill

## Purpose

Every autonomous loop MUST report its status to Slack. This is the shared contract that both Ralph and Paul follow. It ensures:
- Operators can see what's running
- Hung loops are detected
- Completion/failure is never silent
- A durable audit trail exists

## Channel (LOCKED — NEVER VIOLATE)

**#jarvis-admin (C0AQDDC3HAB)** — per cardinal 6a28a284

**NEVER #newleaf-admin (C096PSS45Q9)** — per cardinal 6a28a284

## Required Message Types

| Event | Emoji | Format | Trigger |
|-------|-------|--------|---------|
| **START** | 🚀 | `🚀 <LoopType> loop started: <goal_id> (max N iters)` | Loop launch |
| **HEARTBEAT** | ❤️ | `❤️ <LoopType> <goal_id>: iter N/M, last task: <brief>` | Every 5 iters or 5 min |
| **COMPLETE** | ✅ | `✅ <LoopType> <goal_id> DONE: N iters, done.flag written` | done.flag exists |
| **BLOCKED** | ⛔ | `⛔ <LoopType> <goal_id> BLOCKED: max iters reached without done.flag` | max_iters hit |
| **CRASHED** | 💀 | `💀 <LoopType> <goal_id> CRASHED at iter N: <error>` | Unexpected exit |
| **ESCALATED** | 🆘 | `🆘 <LoopType> <goal_id> ESCALATED: <reason>` | 3 consecutive failures |

## Threading Convention

- First message (START) creates the thread
- ALL subsequent messages for this loop are THREAD REPLIES to START
- Thread the thread_ts from the START message
- This keeps #jarvis-admin clean — one top-level post per loop

## Cadence Rules

1. **Heartbeat every 5 iterations** OR every 5 minutes (whichever comes first)
2. **Minimum 2 minutes between heartbeats** — NEVER flood
3. **COMPLETE/CRASHED within 60 seconds** of loop exit
4. **BLOCKED posted immediately** when max_iters is hit
5. **ESCALATED posted after 3rd consecutive failure** (don't wait for max_iters)

## Message Format (Full Spec)

### START
```
🚀 <LoopType> loop started
Goal: <goal_id>
Max iters: <N>
PID: <pid>
Started: <ISO timestamp>
```

### HEARTBEAT
```
❤️ <LoopType> <goal_id>
Iter: N/M
Last task: <brief description of what was attempted>
State: <running>
```

### COMPLETE
```
✅ <LoopType> <goal_id> DONE
Total iters: N
Proof: goal/<id>/verification/
done.flag: yes
Completed: <ISO timestamp>
```

### BLOCKED
```
⛔ <LoopType> <goal_id> BLOCKED
Max iters: N reached
Last state: <state.json contents>
Last log: <tail of last iter log>
```

### CRASHED
```
💀 <LoopType> <goal_id> CRASHED
Iter: N
Error: <error message, last 200 chars>
Exit code: <N>
```

### ESCALATED
```
🆘 <LoopType> <goal_id> ESCALATED
Reason: <why it needs human help>
Consecutive failures: 3
Last error: <error>
Recommendation: <what to do>
```

## Anti-Patterns (BANNED)

| Anti-Pattern | Why | Fix |
|-------------|-----|-----|
| Posting to #newleaf-admin | Cardinal 6a28a284 | Use #jarvis-admin ONLY |
| More than 1 msg per 2 min | Floods channel | Batch heartbeats |
| Starting without START message | Silent loop | Always post START |
| Completing without COMPLETE message | No audit trail | Always post COMPLETE |
| Threading replies to wrong START | Confused audit trail | Track thread_ts from START |
| Using Block Kit for heartbeats | Too visually heavy | Plain text for heartbeats |

## Implementation (Python Reference)

```python
SLACK_CHANNEL = 'C0AQDDC3HAB'  # jarvis-admin ONLY

async def slack_start(goal_id, loop_type, max_iters, pid):
    text = f"🚀 {loop_type} loop started\nGoal: {goal_id}\nMax iters: {max_iters}\nPID: {pid}"
    return await send_slack(text)  # returns thread_ts

async def slack_heartbeat(thread_ts, goal_id, loop_type, iter_n, max_iters, last_task):
    text = f"❤️ {loop_type} {goal_id}\nIter: {iter_n}/{max_iters}\nLast task: {last_task}"
    return await send_thread_reply(thread_ts, text)

async def slack_complete(thread_ts, goal_id, loop_type, total_iters, proof_path):
    text = f"✅ {loop_type} {goal_id} DONE\nTotal iters: {total_iters}\nProof: {proof_path}"
    return await send_thread_reply(thread_ts, text)
```

## Integration with Ralph

Ralph's `landing.sh` is called on successful completion. It should:
1. Read state.json for final stats
2. Post COMPLETE message to the Slack thread (thread_ts stored in state.json)
3. Upload proof file path

Future: embed Slack calls directly in runner.sh via stop_hook.

## Integration with Paul

Paul already has built-in Slack at every state transition via `trans()` function:
- `slk()` wraps `slackMcpBridge.send_message` / `send_thread_reply`
- `trans()` posts state transition emoji + ticket info
- Thread per ticket tracked via `_ts` on ticket dict

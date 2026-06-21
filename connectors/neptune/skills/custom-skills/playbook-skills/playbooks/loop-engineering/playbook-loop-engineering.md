---
playbook: loop-engineering
version: 1.0.0
domain: loop-engineering
scope: domain
model_routing:
  default: "anthropic/claude-sonnet-4-20250514"
  reasoning_heavy: "anthropic/claude-sonnet-4-6"
  fast_iteration: "deepseek/deepseek-v4-pro"
auto_load: true
headline: Loop engineering playbook — when to use Ralph vs Paul, Slack reporting contract, state persistence, done detection, dedupe protection
priority: P1
scope_connectors:
  - slack-connector
  - base44-connector
triggers:
  - loop
  - ralph
  - paul
  - long-running
  - sprint
  - coding loop
  - iterate until done
  - autonomous agent
  - agent loop
  - fix loop
workflows:
  - ralph-loop-workflow
  - paul-loop-workflow
description: "Loop engineering SOP — selection matrix for Ralph (long-horizon coding loops) vs Paul (sprint-style GSD), Slack reporting contracts, state persistence, done detection, dedupe protection. When to run autonomous agent loops, how to make them resilient, and how to NOT duplicate them."
intent_tags:
  - loop
  - ralph
  - paul
  - long-running
  - sprint
  - autonomous
  - iterate
  - fix loop
associated_connectors:
  - slack
  - base44
associated_skills:
  - loop-engineering/ralph-loop
  - loop-engineering/paul-loop
  - loop-engineering/slack-reporting
  - loop-engineering/loop-selection-matrix
associated_functions:
  - ralph_dispatch
  - paul_gather
routines_count: 4
type: "playbook"
access: internal
---

# Loop Engineering Playbook

> **Version:** 1.0.0 | **Date:** 2026-06-20 | **Status:** CANONICAL
> **Role:** Master playbook for loop-based autonomous agent execution. Use this to decide which loop pattern to run, how to keep it resilient, and how to prevent duplicates.

---

## 🧠 PRE-CHECK KNOWLEDGE

Before executing any loop, the agent MUST:
- `knowledge://loop-engineering/selection-matrix` — which loop for this task?
- `knowledge://loop-engineering/dedupe-guard` — is one already running?
- `knowledge://loop-engineering/slack-contract` — what to report and where

**Cardinal Rule:** NEVER spawn a loop without first checking for an existing runner on the same goal.

---

## Loop Selection Matrix

| Criterion | Ralph Loop | Paul Loop | Future (Temporal-style) |
|-----------|-----------|-----------|--------------------------|
| **Task type** | Code iteration, fix-plan-driven refactors | Sprint-style GSD, ticket-based HTML/JS builds | Multi-step pipelines with external deps |
| **Horizon** | Long (30-250 iters) | Short (1 run, 3-fix inner loop) | Variable (workflow-as-code) |
| **State** | File-based (goal/<id>/state.json) | Entity-based (JarvisTask in Base44) | Durable execution (exactly-once) |
| **Planning** | Human-written fix_plan.md | AI-generated (K2.6 plans from ticket) | DAG-based step definitions |
| **Dispatch** | POST to localhost:8102/v1/dispatch | Direct Kimi API + Base44 | Temporal SDK / Inngest |
| **Deploy** | Code changes in-repo | Vercel sandbox deploys | Any target |
| **Testing** | VPS-level verification | rigorous_tester.py | Built-in assertions |
| **Slack** | Via landing.sh | Built-in at every state transition | Workflow-level hooks |
| **Resume** | .last_iter file | Fresh each time | Automatic via event sourcing |
| **Dedupe** | PID in state.json | Single-process daemon | Platform-provided |
| **Best for** | Long-horizon greenfield coding | Quick prototype-to-deploy cycles | Production pipelines |
| **Binary path** | /home/hermes/ralph/runner.sh | /home/hermes/brain/claude-sdk/paul_v3.py | N/A (future) |

### Decision Tree

```
Task requires multiple iterations?
├── YES → Is it greenfield code work?
│   ├── YES → RALPH LOOP (/home/hermes/ralph/runner.sh)
│   └── NO → Is it ticket-based with deploy target?
│       ├── YES → PAUL LOOP (/home/hermes/brain/claude-sdk/paul_v3.py)
│       └── NO → Future loop pattern (not yet implemented)
└── NO → Single-shot task — don't use a loop
```

### Quick Reference
- **"I need to iterate on code until tests pass"** → Ralph
- **"Build and deploy this ticket's HTML/JS"** → Paul
- **"I need a long-running agent that self-corrects"** → Ralph
- **"Process these queued tickets"** → Paul

---

## Slack Reporting Contract

### Channel (LOCKED)
**#jarvis-admin (C0AQDDC3HAB)** — per cardinal 6a28a284
**NEVER #newleaf-admin (C096PSS45Q9)** — per cardinal 6a28a284

### Required Messages
| Event | Emoji | Format | When |
|-------|-------|--------|------|
| **LOOP START** | 🚀 | `🚀 <LoopType> loop started: <goal_id> (max N iters)` | At loop launch |
| **HEARTBEAT** | ❤️ | `❤️ <LoopType> <goal_id>: iter N/M, last task: <brief>` | Every 5 iters or 5 min |
| **COMPLETE** | ✅ | `✅ <LoopType> <goal_id> DONE: N iters, done.flag written` + proof path | On done.flag |
| **BLOCKED** | ⛔ | `⛔ <LoopType> <goal_id> BLOCKED: max iters reached` + last state | On max_iters |
| **CRASHED** | 💀 | `💀 <LoopType> <goal_id> CRASHED at iter N: <error>` | On unexpected exit |
| **ESCALATED** | 🆘 | `🆘 <LoopType> <goal_id> ESCALATED: <reason>` | 3 consecutive failures |

### Cadence Rules
- Minimum 2 minutes between heartbeats (never flood)
- Thread ALL messages on the LOOP START message
- Each loop gets ONE Slack thread

---

## State Persistence Contract

### Ralph Loop
```
goal/<id>/
  state.json       ← {goal_id, status, started_at, max_iters, current_iter, pid}
  .last_iter       ← resume checkpoint (single int)
  state.log        ← append-only event log
  done.flag        ← completion signal
  logs/iter_NNN.log ← per-iteration dispatch output
  verification/     ← proof directory
```

### Paul Loop
```
Base44 JarvisTask entity:
  symphonyState   ← queued | dispatching | running | testing | fixing | awaiting_review | blocked | failed | done
  agentTurns       ← total K2.6 calls
  slackThreadTs    ← Slack thread for this ticket
```

### Resume-ability
- **Ralph:** Read `.last_iter` → resume at next iter. State reconstructed from filesystem.
- **Paul:** Polls Base44 for queued tickets. No resume needed (always fresh context per ticket).

---

## Done Detection Contract

### The Canonical Signal
**For Ralph:** `goal/<id>/done.flag` EXISTS → loop stops with exit 0
**For Paul:** `symphonyState = awaiting_review` OR `done` → ticket is complete

### How done.flag Gets Written (Ralph)
1. LLM is instructed: "When ALL items in fix_plan.md are complete, write done.flag"
2. Stop hook (`ralph_stop_hook.py`) checks filesystem state after each dispatch
3. If done.flag exists → `EXIT_COMPLETE` → runner.sh exits 0
4. If verification fails → `EXIT_VERIFICATION_FAILED` → retry same iter
5. If neither → `CONTINUE` → next iter

### Anti-Rationalization Guard
- LLM must cite EVIDENCE (file paths, test output) — not just claim "done"
- Verification directory must contain actual output files (not empty)
- Stop hook sanity check: done.flag exists AND verification/ not empty
- **NEVER trust an LLM that says "I'm done"** — always verify filesystem

---

## Dedupe Protection

### Lessons from the pm2 Ralph-Supervisor Disaster (2026-06-20)
The ralph-supervisor pm2 process was spawning duplicate runners because:
1. PID tracking was race-condition-prone
2. Auto-respawn didn't check if a runner was already active
3. Concurrent limit enforcement was advisory, not hard

### Current Protection (MANDATORY)
1. **PID lock:** runner.sh writes PID to state.json; NEVER spawn if a PID for same goal_id is already running
2. **Pre-spawn check:** `pgrep -f "runner.sh.*<goal_id>"` — if found, abort
3. **NO pm2 supervisor:** ralph-supervisor PERMANENTLY DELETED
4. **NO auto-continue crons:** manual dispatch only
5. **HARD concurrent cap:** MAX 6 Ralph loops total; enforce at spawn time
6. **Supervisor disabled:** loops must be self-contained — no external respawn

### Spawn Checklist
```
[ ] 1. pgrep -f "runner.sh.*<goal_id>" → must return empty
[ ] 2. goal/<id>/pid.lock → must not exist OR PID is dead
[ ] 3. pgrep -cf "runner.sh" → must be < HARD_MAX (6)
[ ] 4. goal/<id>/state.json → status must not be "running"
[ ] 5. goal/<id>/done.flag → must not exist (task already done)
```

---

## Self-Improvement Hook

After every loop completion, the loop MUST write lessons to:
```
/home/hermes/cortex/research/loop-engineering/lessons/<goal_id>-<date>.md
```

Format:
```markdown
# Loop Lessons: <goal_id>

- **Goal:** <one-line description>
- **Loop type:** Ralph | Paul
- **Total iters:** N
- **Success:** YES | NO
- **What worked:** <bullet points>
- **What failed:** <bullet points>
- **Prompt improvements:** <what to change in PROMPT.md / fix_plan.md>
- **Dedupe notes:** <any duplicate-spawn near-misses>
```

---

## Safeguards (LOCKED — NEVER VIOLATE)

1. **NEVER spawn a loop without the 5-point spawn checklist above**
2. **NEVER post loop updates to #newleaf-admin** — only #jarvis-admin
3. **NEVER install new pm2 processes for loops** — loops are self-contained
4. **NEVER trust LLM "done" claims** — verify done.flag + verification/ contents
5. **NEVER exceed HARD_MAX_CONCURRENT (6)** — enforced at spawn
6. **NEVER run more than ONE loop on the same goal_id** — PID lock enforced
7. **ALWAYS report START + COMPLETE/FAILED to Slack** — no silent loops
8. **ALWAYS write lessons after loop completion** — self-improvement is mandatory
9. **NEVER move Ralph or Paul binaries** — playbook REFERENCES paths, doesn't relocate code
10. **RESERVE 50 turns for landing** — don't run out of budget mid-loop

---

## Anti-Patterns (BANNED)

| Anti-Pattern | Why Banned | What To Do Instead |
|-------------|-----------|-------------------|
| Spawning loops via pm2 | Causes duplicate runners | Use runner.sh directly |
| Auto-continue crons | Creates shadow dispatches | Manual dispatch only |
| "I'll check if it's done later" | Silent hang | Slack heartbeat every 5 iters |
| `while true` without max_iters | Infinite loop | Always set max_iters |
| Multiple loops on same goal | Race conditions | PID lock check |
| No verification directory | Can't prove completion | Always create verification/ |
| Slack flood (>1 msg/2min) | Noisy channel | Batch heartbeats |
| Copying Ralph/Paul to new paths | Code drift | Reference, don't move |

---

## Routine: Spawn Ralph Loop

### Pre-Flight
1. Verify NO existing runner for this goal_id: `pgrep -f "runner.sh.*<goal_id>"`
2. Verify under concurrent cap: `pgrep -cf "runner.sh"` < 6
3. Verify goal directory exists with PROMPT.md + fix_plan.md
4. Post to #jarvis-admin: 🚀 Ralph loop started

### Execute
```bash
/home/hermes/ralph/runner.sh <goal_id> <max_iters>
```

### Post-Flight
1. Check exit code: 0 = done, 2 = max_iters
2. Verify done.flag exists (if exit 0)
3. Read verification/ directory for proof
4. Post completion/blocked to Slack thread
5. Write lessons file

---

## Routine: Spawn Paul Loop

### Pre-Flight
1. Verify Base44 has queued tickets: query JarvisTask where symphonyState=queued
2. Start paul_v3.py as a daemon (or run once for specific ticket)
3. Post to #jarvis-admin: 🚀 Paul loop started

### Execute
```bash
python3 /home/hermes/brain/claude-sdk/paul_v3.py
```

### Post-Flight
1. Check Slack thread for state transitions
2. Verify ticket in Base44 moved to awaiting_review or done

---

*End of Loop Engineering Playbook — Version 1.0.0*

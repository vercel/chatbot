---
name: ralph-loop
description: Long-horizon coding loop. Use for: rewriting same logic until tests pass, file-state-driven iteration, fix-plan-driven refactors. Reads goal/<id>/fix_plan.md each iter, picks #1, executes, verifies, repeats.
version: 1.0.0
domain: loop-engineering
priority: P1
triggers:
  - ralph
  - coding loop
  - iterate until done
  - fix loop
  - autonomous coding
  - long-running
binary: /home/hermes/ralph/runner.sh
supervisor: NONE (ralph-supervisor pm2 DELETED 2026-06-20)
max_concurrent: 6
requires:
  connectors: [slack]
  functions: [ralph_dispatch]
---

# Ralph Loop Skill

## Purpose

Ralph is a Bash-based long-horizon coding loop that repeatedly feeds a prompt + fix_plan into Claude Agent SDK until all tasks are complete. It is designed for greenfield code iteration, refactors, and any task where the same logic needs to be rewritten until tests pass.

**Core loop:** `while iter < max_iters; do cat PROMPT.md | claude-code; check done.flag; done`

## Based On

- ghuntley.com/ralph — the Ralph Wiggum loop pattern
- Anthropic Sept 2025 long-running agents harness pattern
- File: `/home/hermes/ralph/runner.sh` (149 lines)
- Helper: `/home/hermes/ralph/bin/ralph_stop_hook.py`
- Landing: `/home/hermes/ralph/bin/landing.sh`

## When to Use Ralph

- ✅ Greenfield coding (new feature, new module)
- ✅ Fix-plan-driven iteration (fix_plan.md with checkbox tasks)
- ✅ Self-correcting refactors (try, test, fix, repeat)
- ✅ Long-horizon tasks (30-250 iterations)
- ✅ File-state-based progress tracking
- ❌ Existing production codebases (Ralph is for greenfield per ghuntley)
- ❌ Quick single-shot tasks (use Paul or direct dispatch)
- ❌ Tasks requiring external API orchestration (use Paul)

## How It Works

### State Model
```
goal/<id>/
  PROMPT.md        ← Instruction for the LLM, read fresh each iter
  fix_plan.md      ← Checkbox task list; LLM picks #1 each iter
  state.json       ← {goal_id, status, started_at, max_iters, current_iter, pid}
  state.log        ← Append-only event log (ISO timestamps)
  .last_iter       ← Resume checkpoint (single integer)
  done.flag        ← Touch file = loop complete
  logs/iter_NNN.log ← Per-iteration dispatch output
  verification/     ← Proof directory (test results, output files)
```

### Execution Flow
1. Validate: goal_dir exists, PROMPT.md + fix_plan.md present
2. Resume: read `.last_iter` file, continue from last completed iter
3. Per iteration:
   a. Update state.json with current iter + PID
   b. POST prompt + fix_plan to `localhost:8102/v1/dispatch`
   c. Run `ralph_stop_hook.py` → CONTINUE | EXIT_COMPLETE | EXIT_VERIFICATION_FAILED
   d. On EXIT_COMPLETE: touch done.flag, write final state, run landing.sh, exit 0
   e. On EXIT_VERIFICATION_FAILED: retry same iter (decrement counter)
   f. On CONTINUE: sleep 5s, next iter
4. Max iters reached: exit 2, post BLOCKED to Slack

### Stop Hook Logic
The stop hook (`ralph_stop_hook.py`) checks:
1. Does `done.flag` exist? → EXIT_COMPLETE
2. Is `verification/` directory empty? → EXIT_VERIFICATION_FAILED
3. Otherwise → CONTINUE

### Dispatch Format
```json
{
  "prompt": "<contents of PROMPT.md>",
  "fix_plan": "<contents of fix_plan.md>",
  "goal_id": "<goal_id>",
  "iter": <N>,
  "max_turns": 25
}
```
POST to `http://localhost:8102/v1/dispatch` with 600s timeout.

## Spawn Checklist (MANDATORY)

```
[ ] 1. pgrep -f "runner.sh.*<goal_id>" → MUST be empty
[ ] 2. goal/<id>/pid.lock → must not exist OR PID is dead
[ ] 3. pgrep -cf "runner.sh" → MUST be < 6 (HARD_MAX)
[ ] 4. goal/<id>/state.json → status must not be "running"
[ ] 5. goal/<id>/done.flag → must not exist
```

## Spawn Command
```bash
/home/hermes/ralph/runner.sh <goal_id> <max_iters>
```

## Slack Contract

See `slack-reporting/SKILL.md` for full contract. Summary:
- 🚀 START: thread in #jarvis-admin
- ❤️ HEARTBEAT: every 5 iters (min 2min apart)
- ✅ COMPLETE: done.flag + proof path
- ⛔ BLOCKED: max_iters reached
- 💀 CRASHED: unexpected exit

## Dedupe Protection

1. **PID lock**: state.json carries PID; check before spawn
2. **Pre-spawn pgrep**: `pgrep -f "runner.sh.*<goal_id>"`
3. **NO supervisor**: ralph-supervisor pm2 DELETED permanently
4. **NO auto-continue crons**: manual dispatch only
5. **HARD concurrent cap**: max 6 Ralph loops

## Lessons from Disaster (2026-06-20)

The ralph-supervisor pm2 process was spawning duplicate runners due to PID tracking bugs. It was DELETED today. The lesson: loops must be self-contained. No external process should ever respawn a loop.

## Self-Improvement

After completion, write lessons to:
```
/home/hermes/cortex/research/loop-engineering/lessons/<goal_id>-<date>.md
```

# Loop Engineering Playbook

**Version:** 1.0.0 | **Priority:** P1 | **Domain:** loop-engineering

## What This Is

The canonical playbook for running autonomous agent loops on the NewLeaf VPS. Covers:
- **Ralph Loop** — long-horizon coding iteration (fix-plan-driven, file-state)
- **Paul Loop** — sprint-style GSD (ticket-based, plan→code→deploy→test→fix)
- **Slack Reporting** — mandatory heartbeat + completion contract
- **Loop Selection Matrix** — when to use which loop

## Quick Start

### Ralph (Long-horizon coding loop)
```bash
/home/hermes/ralph/runner.sh <goal_id> <max_iters>
```

### Paul (Sprint-style GSD)
```bash
python3 /home/hermes/brain/claude-sdk/paul_v3.py
```

## Structure

```
loop-engineering/
├── playbook-loop-engineering.md    ← Master SOP (read this first)
├── manifest.yaml                    ← Dependencies
├── routines.json                    ← Trigger words → routines
├── README.md                        ← You are here
└── skills/
    ├── ralph-loop/SKILL.md          ← Ralph: long-horizon coding
    ├── paul-loop/SKILL.md           ← Paul: sprint-style GSD
    ├── slack-reporting/SKILL.md     ← Shared Slack protocol
    └── loop-selection-matrix/SKILL.md ← Decision tree
```

## Cardinal Rules

1. **NEVER spawn duplicate loops** — PID lock check mandatory
2. **Slack #jarvis-admin ONLY** — never #newleaf-admin
3. **done.flag = completion** — never trust LLM "done" claims
4. **Max 6 concurrent Ralph loops** — enforced at spawn
5. **Always write lessons** — self-improvement is mandatory

## Binaries (Referenced, Not Moved)

- Ralph: `/home/hermes/ralph/runner.sh` + `/home/hermes/ralph/bin/ralph_durable.py`
- Paul: `/home/hermes/brain/claude-sdk/paul_v3.py`

## Lessons Learned

Today's pm2 ralph-supervisor disaster taught us:
- Auto-respawn creates chaos — loops must be self-contained
- PID lock is non-negotiable
- Concurrent limits must be HARD enforced
- Never trust a supervisor that can't distinguish "running" from "stuck"

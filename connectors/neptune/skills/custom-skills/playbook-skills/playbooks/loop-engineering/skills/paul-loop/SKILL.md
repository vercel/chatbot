---
name: paul-loop
description: Sprint-style GSD orchestrator. Use for: ticket-based code generation (HTML/JS), plan→code→deploy→test→fix pipeline, quick prototype-to-deploy cycles. Polls Base44 for queued JarvisTask entities. Uses K2.6 for planning, Vercel for deploy, rigorous_tester.py for verification.
version: 1.0.0
domain: loop-engineering
priority: P1
triggers:
  - paul
  - sprint
  - gsd
  - ticket loop
  - build and deploy
  - sandbox deploy
binary: /home/hermes/brain/claude-sdk/paul_v3.py
max_concurrent: 1
requires:
  connectors: [slack, base44, vercel]
  functions: [jarvisBase44Control, slackMcpBridge]
  secrets: [KIMI_API_KEY, DIAGNOSTICS_API_KEY]
---

# Paul Loop Skill

## Purpose

Paul is a Python-based sprint-style GSD (Getting Stuff Done) orchestrator. It polls Base44 for queued JarvisTask entities and runs a full pipeline: AI planning → code generation → Vercel deploy → automated testing → fix loop.

**Core loop:** Poll every 60s → pick queued ticket → plan with K2.6 → generate HTML/JS → deploy to Vercel → test → fix (max 3 retries) → report to Slack.

## Based On

- PAUL (Plan-Aware Unified Lifecycle) framework
- File: `/home/hermes/brain/claude-sdk/paul_v3.py` (276 lines)
- Planning engine: Kimi K2.6 (via Moonshot API)
- Testing: `/home/hermes/brain/testing/rigorous_tester.py`

## When to Use Paul

- ✅ Ticket-based HTML/JS sandbox builds
- ✅ Quick prototype → deploy → test cycle
- ✅ Processing queued JarvisTask entities
- ✅ Tasks with clear deploy target (Vercel)
- ✅ Sprint-style batch processing
- ❌ Long-horizon code iteration (use Ralph)
- ❌ Multi-file repo refactors (use Ralph)
- ❌ Tasks requiring human approval mid-pipeline

## How It Works

### State Machine (9 States)
```
queued → dispatching → running → testing → fixing → awaiting_review
                                                   → blocked
                                                   → failed
                                                   → done
```

### Execution Flow
1. `gather()`: Query Base44 for queued JarvisTask entities
2. `process(tk)`: Full pipeline for one ticket:
   a. `build_ctx()` → Read AGENTS.md + PRD (if prdPath set)
   b. `do_plan()` → K2.6 thinks, outputs JSON stories with title/acceptance/files
   c. `execute()` → For each story: generate HTML, generate JS, merge, write to sandbox/deploy/
   d. `deploy()` → `npx vercel --prod` (uses VERCEL_TOKEN from /etc/newleaf/.env)
   e. `do_test()` → rigorous_tester.py against deployed URL
   f. If tests pass → `awaiting_review`, post Slack with review prompt
   g. If tests fail → `fix_loop()` up to 3 retries, with regression detection
3. Slack thread per ticket: updates at every state transition

### Fix Loop (Inner)
- Max 3 retries
- Each fix: K2.6 generates complete fixed HTML from failure output
- Regression detection: if pass count DECREASES after fix → rollback + abort
- If all fixes fail → BLOCKED

### Poll Loop (Outer)
- Poll Base44 every 60s
- Graceful shutdown via SIGINT/SIGTERM (SD flag)
- Single-process daemon (no pm2, no supervisor)

## Spawn Command
```bash
python3 /home/hermes/brain/claude-sdk/paul_v3.py
```

## Environment Requirements
- `KIMI_API_KEY` — Moonshot API key for K2.6 model
- `DIAGNOSTICS_API_KEY` — Base44 internal auth token
- `VERCEL_TOKEN` — in /etc/newleaf/.env for deploys

## Slack Contract

See `slack-reporting/SKILL.md` for full contract. Paul's built-in Slack:
- State transitions: emoji + state name + ticket ID + title
- Thread per ticket (first message creates thread, subsequent are replies)
- Review prompt with sandbox URL + test results when awaiting_review

## Dedupe Protection

- Single-process daemon — can't duplicate itself
- No pm2, no supervisor, no cron
- Poll-based (not event-driven) — no race conditions on ticket pickup
- Base44 entity update on pickup → other instances see status change

## Cardinal Constraints

1. **NEVER use Vercel CLI on VPS** — cardinal 6a153d63 (REST API only)
2. **Slack #jarvis-admin ONLY** — C0AQDDC3HAB, never newleaf-admin
3. **Commit author:** abhiswami2121 <abhiswami2121@gmail.com>

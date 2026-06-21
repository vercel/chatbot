---
name: loop-selection-matrix
description: Decision tree for selecting the right loop pattern. Maps task characteristics (horizon, codebase type, deploy needs, state requirements) to the optimal loop. Answers: "Should I use Ralph, Paul, or something else?"
version: 1.0.0
domain: loop-engineering
priority: P0
requires:
  skills: [loop-engineering/ralph-loop, loop-engineering/paul-loop]
---

# Loop Selection Matrix Skill

## Purpose

When someone asks you to run an autonomous agent loop, use this decision tree to pick the right one. Wrong choice = wasted turns, duplicate runners, or a silent hang.

## The Decision Tree

```
START: Task requires multiple iterations?
│
├── NO → Single-shot task
│   └── Use direct dispatch (NOT a loop)
│       Example: "Deploy this PR" → deploy playbook
│       Example: "Fix this one bug" → engineering playbook
│
└── YES → Autonomous loop needed
    │
    ├── Is it greenfield code work?
    │   ├── YES → RALPH LOOP
    │   │   Why: Ralph's fix_plan.md pattern excels at greenfield
    │   │   where the LLM is building from scratch and iterating.
    │   │   Binary: /home/hermes/ralph/runner.sh
    │   │   Max concurrent: 6
    │   │
    │   └── NO → Is it ticket-based with a deploy target?
    │       ├── YES → PAUL LOOP
    │       │   Why: Paul's plan→code→deploy→test pipeline is 
    │       │   perfect for ticket-based sprint work.
    │       │   Binary: /home/hermes/brain/claude-sdk/paul_v3.py
    │       │   Max concurrent: 1
    │       │
    │       └── NO → FUTURE LOOP (not yet implemented)
    │           Why: Multi-step pipelines with external dependencies
    │           need Temporal/Inngest-style durable execution.
    │           For now: break into smaller tasks.
```

## Detailed Comparison

| Dimension | Ralph | Paul | Future |
|-----------|-------|------|--------|
| **Style** | Bash while-loop | Async Python poll loop | Durable execution |
| **Horizon** | 30-250 iters | 1 run (3-fix inner) | Variable |
| **State** | File-based (state.json) | Entity-based (Base44) | Event-sourced |
| **Planning** | Human fix_plan.md | K2.6 AI planning | DAG-defined |
| **Deploy** | In-repo code changes | Vercel sandbox | Any target |
| **Testing** | VPS-level verify | rigorous_tester.py | Built-in assertions |
| **Resume** | .last_iter file | Fresh each time | Automatic |
| **Dedupe** | PID lock | Single daemon | Platform-provided |
| **Concurrency** | Up to 6 | Exactly 1 | Configurable |
| **Best for** | "Rewrite until tests pass" | "Build this ticket's feature" | "Run this pipeline" |

## Decision Examples

### Example 1: "I need to refactor the auth module until all tests pass"
- Multiple iterations? YES
- Greenfield? NO (existing codebase)
- Ticket with deploy? NO
- **Verdict:** Ralph (with caution — Ralph is best for greenfield)

### Example 2: "Build and deploy a landing page for this ticket"
- Multiple iterations? NO (or minimal)
- **Verdict:** Paul — perfect for ticket-based HTML deploy

### Example 3: "Keep iterating on this new microservice until it passes integration tests"
- Multiple iterations? YES
- Greenfield? YES
- **Verdict:** Ralph — ideal use case

### Example 4: "Process all queued dev tickets in a batch"
- Multiple iterations? YES (poll loop)
- Ticket-based? YES
- Deploy target? YES (Vercel sandbox)
- **Verdict:** Paul — built for this

### Example 5: "Run a multi-step data pipeline: extract → transform → load → validate → notify"
- Multiple iterations? NO (single pipeline)
- **Verdict:** Future loop pattern — break into smaller tasks or use a workflow

## Anti-Pattern: Wrong Loop for Wrong Job

| If you... | Problem | Fix |
|-----------|---------|-----|
| Use Ralph for a ticket-based deploy | No deploy pipeline, no testing | Use Paul |
| Use Paul for long-horizon refactor | Max 3 fixes, no iter state | Use Ralph |
| Use either for single-shot task | Wasteful overhead | Direct dispatch |
| Use pm2 to "manage" either | Duplicate runners | NO pm2 — ever |

## Quick Reference by Trigger Word

| User says... | Use... | Binary |
|-------------|--------|--------|
| "iterate until done" | Ralph | runner.sh |
| "keep fixing until it works" | Ralph | runner.sh |
| "coding loop" | Ralph | runner.sh |
| "sprint this ticket" | Paul | paul_v3.py |
| "build and deploy" | Paul | paul_v3.py |
| "process queued tickets" | Paul | paul_v3.py |
| "long running agent" | Ralph | runner.sh |
| "autonomous coding" | Ralph | runner.sh |

## Cardinal Rule

**When in doubt, ask:** "Is this greenfield code iteration (Ralph) or ticket-based feature work (Paul)?" If neither, don't use a loop — use direct dispatch or wait for the Future pattern.

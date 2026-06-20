---
name: to-issues
description: Break a PRD into vertical-slice tickets with blocking dependency analysis. Identify non-blocking tickets for parallel execution. Creates GitHub Issues or Linear issues. Use after /to-prd produces a clean PRD. Trigger: /to-issues, /plan, "create tickets", "break this down"
---

# To Issues

Decompose a PRD into executable, vertical-slice tickets. Each ticket is a thin, end-to-end piece of functionality — never a horizontal layer. Blocking dependencies are explicitly identified so non-blocking tickets can be executed in parallel.

Ported from Matt Pocock's `/to-issues` skill. Replaces monolithic missions with parallelizable, trackable tickets.

## Core Philosophy

> "Find all of the non-blocking tickets and spin up an agent for each one. This is how you parallelize AI development."

## When to Run

- After `/to-prd` produces a clean, approved PRD
- When you need to estimate scope and identify the critical path
- Before handing off to V2 or opening a branch

## Vertical Slicing Rules

### What IS a vertical slice?
A single ticket that touches all layers needed to deliver ONE user-visible behavior:
```
Ticket: "User can view their billing history"
Touches: API route → DB query → UI component → test
```

### What is NOT a vertical slice?
```
✗ Ticket: "Create the billing_history database table"  (horizontal — no user value alone)
✗ Ticket: "Build the billing API client"               (horizontal — no UI)
✗ Ticket: "Design the billing page"                     (horizontal — no backend)
```

### The Stack Test
Does this ticket, when completed by itself, produce something a user can see or interact with? If not, it's horizontal. Merge it with its UI cousin.

## Ticket Structure

Each ticket must have:

```markdown
## {Title} — {One-line what}

**Vertical Slice**: {What user behavior does this enable?}

**Acceptance Criteria** (from PRD end-state description):
- [ ] {Observable, testable condition}
- [ ] {Observable, testable condition}

**States to Cover** (from PRD states & edge cases):
- Loading/empty, normal, error, edge (or N/A if not applicable)

**Blocked By**: {Ticket IDs or NONE}
**Blocks**: {Ticket IDs or NONE}
**Estimated Complexity**: {XS/S/M/L/XL}
**Parallelizable**: {YES if no blocking deps, NO otherwise}

**Test Scenarios**:
- Happy path: {what to test}
- Error path: {what to test}
- Edge case: {what to test}
```

## Dependency Analysis

### Building the dependency graph:
1. List all tickets
2. For each ticket, ask: "Does this depend on another ticket being done first?"
3. If yes → mark as BLOCKED BY that ticket
4. If no blocking deps → mark as PARALLELIZABLE

### The Critical Path
Trace the longest chain of blocking dependencies. This is the minimum time to completion.

### Parallelization Opportunities
All tickets with `Parallelizable: YES` can be executed simultaneously:
- Spin up one agent per parallel ticket
- Each gets its own branch
- Merge independently, in any order

## Output

### Linear/GitHub Issues
Create issues with labels and dependencies:
```bash
# GitHub: use gh issue create
gh issue create --title "..." --body "..." --label "feature,pocock-engineered"

# Linear: use Linear connector
```

### Dependency Diagram (in issue descriptions)
```
Ticket-1 (no deps) ──┐
Ticket-2 (no deps) ──┼──→ Ticket-4 (blocks Ticket-5)
Ticket-3 (no deps) ──┘         │
                               └──→ Ticket-5 → DONE
```

## Anti-Patterns

- **Never create horizontal tickets** — always vertical slices
- **Never create tickets smaller than 1 hour of work** — that's a task, not a ticket
- **Never create tickets larger than 8 hours of work** — that's an epic, not a ticket
- **Never assume serial execution** — always look for parallelization opportunities
- **Never create tickets without acceptance criteria** — "build X" is not a spec

## Integration

- **Input**: `docs/prd-{slug}.md` (required)
- **Output**: GitHub Issues or Linear tickets + dependency graph
- **Next skill**: `/build` (tdd execution) or `/handoff` (pass to V2)

## See Also

- `/to-prd` — required before /to-issues
- `/tdd` — execution discipline for each ticket
- `/handoff` — pass ticket batch to V2
- `/triage` — convert backlog mess into issues

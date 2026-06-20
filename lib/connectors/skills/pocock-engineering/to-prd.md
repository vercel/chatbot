---
name: to-prd
description: Turn resolved grill context into a Product Requirements Document focused on WHAT (end state), not HOW (implementation). Use after /grill produces clean output. Saves PRD to project docs/. Trigger: /to-prd, /prd, "write a PRD", "spec this out"
---

# To PRD

Convert the grilled, resolved context into a Product Requirements Document. The PRD describes the END STATE — what users will experience when the feature is done — not the implementation journey or technical choices.

Ported from Matt Pocock's `/to-prd` skill. Uses grill-output.md as input to ensure all architectural decisions are already made before spec writing begins.

## Core Philosophy

> "Describe the end state. Not the journey. What does the user see? What can they do? What happens when things go wrong? That's the spec."

## When to Run

- After `/grill` produces clean output (unresolved questions ≤ 10)
- When a feature has clear scope and boundaries
- Before creating tickets or handing off to implementation
- When stakeholders need a document to review and approve

## The PRD Structure

### 1. Summary (3 sentences)
What this feature is, who it's for, and why it matters. No technical details. No how. Just what and why.

### 2. End State Description
What the user sees, touches, and experiences when this is done:
- **Happy path**: The ideal user journey in 3-5 steps
- **Entry points**: How do users discover and start using this?
- **Key interactions**: What are the primary actions users take?
- **Outputs**: What does the user get at the end? (saved data, generated artifact, notification, etc.)

### 3. States & Edge Cases
Every state the feature can be in:
- **Loading/empty**: What's shown before any data exists?
- **Active/normal**: The standard working state
- **Error states**: What happens when things go wrong?
- **Edge cases**: Boundary conditions, race conditions, concurrent usage
- **Empty/zero state**: What if there's nothing to show?

### 4. Constraints & Dependencies
- What MUST be true for this to work?
- What external systems does it depend on?
- What permissions/roles are required?
- What existing features does this interact with?

### 5. Success Criteria
- How do we know it works? (observable, measurable)
- What does "done" look like?
- What does "broken" look like?

### 6. Out of Scope
- What are we explicitly NOT building?
- What future work is implied but deferred?
- What alternative approaches were considered and rejected?

## PRD Writing Rules

1. **NO implementation details** — Don't mention files, functions, database tables, or API endpoints. Describe the user-facing behavior.
2. **NO architecture decisions** — Those were made in /grill. Reference grill-output.md if needed.
3. **ONE user at a time** — Describe single-user interactions. Multi-user scenarios are edge cases.
4. **PRESENT TENSE** — "The user clicks Submit" not "The user will click Submit"
5. **CONCRETE examples** — "A notification appears saying 'Your report is ready'" not "User receives feedback"
6. **FAILURE-FIRST thinking** — For every step, ask: "What if this fails?"

## Output

Save to `docs/prd-{feature-slug}.md`:
```markdown
# PRD: {Feature Name}

## Summary
...

## End State
...

## States & Edge Cases
...

## Constraints
...

## Success Criteria
...

## Out of Scope
...
```

## Quality Gate

Before considering the PRD complete:
- [ ] Can a new team member read this and understand what to build?
- [ ] Are all states covered (loading, empty, error, edge)?
- [ ] Does it reference ANY files, functions, or technical choices? (FAIL if yes)
- [ ] Can QA write test cases directly from this document?
- [ ] Are at least 3 edge cases explicitly listed?

## Integration

- **Input**: `grill-output.md` (required), user context
- **Output**: `docs/prd-{slug}.md`
- **Next skill**: `/to-issues` to break into tickets
- **Variant**: If the feature needs UI design, run `/prototype` between grill and PRD

## See Also

- `/grill` — required before /to-prd
- `/prototype` — if design exploration needed before PRD
- `/to-issues` — break PRD into execution tickets
- `/handoff` — pass PRD to V2 for implementation

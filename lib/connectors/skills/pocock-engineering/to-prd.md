---
name: to-prd
description: Turn resolved grill context into a Product Requirements Document focused on WHAT (end state), not HOW (implementation). Use after /grill produces clean output. Saves PRD to project docs/. Trigger: /to-prd, /prd, "write a PRD", "spec this out"
version: 1.0.1
cardinal: 6a37787b
---

# To PRD — Locked 17-Section Template

Convert the grilled, resolved context into a Product Requirements Document. The PRD describes the END STATE — what users will experience when the feature is done — not the implementation journey or technical choices.

Ported from Matt Pocock's `/to-prd` skill. Uses grill-output.md as input to ensure all architectural decisions are already made before spec writing begins.

**⚠️ CARDINAL (6a37787b): This 17-section template is LOCKED. Removing or skipping sections = automatic PRD rejection.**

## Core Philosophy

> "Describe the end state. Not the journey. What does the user see? What can they do? What happens when things go wrong? That's the spec."

## Mandatory Pre-Flight Checklist

Before writing the PRD, the agent MUST complete:

1. **/grill phase** (3-sentence interview, force scope clarity)
   - Output: `jarvis/cortex/missions/<slug>-grill.md`
2. **Discovery phase** — check existing infrastructure:
   - Search codebase for prior art (similar components, existing patterns)
   - Search cortex for relevant skills/PRDs
   - Check recent PRs and commits for related work
   - Output: findings in Section 2 & 3
3. **Enhancement research phase** — document what's NEW:
   - What frameworks/APIs are available that we're not using?
   - What patterns exist in the codebase that can be leveraged?
   - Output: Section 13

## When to Run

- After `/grill` produces clean output (unresolved questions ≤ 10)
- When a feature has clear scope and boundaries
- Before creating tickets or handing off to implementation
- When stakeholders need a document to review and approve

## 🔒 THE 17 REQUIRED SECTIONS

### 1. /grill Summary
3 sentences refined to 1. What this feature is, who it's for, and why it matters. Force-scoped via Pocock /grill interview. No technical details.

### 2. Existing Infrastructure Check
What's already built that we should leverage? (M-N4 cards, fallback chain, existing connectors, prior PRs, relevant cortex skills). Reference specific files and commit SHAs. **NEVER reinvent what already exists.**

### 3. Discovery Findings
Relevant cortex skills + PRs + commits discovered during pre-PRD research. Cross-references to existing documentation. What patterns can be reused?

### 4. Problem Statement
The specific problem this feature solves. Concrete, measurable. Who is affected? How do we know it's a problem? (Data, user feedback, metrics.)

### 5. End State Description (NOT journey)
What the user sees, touches, and experiences when this is done:
- **Happy path**: The ideal user journey in 3-5 steps
- **Entry points**: How do users discover and start using this?
- **Key interactions**: What are the primary actions users take?
- **Outputs**: What does the user get at the end? (saved data, generated artifact, notification, etc.)

### 6. Vertical-Slice Tickets
Per Pocock `/to-issues` decomposition. Each ticket: independent, testable, shippable. With blocking dependencies. Enables parallelization.

### 7. Technical Architecture
High-level architecture diagram/description. Key components, data flow, external dependencies. Reference existing systems. Keep implementation-light — this is WHAT we build, not HOW we code it.

### 8. Schema (if applicable)
Database tables, columns, types, relationships. Migration strategy. Reference existing schema patterns.

### 9. API Contract
Endpoint signatures, request/response samples, auth requirements. OpenAPI-compatible. Include error responses.

### 10. UI Mockups or Component Sketches
Visual representation of the feature. Component hierarchy. States covered (loading, empty, error, edge cases). Can be ASCII art for simple features.

### 11. Acceptance Criteria (Binary, Testable)
Checklist of observable behaviors. Each criterion: PASS/FAIL determinable by a machine or a human without ambiguity. NO subjective measures.

### 12. QA Plan (Explicit)
- **Functional testing**: What to test, how to test it
- **Edge cases**: Boundary conditions list
- **Performance**: Load expectations and thresholds
- **Security**: Threat scenarios and mitigations
- **UX review**: Heuristic evaluation checklist

### 13. Enhancement Research Findings
Per cardinal 6a37787b. What did we learn during research that improves this feature?
- Frameworks/APIs considered and their trade-offs
- Existing patterns that can be leveraged
- Novel approaches worth documenting for future reference

### 14. Risk Registry
| Risk | Probability | Impact | Mitigation | Owner |
|------|------------|--------|------------|-------|
| ... | Low/Med/High | Low/Med/High | ... | ... |

### 15. Timeline (Vertical Slices, Not Hours)
Phased delivery plan. Each phase is a vertical slice (independently shippable). No hourly estimates — use T-shirt sizes (S/M/L/XL).

### 16. Out of Scope
What are we explicitly NOT building? What future work is implied but deferred? What alternative approaches were considered and rejected?

### 17. Success Metrics
How do we measure success? Observable, measurable indicators. Include baseline (current state) and target (post-launch).

## PRD Writing Rules

1. **NO implementation details** — Don't mention files, functions, database tables, or API endpoints. Describe the user-facing behavior. (Exception: Sections 7-9 for technical architecture)
2. **NO architecture decisions without grill** — Those were made in /grill. Reference grill-output.md if needed.
3. **ONE user at a time** — Describe single-user interactions. Multi-user scenarios are edge cases.
4. **PRESENT TENSE** — "The user clicks Submit" not "The user will click Submit"
5. **CONCRETE examples** — "A notification appears saying 'Your report is ready'" not "User receives feedback"
6. **FAILURE-FIRST thinking** — For every step, ask: "What if this fails?"
7. **REFERENCE EXISTING INFRA FIRST** — Check M-N4 cards, fallback chain, existing connectors before proposing new ones

## Output

Save to `jarvis/cortex/prd/<slug>.md`:
```markdown
# PRD: {Feature Name}

## 1. /grill Summary
## 2. Existing Infrastructure Check
## 3. Discovery Findings
## 4. Problem Statement
## 5. End State Description
## 6. Vertical-Slice Tickets
## 7. Technical Architecture
## 8. Schema
## 9. API Contract
## 10. UI Mockups
## 11. Acceptance Criteria
## 12. QA Plan
## 13. Enhancement Research Findings
## 14. Risk Registry
## 15. Timeline
## 16. Out of Scope
## 17. Success Metrics
```

## Quality Gate

Before considering the PRD complete:
- [ ] All 17 sections present? (FAIL if any missing)
- [ ] Can a new team member read this and understand what to build?
- [ ] Are all states covered (loading, empty, error, edge)?
- [ ] Does Section 2 reference specific existing files/patterns? (FAIL if generic)
- [ ] Does Section 13 cite at least 1 framework/API considered?
- [ ] Can QA write test cases directly from Section 11?
- [ ] Are at least 3 edge cases explicitly listed?
- [ ] Did /grill produce clean output before this PRD was started? (FAIL if not)

## Integration

- **Input**: `grill-output.md` (required), user context, discovery findings
- **Output**: `jarvis/cortex/prd/<slug>.md`
- **Next skill**: `/to-issues` to break into tickets
- **Variant**: If the feature needs UI design, run `/prototype` between grill and PRD

## See Also

- `/grill` — required before /to-prd
- `/prototype` — if design exploration needed before PRD
- `/to-issues` — break PRD into execution tickets
- `/handoff` — pass PRD to V2/VPS for implementation
- `/improve-codebase-architecture` — find existing patterns to leverage
- Cardinal 6a37787b — Enhancement Research requirement

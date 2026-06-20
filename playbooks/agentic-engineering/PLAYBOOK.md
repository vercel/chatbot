---
playbook: agentic-engineering
version: "1.0.0"
domain: agentic-engineering
priority: P0
model_routing:
  default: "anthropic/claude-sonnet-4-7"
  coding: "anthropic/claude-sonnet-4-7"
  reasoning_heavy: "anthropic/claude-opus-4-7"
  fast_iteration: "anthropic/claude-haiku-4-7"
type: "playbook"
access: internal
---

# Agentic Engineering — Master Playbook

> **Version:** 1.0.0 | **Date:** 2026-06-20 | **Status:** ACTIVE
> **Priority:** P0 (engineering methodology)
> **Framework:** Matt Pocock's 7-Phase Agentic Engineering
> **Key Innovation:** Automated Grill — self-answering design tree via codebase exploration
> **Playbook ID:** agentic-engineering

---

## Executive Summary

This playbook implements Matt Pocock's 7-phase agentic engineering framework within Neptune Chat. Every feature flows through: Idea → Grill → Research → Prototype → PRD → Plan → Build → QA. The KEY INNOVATION is the **Automated Grill** — the agent explores the codebase, checks git history, reads docs, and inspects connected services to self-answer design tree questions, presenting only truly unanswerable questions to the human.

Trigger words: `/build-feature`, `/new-feature`, `/engineer`, `/pocock`, `/7-phase`, `/agentic`

---

## Operational Context

### Primary Use Case
When the user asks to build a new feature, implement a PRD, add functionality, or ship any code change, this playbook provides the complete 7-phase delivery framework — from initial idea through production QA. It replaces ad-hoc "PRD → VPS mission → hope it works" with a structured, phase-gated pipeline.

### Domain Scope
Feature ideation, design tree exploration, external dependency research, UI/UX prototyping, product requirements documentation, task decomposition (Kanban), test-driven implementation, and quality assurance. Covers the full lifecycle from "I have an idea" to "it's in production and verified."

### The 7-Phase Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. GRILL         →  Automated design tree, self-answered        │
│ 2. RESEARCH      →  External deps, API docs (if needed)         │
│ 3. PROTOTYPE     →  Throwaway UI/design exploration (if needed) │
│ 4. PRD           →  End-state spec, WHAT not HOW                │
│ 5. PLAN          →  Vertical-slice tickets, dependency graph    │
│ 6. BUILD         →  TDD execution, one commit per ticket        │
│ 7. QA            →  Structured verification, feedback loop      │
└─────────────────────────────────────────────────────────────────┘
```

### Quality Gates
Each phase has an explicit gate:
- **GRILL → RESEARCH gate:** Design tree ≥ 80% resolved, unresolved ≤ 10 questions
- **RESEARCH → PROTOTYPE gate:** External dependencies documented, API contracts verified
- **PROTOTYPE → PRD gate:** Design direction chosen (user picked winner), throwaway routes deleted
- **PRD → PLAN gate:** PRD describes end state only (no implementation), all states covered
- **PLAN → BUILD gate:** Tickets are vertical slices, blocking deps mapped, non-blocking tickets flagged
- **BUILD → QA gate:** All tests pass, TypeScript strict zero errors, code reviewed
- **QA → DONE gate:** QA plan executed, issues filed as new tickets, human sign-off

---

## Standard Operating Procedure

### Phase 1: GRILL (Automated)

**Skill:** `/grill` (see `lib/connectors/skills/pocock-engineering/automated-grill.md`)
**Engine:** `lib/connectors/skills/pocock-engineering/automated-grill.ts`

The grill is MANDATORY before any feature work. It operates in 3 modes:

1. **Self-Grill (default):** Engine explores codebase, git history, docs, and config to self-answer design tree questions. 30-60 seconds, zero human input needed.
2. **Multi-Agent Grill:** Routes questions to V2 (codebase), connectors (APIs), and Base44 (data). Aggregates answers.
3. **Human-in-the-Loop:** Only for business decisions, design taste, and budget questions. Max 5-10 questions.

**Process:**
1. Generate design tree from feature description (purpose, codebase impact, dependencies, contract, risk, testing)
2. For each question, attempt self-answer via: codebase grep, git log, doc search, config inspection
3. Classify each question: RESOLVED (with evidence citation) or UNRESOLVED
4. Compile grill output as `grill-output.md`
5. Present only UNRESOLVED questions to human (if any)

**Output:** `grill-output.md` with decision tree, resolved questions with evidence, unresolved questions, risk register.

**Gate:** Unresolved ≤ 10 questions → proceed. If > 10, re-grill or switch to HUMAN_IN_LOOP.

### Phase 2: RESEARCH (External Dependencies)

**Skill:** `/grill-with-docs` (see `lib/connectors/skills/pocock-engineering/grill-with-docs.md`)

Only run if the feature has external dependencies (new APIs, libraries, services). Skip for purely internal features.

**Process:**
1. Identify external dependencies surfaced during grill
2. Research API documentation, SDK APIs, integration patterns
3. Cache findings in `docs/research-{feature}.md`
4. Document API contracts, rate limits, auth requirements, error modes
5. Mark research with expiry date (sprint duration — stale research causes wrong turns)

**Output:** `docs/research-{feature}.md` — ephemeral, expires after sprint.

**Gate:** All external dependencies documented and contracts verified.

### Phase 3: PROTOTYPE (Design Exploration)

**Skill:** `/prototype` (see `lib/connectors/skills/pocock-engineering/prototype.md`)

Only run if the feature has UI/UX uncertainty. Skip for pure backend/API features.

**Process:**
1. Create 2-3 throwaway routes: `/prototype-{feature}-v1`, `/prototype-{feature}-v2`, `/prototype-{feature}-v3`
2. Each prototype uses fake data, no API, standalone route
3. Present variations to user — user picks winner
4. Commit winning design patterns, DELETE all prototype routes

**Output:** Winning design committed, throwaway routes removed.

**Gate:** Design direction chosen, prototype routes deleted from repo.

### Phase 4: PRD (Product Requirements Document)

**Skill:** `/to-prd` (see `lib/connectors/skills/pocock-engineering/to-prd.md`)

**CRITICAL RULE:** The PRD describes the END STATE — what users see and experience. It does NOT describe HOW to build it. No file names, no function names, no architecture decisions. Those live in the grill output.

**Process:**
1. Load `grill-output.md` for all resolved decisions
2. Write PRD with: summary (3 sentences), end-state description, all UI states (loading/empty/error/edge), constraints, success criteria, out of scope
3. Reference grill-output.md for decisions, prototype winner for design
4. Save to `docs/prd-{feature-slug}.md`

**Output:** `docs/prd-{feature-slug}.md`

**Gate:** A new team member can read the PRD and understand WHAT to build without asking questions.

### Phase 5: PLAN (Task Decomposition)

**Skill:** `/to-issues` (see `lib/connectors/skills/pocock-engineering/to-issues.md`)

**CRITICAL RULE:** Every ticket must be a VERTICAL SLICE — touching all layers (API → DB → UI) for ONE user-visible behavior. NEVER create horizontal tickets (e.g., "create the database table" alone).

**Process:**
1. Decompose PRD into vertical-slice tickets
2. Each ticket: title, acceptance criteria, states to cover, estimated complexity (XS/S/M/L/XL)
3. Build dependency graph: which tickets block which?
4. Flag all non-blocking tickets for PARALLEL execution
5. Create GitHub Issues or Linear cards with labels and dependencies

**Output:** GitHub Issues or Linear tickets + dependency diagram.

**Gate:** All tickets are vertical slices, blocking deps mapped, parallelization opportunities identified.

### Phase 6: BUILD (Test-Driven Implementation)

**Skill:** `/tdd` (see `lib/connectors/skills/pocock-engineering/tdd.md`)
**Handoff:** `/handoff` to V2 (see `lib/connectors/skills/pocock-engineering/handoff.md`)

**CRITICAL RULE:** Red-Green-Refactor. ALWAYS write a failing test FIRST. Then implement. Then refactor. One commit per ticket.

**Process:**
1. For each ticket, start from the TOP of the dependency graph (unblocked tickets first)
2. 🔴 RED: Write a FAILING test that captures the acceptance criteria
3. 🟢 GREEN: Write the minimal implementation to make the test pass
4. 🔵 REFACTOR: Extract duplication, add types, improve error handling
5. Commit with message: `feat({scope}): {ticket title}`
6. Run full test suite — all tests must pass
7. TypeScript strict: zero errors
8. For parallel tickets: spin up separate V2 sessions, merge independently

**Handoff to V2:**
Use `/handoff` to generate a V2-ready prompt with:
- Tickets with acceptance criteria
- Repo context (key files, patterns to follow)
- Test expectations
- Architecture hints and known pitfalls
- TDD discipline enforced

**Output:** Working code + passing tests + clean types.

**Gate:** All tests pass, TypeScript strict zero errors, code reviewed, all tickets committed.

### Phase 7: QA (Quality Assurance)

**CRITICAL RULE:** QA is EXPECTED to find issues. New tickets from QA findings is HEALTHY and NORMAL. It is not failure — it's iteration.

**Process:**
1. Generate structured QA plan from the PRD's states & edge cases
2. List specific test scenarios: happy path, error path, edge cases, performance, security
3. Execute QA plan:
   - Automated: Integration tests, E2E tests, type checking
   - Manual: Visual review, UX walkthrough, edge case exploration
4. Document findings:
   - PASS: Works as expected
   - ISSUE: Bug or missing behavior → create new ticket
   - IMPROVEMENT: Works but could be better → create backlog item
5. File new tickets for issues found
6. Loop back to Phase 5 (PLAN) if issues block release

**Output:** QA report + new tickets for issues.

**Gate:** Critical/high issues resolved, human sign-off, new tickets filed for remaining issues.

---

## Anti-Patterns (LOCKED)

- **NEVER skip the GRILL phase** — building without a design tree produces the wrong thing
- **NEVER write a PRD without grilling first** — the PRD will miss edge cases and dependencies
- **NEVER create horizontal tickets** — always vertical slices (API + DB + UI for one behavior)
- **NEVER implement without a failing test first** — TDD is non-negotiable in Phase 6
- **NEVER skip QA** — QA is expected to find issues; finding none means QA was insufficient
- **NEVER ship a prototype** — delete throwaway routes before merging
- **NEVER keep stale research** — research assets expire after the sprint
- **NEVER handoff without structured context** — use /handoff, not Slack dumps
- **NEVER ask humans questions the codebase can answer** — automated grill first, human fallback only
- **NEVER mix feature work with refactoring** — separate branches, separate PRs

---

## Safeguards

1. **Automated Grill** — Codebase exploration prevents unnecessary human questions
2. **Phase Gates** — Each phase must pass its quality gate before the next begins
3. **Evidence-Anchored Decisions** — Every grill answer requires a citation (file, commit, doc)
4. **Throwaway Prototypes** — Design exploration without polluting the repo
5. **Vertical Slicing** — Every ticket delivers user-visible value
6. **TDD Discipline** — Red-Green-Refactor cycle enforced for all code
7. **Structured Handoff** — V2 sessions receive complete, executable context
8. **QA Feedback Loop** — Issues found in QA become new tickets, not fire drills

---

## Integration Points

### Neptune Chat (Planning & Coordination)
- **Input:** User intent, feature requests, PRD approvals
- **Output:** Grill output, PRDs, tickets, QA plans
- **Skills:** /grill, /grill-with-docs, /prototype, /to-prd, /to-issues, /qa

### Neptune V2 (Coding & Implementation)
- **Input:** Handoff documents with tickets and repo context
- **Output:** Working code, passing tests, PRs
- **Skills:** /tdd, /improve-codebase-architecture
- **Bridge:** `lib/v2/bridge.ts`

### Base44 (Data & Entities)
- **Input:** Entity queries, customer data, reporting
- **Output:** Data context for grill and PRD decisions
- **Connector:** `connectors/base44/`

### GitHub (Version Control)
- **Input:** PRs, branches, code review
- **Output:** Merged features
- **Connector:** `connectors/github/`

### Linear (Task Tracking)
- **Input:** Tickets from Phase 5
- **Output:** Task status, assignments
- **Connector:** `connectors/linear/`

---

## Skill Reference

All skills live in `lib/connectors/skills/pocock-engineering/`:

| Skill | File | Purpose | Phase |
|-------|------|---------|-------|
| automated-grill | `automated-grill.md` | Design tree + self-answer | 1 |
| grill-with-docs | `grill-with-docs.md` | Domain-driven grill + research | 2 |
| prototype | `prototype.md` | Throwaway UI/UX exploration | 3 |
| to-prd | `to-prd.md` | End-state product requirements | 4 |
| to-issues | `to-issues.md` | Vertical-slice task decomposition | 5 |
| tdd | `tdd.md` | Red-Green-Refactor implementation | 6 |
| improve-codebase-architecture | `improve-codebase-architecture.md` | Deep module refactoring | 6+ |
| handoff | `handoff.md` | V2 context compression | 6-7 |

**Engines:**
- `lib/connectors/skills/pocock-engineering/automated-grill.ts` — Self-answering grill engine
- `lib/connectors/skills/pocock-engineering/handoff.ts` — V2 handoff generator

---

## Metrics & Health

- **Grill Self-Resolution Rate:** percentage of design tree questions self-answered (target: ≥ 80%)
- **Prototype Usage Rate:** percentage of features using prototype phase (target: UI features 100%)
- **PRD Gate Pass Rate:** percentage of PRDs passing "new person can understand" test
- **Ticket Vertical-Slice Rate:** percentage of tickets that are true vertical slices (target: 100%)
- **TDD Compliance:** percentage of tickets with test-first commits (target: 100%)
- **QA Issue Discovery Rate:** average issues found per QA phase (target: > 0 — zero means QA insufficient)
- **Handoff Success Rate:** percentage of V2 sessions completing without context clarification
- **Cycle Time:** total time from Phase 1 (GRILL) to Phase 7 (QA DONE)
- **Re-grill Rate:** percentage of features requiring re-grill (target: < 20%)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-20 | Initial release — 7-phase framework, automated grill, V2 handoff |

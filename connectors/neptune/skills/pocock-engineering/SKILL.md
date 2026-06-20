# Pocock Engineering Framework — Master Playbook

**Version:** 1.0.0 | **Domain:** pocock-engineering | **Actions:** 10
**Based on:** Matt Pocock's Agentic Engineering Deep Analysis (2026-06-20)

## 7-Phase Engineering Cycle

```
/grill → /research → /prototype → /to-prd → /to-issues → /tdd → /qa
                                                          ↘ /handoff
```

### Phase Flow Rules
- **/grill** is MANDATORY before any build phase
- **/research** and **/prototype** are SKIPPABLE if scope is well-understood
- **/tdd** runs in parallel with /to-issues implementation
- **/qa** is MANDATORY before any PR merge
- **/handoff** runs at session end to preserve context

### Skip Rules
- Skip /research if: task is in existing codebase, well-known domain, <4 hours
- Skip /prototype if: design is confirmed, no unknown dependencies
- NEVER skip /grill or /qa

## Skills

### /grill
"Interview me relentlessly. Walk down each decision tree branch. If a question can be answered by exploring the code base, explore the code base instead."

### /research
"Create RESEARCH.md cache for this sprint. Document external dependencies, API versions, breaking changes. Expire after sprint end."

### /prototype
"Build throwaway route to test design hypothesis. Multiple variations. Pick winner. Discard rest. Speed over correctness."

### /to-prd
"Generate PRD focused on END STATE not journey. Reference /grill outputs. Include: problem, solution, architecture decisions, acceptance criteria."

### /to-issues
"Decompose PRD into vertical-slice tickets with blocking dependencies. Each ticket: independent, testable, shippable. Enables parallelization."

### /tdd
"Red → Green → Refactor. Write failing test FIRST. Then minimum implementation. Then refactor. Never write implementation before test."

### /handoff
"Compress context to markdown doc. Use pointers to artifacts (PRD, issues, research). Suggest next-session skills. Keep under 500 lines."

### /qa
"Structured QA plan + human review checklist. Expect to find issues = healthy. Categories: functional, edge cases, performance, security, UX."

### /grill-with-docs
"/grill + Domain-Driven Design + ubiquitous language. Explore codebase for domain concepts. Build shared vocabulary before implementation."

### /improve-codebase-architecture
"Find deepening opportunities in existing code. Identify refactor candidates. Flag architectural drift. Suggest pattern consolidation."

## Intent Classification Rules

| User says | Route to | Phase |
|-----------|----------|-------|
| "research X", "find out about X" | /research | 2 |
| "analyze X", "audit X", "understand X" | /grill | 1 |
| "build X", "implement X" (complex) | /grill → /to-prd → /to-issues → /tdd → /qa | 1→3→4→6→7 |
| "build X", "implement X" (simple) | /grill → /tdd → /qa | 1→6→7 |
| "prototype X", "try X", "spike X" | /prototype | 3 |
| "plan X", "break down X" | /to-issues | 5 |
| "test X", "verify X" | /qa | 7 |
| "improve codebase", "refactor X" | /improve-codebase-architecture | any |

## Phase 0 Grill (MANDATORY)

Every mission dispatched from VPS must go through Phase 0:
- Interview the mission spec
- Identify unresolved questions
- Explore codebase for answers
- Output: `jarvis/cortex/missions/<slug>-grill.md`

## Phase N QA (MANDATORY)

Every mission must end with:
- Structured QA plan
- Run tests against acceptance criteria
- Output: `jarvis/cortex/missions/<slug>-qa.md` with PASS/FAIL/ISSUES_FOUND
- Issues found → create JarvisTask for fix mission

## Anti-Patterns

- ❌ Skipping /grill because "it's obvious"
- ❌ Writing implementation before tests in /tdd
- ❌ Creating PRD without /grill outputs
- ❌ Deploying without /qa pass
- ❌ Context loss between sessions — always /handoff

## Safeguards

- /grill output must be reviewed before proceeding to build
- /qa must show PASS on all acceptance criteria before merge
- /handoff must be run at end of every session
- All 10 skills are idempotent — safe to re-run

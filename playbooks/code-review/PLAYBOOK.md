---
playbook: code-review
version: "1.0.0"
domain: code-review
priority: P1
model_routing:
  default: "deepseek/deepseek-v4-pro"
  reasoning_heavy: "anthropic/claude-sonnet-4-6"
  coding: "deepseek/deepseek-v4-pro"
  fast_iteration: "deepseek/deepseek-v4-flash"
type: "playbook"
access: internal
---

# Code Review — Master Playbook

> **Version:** 1.0.0 | **Date:** 2026-06-13 | **Status:** ACTIVE
> **Priority:** P1 (code quality gate)
> **Architecture:** V5 Domain-Driven Skill Architecture
> **Playbook ID:** code-review

---

## Executive Summary

The Code Review domain provides a structured framework for reviewing source code changes with a focus on correctness, security, performance, maintainability, and adherence to established patterns. Every code review follows a 6-pillar methodology that systematically evaluates each aspect of the change, producing actionable findings organized by severity.

## Operational Context

### Primary Use Case
When code changes are ready for review — whether from PRs, direct commits, self-code operations, or V2 agent output — this playbook provides the review framework. The agent evaluates changes against project conventions, identifies bugs and security issues, and produces a structured REVIEW.md document with severity-classified findings.

### Domain Scope
Pull request review, commit review, self-code review (before deploy), V2 agent output review, security audit, code quality assessment, pattern compliance checking, regression risk analysis, test coverage evaluation, and documentation completeness review.

### Six-Pillar Methodology
1. **Correctness** — Does the code do what it claims? Are there logic errors, off-by-one bugs, null pointer risks, race conditions?
2. **Security** — Are there injection vulnerabilities, exposed secrets, broken auth checks, data leak paths?
3. **Performance** — Are there N+1 queries, missing indexes, unnecessary serialization, blocking I/O, memory leaks?
4. **Maintainability** — Is the code readable, well-named, properly commented, and structured for future changes?
5. **Pattern Compliance** — Does it follow existing project patterns, conventions, and architecture decisions?
6. **Testing** — Are there appropriate tests? Do they cover edge cases and failure modes?

### Severity Classification
- **critical** — Security vulnerability, data loss risk, production crash path. Must fix before merge.
- **high** — Logic bug with user impact, performance regression, broken feature. Should fix before merge.
- **medium** — Code quality issue, missing test, minor pattern deviation. Fix in follow-up.
- **low** — Style nit, naming suggestion, optional improvement. At author's discretion.
- **info** — Observation, note, suggestion for future consideration.

## Standard Operating Procedure

### Stage 1: Scope Assessment
1. Identify the files changed and their roles in the codebase
2. Understand the purpose of the change from the PR description, commit messages, or user intent
3. Determine the review depth: quick scan (trivial changes), standard (typical PRs), or deep audit (security-sensitive, core infrastructure)
4. Check if the change has associated tests, documentation updates, or migration files

### Stage 2: Context Loading
1. Read the changed files in full — do not review diffs in isolation
2. Read any referenced files to understand the broader context
3. Check the Knowledge Graph for known patterns or anti-patterns related to the changed area
4. Review any linked issues, PRDs, or design docs that provide intent

### Stage 3: Pillar-by-Pillar Analysis
1. **Correctness** — Trace every code path with edge case inputs. Check null/undefined handling, error propagation, type safety, race conditions, off-by-one errors.
2. **Security** — Check for unsanitized user input, exposed secrets (.env, credentials), missing auth checks, injection vectors (SQL, XSS, command), insecure defaults.
3. **Performance** — Look for N+1 database queries, missing database indexes, unnecessary API calls, large allocations, synchronous blocking in async paths, missing caching opportunities.
4. **Maintainability** — Evaluate naming clarity, function/component size, cyclomatic complexity, DRY violations, magic numbers, dead code, unclear comments.
5. **Pattern Compliance** — Compare against closest analogous code in the project. Check for existing utility functions that should have been reused. Verify imports follow project conventions.
6. **Testing** — Check for test coverage of the changed paths, edge case tests, error path tests, and integration tests. Verify test assertions actually test meaningful behavior.

### Stage 4: Finding Documentation
For each finding, document:
- **Severity** (critical/high/medium/low/info)
- **Category** (correctness/security/performance/maintainability/pattern/testing)
- **Location** (file path and line range)
- **Issue** — concise description of the problem
- **Recommendation** — specific, actionable fix guidance
- **Evidence** — code snippet or reference supporting the finding

### Stage 5: Structured Output
1. Aggregate all findings into a REVIEW.md document
2. Group by severity (critical first) then by file
3. Include a summary section with counts per severity
4. Add a verdict: APPROVE (no blocking issues), APPROVE_WITH_SUGGESTIONS (non-blocking issues only), or CHANGES_REQUESTED (blocking issues present)
5. If CHANGES_REQUESTED, clearly list which findings must be addressed

### Stage 6: Review Delivery
1. If reviewing a PR, post findings as a PR review (not a comment — review body)
2. If reviewing via chat, present a summary with the verdict and link to the full REVIEW.md
3. For self-code operations, the review is a gate before deploy — must be APPROVE or APPROVE_WITH_SUGGESTIONS
4. Record the review outcome in the Knowledge Graph for pattern learning

## Anti-Patterns (LOCKED)

- **NEVER approve a PR without reading the full files** — diffs in isolation hide context
- **NEVER skip the security pillar** — every review must check for security issues regardless of scope
- **NEVER review a PR without understanding its purpose** — read the description and linked issues first
- **NEVER use subjective language in findings** — every finding must cite specific code and objective criteria
- **NEVER approve code that introduces tech debt without justification** — new patterns must be intentional
- **NEVER skip reviewing tests** — untested code is incomplete code
- **NEVER review your own code as the sole reviewer** — self-review is supplemental, not sufficient
- **NEVER block a PR on stylistic preferences** — style nits are info/low unless they cause confusion

## Safeguards

1. **Security-first triage** — security findings always trump style findings in priority
2. **Minimum review depth** — even "quick" reviews must check all 6 pillars at a surface level
3. **Evidence requirement** — every finding above "info" severity must cite specific code
4. **Timeliness** — reviews should be completed within the SLA appropriate to the change urgency
5. **Knowledge preservation** — patterns identified during review feed back into the KG

## Integration Points

### GitHub
- PR review creation via GitHub API
- Inline comments on specific diff lines
- Review state management (approve, request changes, comment)

### Knowledge Graph
- Query for component patterns: `knowledge://patterns/{component-name}`
- Query for known anti-patterns: `knowledge://anti-patterns/{category}`
- Record review findings: `knowledge://code-review/findings/{review-id}`

### File System
- Read source files for context
- Read project conventions from CLAUDE.md, NEPTUNE.md, and docs/
- Write REVIEW.md to the project root or .planning/ directory

## Metrics & Health

- **Review coverage:** percentage of PRs that receive structured review
- **Finding distribution:** counts per severity level
- **Blocking finding rate:** percentage of reviews with CHANGES_REQUESTED
- **Review turnaround time:** time from PR open to review completion
- **Security finding rate:** security issues found per 1000 lines reviewed
- **Pattern compliance score:** percentage of code matching established project patterns
- **Post-merge regression rate:** bugs found after merge that review missed

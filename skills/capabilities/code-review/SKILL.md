---
name: code-review
version: 1.0.0
kind: capability
primary_domain: coding
headline: |
  Structured code review technique. Checks correctness, security, performance, and style.
type: "skill"
access: internal
---

# Code Review Capability

## Technique
1. Read the diff holistically — understand the "why" before the "what"
2. Check correctness: does it solve the stated problem?
3. Check security: any injection vectors, secret leaks, auth bypasses?
4. Check performance: N+1 queries, unbounded loops, memory leaks?
5. Check style: matches existing patterns? types complete? error handling?
6. Produce REVIEW.md with severity (BLOCKER/HIGH/MEDIUM/LOW)

## Anti-Patterns
- Never review without reading the full diff context
- Never approve PRs with unresolved BLOCKER findings

## Safeguards
- All findings must include file path + line number
- BLOCKER findings must include suggested fix

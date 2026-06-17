---
name: code-review
description: Reviews code changes and provides actionable feedback. Use when the user asks to review a PR, diff, commit, or code changes. Triggers on /review, review this PR, review my changes, code review. Shared across all agents.
version: 1.0.0
type: "skill"
---

# Code Review — Cross-Agent Code Review Engine (Shared)

Reviews code changes and provides actionable feedback. Works across both Chat and V2 agents.

## When to Use

- Review pull requests
- Audit uncommitted changes
- Review specific commits
- Compare branches for review

## Review Modes

1. **No arguments**: Review all uncommitted changes (`git diff`, `git diff --cached`)
2. **Commit hash**: Review specific commit (`git show $ARGUMENTS`)
3. **Branch name**: Compare current branch to specified (`git diff $ARGUMENTS...HEAD`)
4. **PR URL/number**: Review pull request (`gh pr view $ARGUMENTS`, `gh pr diff $ARGUMENTS`)

## Review Dimensions

### Security
- Exposed secrets or API keys
- SQL injection vectors
- XSS vulnerabilities
- Authentication bypass risks

### Performance
- N+1 queries
- Unnecessary re-renders
- Missing memoization
- Large bundle additions

### Correctness
- Logic errors and edge cases
- Off-by-one errors
- Race conditions
- Error handling gaps

### Maintainability
- Naming conventions
- DRY violations
- Code organization
- Documentation coverage

### Testing
- Missing test coverage for critical paths
- Brittle or flaky tests
- Over-mocked tests that don't catch regressions

## Output Format

Each finding includes:
- **Severity**: critical, high, medium, low
- **File**: Path and line number
- **Issue**: What's wrong
- **Fix**: Suggested resolution with code snippet

## Shared Across Agents

This skill is shared across both Chat (neptune-chat) and V2 (neptune-v2) agents.
Both agents load it from `shared-skills/code-review/SKILL.md`.

---
name: improve-codebase-architecture
description: Find deepening opportunities in the codebase. Make modules deeper (more functionality behind simpler interfaces). Identify refactoring opportunities, dead code, and architectural drift. Run after every 5 features or when the codebase feels resistant to change. Trigger: /improve-architecture, /deepen, /refactor-review
---

# Improve Codebase Architecture

Systematically scan the codebase for "deepening" opportunities — making modules deeper (more functionality, simpler interface) — and architectural improvements. Based on the concept from "A Philosophy of Software Design" (Ousterhout): deep modules hide complexity behind simple interfaces, while shallow modules expose complexity.

Ported from Matt Pocock's `/improve-codebase-architecture` skill. Essential for maintaining agent-friendly codebases — because "bad codebases make bad agents."

## Core Philosophy

> "Deep modules = more functionality behind a simpler interface. Every time you add a feature, ask: did this module get deeper or just wider?"

## The Deep Module Test

For any module/function/component, score it on two axes:
- **Interface complexity** (lower is better): How many parameters, config options, and edge cases does the caller need to know?
- **Functionality provided** (higher is better): How much does this module actually do for the caller?

```
DEEP (good):     Simple interface, lots of functionality  ← target
SHALLOW (bad):   Complex interface, little functionality  ← refactor
WIDE (ok):       Simple interface, little functionality   ← acceptable
NARROW (bad):    Complex interface, lots of functionality ← worst — hide complexity
```

## The Architecture Audit

### Scan 1: Interface Complexity
Find modules with:
- More than 4 required parameters
- Config objects with more than 8 keys
- Functions that return different shapes based on flags
- Components with more than 8 props

### Scan 2: Information Leakage
Find places where:
- Internal implementation details are exposed in the public API
- The caller needs to know about the module's dependencies
- Error messages expose database structure or internal IDs
- Comments explain what the code does (the code should be clear enough)

### Scan 3: Duplication & Divergence
Find:
- Same logic implemented in 2+ places with slight variations
- Similar components that should share a base but don't
- Utility functions that exist but nobody knows about
- Copy-paste patterns (even with different variable names)

### Scan 4: Dead Code & Rot
Find:
- Unused exports (check with `ts-prune` or manual review)
- Components that exist but no route renders them
- API routes with no callers
- Feature flags that are always on/off
- Deprecated functions still in use

### Scan 5: Test Coverage Gaps
Find:
- Modules with zero tests
- Critical paths with no integration test
- Error handling paths with no test coverage
- Database migrations with no verification test

## Deepening Techniques

### Technique 1: Absorb Configuration
Instead of 8 config options, make smart defaults:
```typescript
// SHALLOW: Caller must know everything
function sendMessage(opts: {
  channel: string, text: string, mrkdwn: boolean,
  thread_ts?: string, reply_broadcast?: boolean,
  unfurl_links?: boolean, unfurl_media?: boolean,
  icon_emoji?: string, username?: string
}) { ... }

// DEEPER: Smart defaults, caller passes only what matters
function sendMessage(opts: {
  channel: string, text: string,
  thread?: string, style?: "casual" | "formal"
}) { ... }
```

### Technique 2: Raise the Abstraction Level
Replace low-level operations with high-level intents:
```typescript
// SHALLOW: Caller orchestrates every step
const customer = await db.findCustomer(id);
const payments = await db.findPayments(customer.id);
const total = payments.reduce((s, p) => s + p.amount, 0);

// DEEPER: One call expresses the intent
const total = await db.customerTotalPayments(id);
```

### Technique 3: Unify Error Handling
Instead of every caller handling errors differently:
```typescript
// SHALLOW: Every caller has try/catch
// DEEPER: Module handles its own errors, returns Result type
const result = await createPayment(intent);
if (result.ok) { ... } else { ... }
```

## Output

Generate `ARCHITECTURE-REVIEW.md`:
```markdown
# Architecture Review — {Date}

## Deep Modules Created
- {module}: simplified interface from {X} to {Y} params

## Shallow Modules Found (N)
- {module}: {issue} → {recommendation}

## Duplication Found (N instances)
- {pattern}: in {files} → extract to {location}

## Dead Code Removed (N items)
- {item}: {reason}

## Test Gaps Closed (N)
- {module}: added {N} tests covering {paths}
```

## Integration

- **Run cadence**: Every 5 features, or when codebase feels "stiff"
- **Input**: The codebase itself (grep, glob, ts-prune, test coverage reports)
- **Output**: `ARCHITECTURE-REVIEW.md` + refactor PRs
- **Risk level**: MEDIUM — architectural changes need review
- **Never**: Refactor during active feature work (separate branches)

## See Also

- `/tdd` — refactor phase aligns with architecture improvement
- `/grill` — grill should check if similar things already exist
- `/handoff` — pass architecture findings to V2 for refactor PRs

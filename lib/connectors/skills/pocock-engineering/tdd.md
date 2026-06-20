---
name: tdd
description: Red-Green-Refactor discipline for agentic coding. Write a FAILING test first, then implement to make it pass, then refactor. Each ticket = one TDD cycle. Use for all V2 coding sessions and direct implementation. Trigger: /tdd, "test-driven", "red green refactor"
---

# Test-Driven Development (TDD)

Enforce the Red-Green-Refactor cycle for all agentic code generation. The agent writes a FAILING test FIRST, then the minimal implementation to pass it, then refactors for quality. This feedback loop catches bugs at the point of creation — when they're cheapest to fix.

Ported from Matt Pocock's `/tdd` skill. Critical for Neptune V2 coding sessions where agents operate autonomously.

## Core Philosophy

> "Write the test. Watch it fail. Make it pass. Then make it beautiful. That's the whole game."

## The TDD Cycle

### 🔴 RED — Write a Failing Test (5 min max)
1. Write the MINIMAL test that captures the acceptance criteria
2. Run it. It MUST fail. If it passes, the test is wrong or the feature already exists
3. The failure message must clearly state what's missing

```typescript
// RED: This test must fail because the endpoint doesn't exist yet
test("POST /api/billing creates a payment intent", async () => {
  const res = await fetch("/api/billing", {
    method: "POST",
    body: JSON.stringify({ amount: 5000, currency: "usd" })
  });
  expect(res.status).toBe(201);  // ← FAILS: 404 Not Found
});
```

### 🟢 GREEN — Make It Pass (minimal implementation)
1. Write the SIMPLEST code that makes the test pass
2. No optimization, no abstraction, no "future-proofing"
3. If the test passes, STOP writing code

```typescript
// GREEN: Minimal implementation to make the test pass
export async function POST(req: Request) {
  const { amount, currency } = await req.json();
  return Response.json({ id: "pi_123", amount, currency }, { status: 201 });
}
```

### 🔵 REFACTOR — Make It Beautiful
1. Extract duplication
2. Add proper types (replace `any` with specific types)
3. Add error handling for edge cases the test didn't cover
4. Run test again — it must STILL pass
5. Add new tests for discovered edge cases, go back to RED

```typescript
// REFACTOR: Add types, validation, error handling
interface PaymentIntentRequest {
  amount: number;
  currency: string;
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = PaymentIntentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  // ... proper implementation
}
```

## TDD Rules for Agents

1. **ALWAYS write the test first** — never implement before the test
2. **Test the behavior, not the implementation** — don't test internal functions, test API responses and UI states
3. **One test, one behavior** — don't test multiple things in one test
4. **Tests are documentation** — reading the tests should explain what the feature does
5. **Run tests on every change** — `pnpm test --watch` in the background

## Test Types by Layer

| Layer | Test Type | Tool | What to Test |
|-------|-----------|------|-------------|
| API Routes | Integration | Vitest + fetch | Status codes, response shape, auth, error cases |
| Database | Integration | Vitest + test DB | Migrations, queries, constraints |
| Components | Component | Playwright | Renders, user interactions, state changes |
| Utilities | Unit | Vitest | Pure functions, transformations, validators |
| E2E Flows | End-to-end | Playwright | Full user journeys, multi-page flows |

## Quality Gate (per ticket)

Before marking a ticket complete:
- [ ] At least 1 failing test was written FIRST
- [ ] Implementation makes ALL tests pass
- [ ] TypeScript strict: zero errors
- [ ] No `any` types (use `unknown` or generics)
- [ ] Error cases have corresponding tests
- [ ] Test file is committed alongside implementation

## Anti-Patterns

- **Never write tests after implementation** — that's not TDD, that's regret
- **Never skip refactor** — "it works" is not "it's done"
- **Never test private functions** — test the public API/UI contract
- **Never mock everything** — integration tests with real DB/API give real confidence
- **Never commit failing tests** — red tests on main break CI for everyone

## Integration

- **Input**: A single ticket from `/to-issues`
- **Process**: RED → GREEN → REFACTOR → commit
- **Output**: Working code + passing tests + clean types
- **Next**: Next ticket, or `/qa` when all tickets complete

## See Also

- `/to-issues` — source of TDD tickets
- `/grill` — ensures tickets have clear acceptance criteria
- `/qa` — verification after all tickets pass TDD
- `/improve-codebase-architecture` — large-scale refactor during REFACTOR phase

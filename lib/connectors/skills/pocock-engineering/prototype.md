---
name: prototype
description: Answer design and UX questions with throwaway code. Create 2-3 variations on a throwaway route. The user picks the winner — commit the winning design, delete the rest. Use when grill reveals design unknowns that codebase exploration can't resolve. Trigger: /prototype, "build a prototype", "explore design options"
---

# Prototype

Create quick, throwaway implementations to answer design and UX questions. Generate 2-3 competing variations, let taste decide, then commit only the winner. Prototypes are explicitly temporary — they live on throwaway routes and get deleted after the decision.

Ported from Matt Pocock's `/prototype` skill. Fills a critical gap: Neptune currently skips prototyping and goes straight from PRD to implementation, missing the taste-imposition step.

## Core Philosophy

> "Prototyping imposes your TASTE on the outcome. Without it, the AI makes all the design decisions, and you get generic output. Build 2-3 throwaway versions, pick the winner, delete the rest."

## When to Prototype

- **UI/UX decisions**: "Should this be a modal or a page?" → prototype both
- **Animation choices**: "How should this transition feel?" → prototype 3 easings
- **Layout explorations**: "Where should the CTA go?" → prototype 3 positions
- **Color/typography**: "Which palette feels right?" → prototype variations
- **API design**: "What shape should the response take?" → prototype 2 contracts
- **Component API**: "What props feel natural?" → prototype usage patterns

Do NOT prototype:
- Business logic (that's /grill territory)
- Architecture decisions (that's /grill territory)
- Implementation details (that's implementation)
- Anything the codebase already answers (check first)

## The Prototype Process

### Step 1: Define the Question
Be specific about what's being evaluated:
```
Question: "How should the billing page display payment history?"
Evaluating: Layout, density, interaction pattern
NOT evaluating: API integration, auth, error handling
```

### Step 2: Generate Variations (2-3)
Create throwaway routes:
```
/prototype-billing-v1  — Card-based layout with expand/collapse
/prototype-billing-v2  — Table layout with inline actions
/prototype-billing-v3  — Timeline layout with status badges
```

Each variation must:
- Work independently (standalone route, fake data, no API dependency)
- Be visually distinct (if they look similar, combine them)
- Focus on the question (don't build features not being evaluated)
- Use production code patterns (Tailwind, shadcn components, existing design tokens)

### Step 3: Review with User
- Present all variations side by side (screenshots or live URLs)
- Ask: "Which direction feels right? What specific elements work?"
- The user picks the WINNER
- If none work → new variations based on feedback
- If multiple elements from different prototypes work → merge into composite

### Step 4: Commit Winner, Delete Rest
- Move the winning implementation to the correct production route/component
- Delete ALL prototype routes
- Remove prototype dependencies if any were added temporarily
- The repo should look like prototypes never existed

## Throwaway Route Pattern

```typescript
// app/prototype-billing-v1/page.tsx
"use client";

// ⚠️ THROWAWAY PROTOTYPE — will be deleted after design decision
// Question: Card vs Table vs Timeline for billing history
// Evaluated: Layout, interaction feel, information density

export default function PrototypeBillingV1() {
  // FAKE DATA — no API calls, no database
  const fakePayments = [
    { id: "1", date: "2026-06-15", amount: 49.99, status: "paid" },
    // ...
  ];

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">PROTOTYPE V1 — Card Layout</h1>
      <p className="text-sm text-muted-foreground mb-8">
        ⚠️ This is a throwaway prototype. Fake data, no API.
      </p>
      {/* Prototype implementation */}
    </div>
  );
}
```

## Anti-Patterns

- **Never ship a prototype** — delete the throwaway routes before merging
- **Never build "production-ready" prototypes** — they're intentionally quick and fake
- **Never prototype more than 3 variations** — 2-3 is the sweet spot for taste comparison
- **Never prototype without a specific question** — "let me just try things" is not a prototype
- **Never let prototypes influence architecture** — prototypes answer design questions, not engineering ones
- **Never leave prototype routes in the repo** — they confuse future agents

## Integration

- **Input**: Design questions surfaced during /grill
- **Output**: Winning design committed, alternatives discarded
- **Next**: Back to /grill if new questions emerged, or /to-prd if design is settled

## See Also

- `/grill` — surfaces the design questions that need prototyping
- `/to-prd` — PRD incorporates the winning prototype's design patterns
- `/handoff` — pass the winning design to V2 with implementation guidance

---
name: handoff
description: Compress current session context into a structured markdown document for another agent session to continue the work. Auto-detect if task should go to V2 (coding) vs stay in Chat (planning). Include purpose, relevant context, suggested skills, and pointers to artifacts. Trigger: /handoff, "pass this to V2", "continue this in a new session"
---

# Handoff

Compress the current session's context into a structured document that another agent (or human) can pick up and continue seamlessly. Includes only the essential context — purpose, decisions, pointers to artifacts, and suggested next skills. The receiving agent should need zero back-and-forth clarification.

Ported from Matt Pocock's `/handoff` skill with Neptune-specific V2 enhancements. Replaces monolithic Slack dumps with structured, executable context.

## Core Philosophy

> "Handoff is BETTER than compact. Compact keeps everything in one session but you're in the dumb zone. Handoff splits concerns — the new session starts fresh in the smart zone with only what it needs."

## When to Handoff

- **Session approaching 200+ turns** — context window quality degrading
- **Task is coding-heavy** — handoff to Neptune V2 for implementation
- **Task is planning-heavy** — handoff back to Chat for discussion
- **Multiple concerns emerging** — split into focused sessions
- **Time gap** — you need to pause and resume later

## Handoff Decision Tree

```
Current task is...
├── Coding (implement, fix, build) → Handoff to Neptune V2
│   ├── Include: PRD, tickets, grill output, repo context
│   └── Suggested skills: tdd, improve-codebase-architecture
├── Planning (design, spec, research) → Handoff to Neptune Chat
│   ├── Include: user intent, decisions made, open questions
│   └── Suggested skills: grill, to-prd, prototype
├── Investigation (debug, explore, audit) → Handoff to V2
│   ├── Include: error traces, reproduction steps, hypotheses tested
│   └── Suggested skills: triage, improve-codebase-architecture
└── Mixed → Split into 2 handoffs (planning → Chat, coding → V2)
```

## Handoff Document Structure

```markdown
# Handoff: {Task Name}
**From**: {Source Session} | **To**: {Target Agent/Session} | **Date**: {ISO}

## Purpose (1 sentence)
What are we trying to achieve?

## Current State
What has been done so far? What's the state of the code/repo?

## Key Decisions Made
- Decision → Rationale (why not the alternative?)

## Open Questions
- Question → What we've checked → What's left

## Artifacts
- `docs/prd-{slug}.md` — {one-line summary}
- `grill-output.md` — {decision tree status}
- `src/...` — {relevant files}

## Suggested Skills
Ordered by priority:
1. `/grill` — {what to grill}
2. `/to-prd` — {what to spec}
3. ...

## Working Branch
`feat/{branch-name}` on `origin`

## Context Budget
{Total tokens this session has used} — start fresh for optimal performance.
```

## V2-Specific Handoff

When handing off to Neptune V2 (coding sandbox), include:
```typescript
interface V2Handoff {
  // Required
  tickets: Ticket[];           // from /to-issues
  repoContext: {               // what V2 needs to navigate the codebase
    repo: string;
    branch: string;
    keyFiles: string[];        // files V2 should read first
    patterns: string[];         // "follow the pattern in src/foo/bar.ts"
  };
  
  // Recommended
  testExpectations: {          // what tests should exist
    integrationTests: string[];
    componentTests?: string[];
    e2eFlow?: string;
  };
  acceptanceCriteria: string[]; // from PRD
  
  // Optional
  architectureHints?: string;  // "this follows the repository pattern"
  knownPitfalls?: string[];    // "don't import from X, use Y instead"
}
```

## What NOT to Include

- **Chat history** — the new agent doesn't need to see "sounds good, let me try that"
- **Failed attempts** — unless the failure reveals something important
- **Implementation details** — the PRD and tickets cover WHAT, the agent figures out HOW
- **Personal preferences** — unless they're encoded as rules
- **Duplicate content** — point to artifacts, don't copy-paste them

## Handoff Rules

1. **Be concise** — target 300-800 words. If longer, you're including things the agent doesn't need.
2. **Be specific** — "the auth middleware in src/middleware/auth.ts" not "the auth stuff"
3. **Be actionable** — the receiving agent should be able to start working immediately
4. **Be honest about unknowns** — "we haven't figured out X yet" is better than pretending
5. **Use pointers** — reference file paths, issue numbers, PR URLs. Don't duplicate.

## Integration

- **Input**: Current session context + any artifacts created
- **Output**: Handoff document + V2 prompt (if V2 target)
- **Engine**: `lib/connectors/skills/pocock-engineering/handoff.ts`
- **Storage**: Session storage, not permanent (old handoffs are stale context)

## See Also

- `/grill` — often the next skill suggested in handoff
- `/tdd` — V2's primary coding discipline
- `lib/v2/bridge.ts` — the V2 communication bridge

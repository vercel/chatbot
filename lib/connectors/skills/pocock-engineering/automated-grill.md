---
name: automated-grill
description: Interview relentlessly about every aspect of a feature plan before building. Walk down each branch of the design tree, resolving dependencies between decisions one by one. If a question can be answered by exploring the codebase, explore the codebase instead of asking the human. Three modes: Self-Grill (codebase exploration), Multi-Agent Grill (route to V2/connectors), Human-in-the-Loop (fallback for business decisions). Use before ANY feature work. Trigger: /grill, /grill-me, "grill this", "design review"
---

# Automated Grill

The Grill skill is the critical first step before any feature work. It interviews relentlessly — like a senior engineer staring at a design doc — to uncover assumptions, resolve dependencies, and achieve shared understanding before a single line of code is written.

Ported from Matt Pocock's `/grill-me` skill with the KEY INNOVATION: **automated self-answering** — the engine explores the codebase, checks git history, reads docs, and inspects connected services to answer its own questions, minimizing human burden.

## Core Philosophy

> "Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one by one. If a question can be answered by exploring the code base, explore the code base instead."

— Matt Pocock, `/grill-me`

## When to Run

- Before ANY feature work (mandatory gate)
- When someone says "I want to build X" or "Let's add Y"
- After receiving a PRD — grill it before accepting it
- When multiple people disagree on approach — grill surfaces hidden assumptions
- Before handing off to V2 for implementation — grill ensures V2 has answers

## The Design Tree

The grill walks a **design tree** — a decision tree where each node is a question and branches are possible answers. The tree is:
- **Breadth-first**: Walk all branches of the first-level question before going deeper
- **Dependency-respecting**: If question B depends on the answer to question A, ask A first
- **Evidence-anchored**: Every answer must rest on evidence (codebase, docs, data, or explicit human choice)

## 3 Grill Modes

### Mode 1: Self-Grill (default, zero human needed)

The engine attempts to self-answer every question by:

1. **Codebase Exploration** — grep for related patterns, read existing implementations, check shared utilities
2. **Git Archaeology** — `git log` for past decisions, reverted attempts, related PRs
3. **Document Review** — PRDs, AGENTS.md, research docs, architecture decision records
4. **Connector/API Inspection** — check connected services for current state (Linear issues, GitHub PRs, Slack discussions)
5. **Configuration Analysis** — environment variables, feature flags, existing routes

Each self-answered question carries an **evidence citation** (file path + line numbers, git commit hash, or API response reference).

### Mode 2: Multi-Agent Grill

When questions span multiple domains:
- Route codebase questions to Neptune V2 (coding sandbox with full repo access)
- Route API/connector questions to the relevant connector skill
- Route data questions to Base44 entity queries
- Collect answers asynchronously and compile into grill output

### Mode 3: Human-in-the-Loop (fallback, 5-10 questions max)

Only these question types should reach a human:
- **Business decisions**: "Should we charge monthly or annually?"
- **Design taste**: "Which of these 3 UI variations do you prefer?"
- **Budget/resource**: "Is this worth 2 weeks of work?"
- **Unknown unknowns**: Questions the engine cannot resolve after exhausting all sources

Never ask: "What file should I edit?" or "What does this function do?" — those are codebase-exploration questions.

## The Grill Process

### Phase 1: Generate Design Tree

```
Input: Feature description / PRD / user intent
↓
Generate first-level questions:
  - What problem does this solve?
  - What parts of the codebase does this touch?
  - What are the dependencies (internal + external)?
  - What's the data model / schema impact?
  - What's the UI/API contract?
  - What are the edge cases and failure modes?
  - What could break (existing users, performance, security)?
  - How will we know it works (testing strategy)?
↓
For each branch answer, generate follow-up questions
Continue until leaf nodes are all resolved or marked UNRESOLVED
```

### Phase 2: Self-Answer

For each question in the tree:
```
1. Search codebase: grep for related patterns/files
2. Check git history: any past attempts or related commits?
3. Read existing docs: any PRDs, ADRs, or research?
4. Check connectors: any related Linear tickets, GitHub PRs, Slack threads?
5. Test assumption: if "it should work like X", verify X exists in codebase
6. Classify: RESOLVED (with evidence) or UNRESOLVED
```

### Phase 3: Compile Grill Output

Save to `grill-output.md`:
- **RESOLVED questions** — grouped by topic, with evidence citations
- **UNRESOLVED questions** — the 5-10 questions that actually need human input
- **Decision log** — what was decided and why
- **Risk register** — things that could go wrong, flagged for QA

### Phase 4: Present to Human

If ALL questions are resolved: "Grill complete. All questions answered from codebase. Proceeding to PRD."

If UNRESOLVED questions remain: Present only those, each with:
- What we've tried (evidence we already checked)
- Why we can't answer it ourselves
- What the decision impacts

## What the Grill Is NOT

- **NOT a checklist** — don't just tick boxes, explore branches
- **NOT a chat** — the grill produces structured output, not conversation
- **NOT a blocker** — if all questions are self-answerable, the grill takes 30 seconds
- **NOT a substitute for thinking** — the grill framework forces thinking, it doesn't replace it

## Output Format

`grill-output.md` structure:
```markdown
# Grill Output: {Feature Name}

## Decision Tree
(resolved tree with evidence)

## Resolved (N questions)
- Q: ... → A: ... (evidence: file.ts:123)

## Unresolved (M questions)
- Q: ... (the 3 things we already checked)

## Risk Register
- Risk: ... → Mitigation: ...

## Ready for /to-prd? YES
```

## Integration

- **Input**: User intent, PRD, or feature description
- **Output**: `grill-output.md` consumed by `/to-prd`
- **Next skill**: `/to-prd` if output is clean, re-grill if unresolved > 10
- **Engine**: `lib/connectors/skills/pocock-engineering/automated-grill.ts`

## See Also

- `/to-prd` — next step after grill
- `/prototype` — if grill uncovers design unknowns
- `/to-issues` — break PRD into execution tickets
- `/handoff` — pass grill context to V2

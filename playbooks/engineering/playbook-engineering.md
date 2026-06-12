---
playbook: engineering
version: 1.0.0
domain: engineering
scope: domain
auto_load: false
headline: Software engineering standards, code review, architecture decisions and PRD authoring
priority: P1
intent_tags:
  - code review
  - architecture
  - PRD
  - refactoring
  - testing
  - performance
  - TypeScript
associated_connectors:
  - github
  - vercel
  - wiki
  - mcp-hub
associated_skills:
  - capabilities/code-review
  - capabilities/research
  - capabilities/self-coding
  - connectors/github
  - connectors/vercel
associated_functions:
  - validate-action
routines_count: 3
---

# Engineering Domain Playbook

## Operational Knowledge
- **Primary Stack:** Next.js 16 + React 18 + TypeScript + Tailwind v3
- **UI Framework:** shadcn/ui (Radix primitives) — 28 components available
- **AI SDK:** Vercel AI SDK 6 with streamText + tool pattern
- **Database:** Drizzle ORM (drizzle.config.ts) for any DB needs
- **Deployment:** Vercel (neptune-chat + neptune-v2), auto-deploy on push to main
- **Testing:** Playwright for E2E, Vitest for unit (playwright.config.ts)
- **Code Style:** Biome (biome.jsonc) for linting/formatting
- **Branch Strategy:** feat/<name> branches, squash-merge PRs with ai-agent label

## Business Context
- **Repos:** neptune-chat (this), neptune-v2 (code agent), playbook-os (skills)
- **Commit Author:** abhiswami2121@gmail.com (cardinals 6a29cf6f + 6a20a987)
- **PR Labels:** ai-agent required on all AI-generated PRs
- **CI Requirements:** pnpm typecheck + pnpm build must pass before merge
- **Code Review:** Cross-AI peer review via code-review capability skill

## Anti-Patterns (DO NOT DO)
- DON'T push without running pnpm build locally first
- DON'T commit with wrong author email (must be abhiswami2121@gmail.com)
- DON'T leave TypeScript errors for Vercel to figure out
- DON'T use vercel CLI (silent empty bug — cardinal 6a273f70)
- DON'T skip CI — pnpm typecheck + pnpm build must pass
- DON'T merge to main directly — always via PR
- DON'T use React 19 or Tailwind v4 — stick to v18 + v3
- DON'T introduce new dependencies without validating license + bundle size

## Safeguards
1. Before every commit: pnpm typecheck (must pass with 0 errors)
2. Before every merge: pnpm build (must pass with 0 errors)
3. Before every PR: verify author email (git config user.email)
4. After every deploy: smoke test the deployed URL
5. Feature branches: never commit directly to main
6. Component creation: use shadcn/ui primitives, follow existing patterns in components/ui/
7. API routes: use Next.js App Router route handlers in app/api/
8. New connectors: follow _template pattern in connectors/ folder

## Routines

### Routine: 'Code Review'
Trigger words: 'review', 'code review', 'check this code', 'audit',
              'security review', 'peer review'

Mandatory steps:
1. Load capabilities/code-review skill for review framework
2. Read changed files from git diff or PR
3. Check against engineering safeguards (typecheck, build, author, imports)
4. Check for anti-patterns (wrong deps, missing error handling, exposed secrets)
5. Check component patterns: shadcn/ui usage, Tailwind classes, responsive design
6. Produce REVIEW.md with severity-classified findings
7. If critical: BLOCK merge until fixed
8. If non-critical: FLAG and suggest fixes
9. Post summary to thread

### Routine: 'Architectural Decision'
Trigger words: 'should we', 'which approach', 'architecture', 'design pattern',
              'how should we build', 'ADR'

Mandatory steps:
1. Identify the decision domain (UI, API, data, deployment, auth)
2. Research existing patterns in codebase (grep for similar implementations)
3. Check playbook constraints (cardinals, anti-patterns)
4. Evaluate 2-3 alternatives with trade-offs
5. Document decision in ADR format: context, decision, consequences
6. Reference relevant cardinals and playbook rules
7. Post to #jarvis-admin for awareness

### Routine: 'Create PRD'
Trigger words: 'write PRD', 'spec out', 'plan feature', 'document requirement',
              'feature spec', 'PRD'

Mandatory steps:
1. Clarify scope: what domain does this touch? Which connectors/skills?
2. Check for existing PRDs in jarvis/cortex/ or docs/ that overlap
3. Structure: Executive Vision → Current State → Requirements → Phases → Success Criteria
4. Include cardinal rules and anti-patterns as constraints
5. Map to 10-domain architecture for routing
6. Write to jarvis/cortex/prd/ with dated filename
7. Cross-reference with playbook-index.md if adding new capability

## Refinement Notes
- 2026-06-11: Vercel CLI is banned — REST API only for all deploy operations.
- 2026-06-11: U2.2 file tree reorg moved from organizations/ to playbooks/ flat layout.
- 2026-06-12: U2.4 introduces GRAPH-TAG.json bidirectional linking across all entities.

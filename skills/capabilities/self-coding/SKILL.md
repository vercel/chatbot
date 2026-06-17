---
name: self-coding
version: 1.0.0
kind: capability
primary_domain: engineering
headline: |
  Neptune Chat's ability to modify its own codebase. Use for small fixes (typos, color tweaks, copy changes, prop additions). Hand off to Neptune V2 for complex work.
type: "skill"
access: internal
---

# Self-Coding Capability

## Operational Knowledge
- **I am**: Neptune Chat at https://neptune-chat-ashy.vercel.app
- **My repo**: github.com/abhiswami2121/neptune-chat
- **My Vercel project**: prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl
- **My team**: team_NXlYvSlpN5mMinKXi0emQkFT
- **My stack**: Next.js 16, AI SDK 6, NextAuth v5, Tailwind, shadcn
- **My commit author**: abhiswami2121 <abhiswami2121@gmail.com>
- **Branching**: feat/<slug>, never push to main directly

## Technique
1. **Assess**: Is this task small enough for self-coding? (<50 lines, ≤3 files)
2. **Clone**: Use Vercel Sandbox SDK to clone my own repo
3. **Edit**: Make the change, following existing patterns
4. **Build**: pnpm typecheck + pnpm build must pass
5. **Push**: Create feat/<slug> branch, commit with Co-Authored-By, push
6. **Verify**: Poll Vercel REST API until deploy state=READY (max 8 min)
7. **Smoke**: curl the changed route, verify HTTP 200 + expected content
8. **Report**: Tell the user: "Done. Commit <sha>, deploy <dpl_xxx>, smoke passed"

## When to Self-Code
- Typo fixes in text/copy/markdown
- CSS color/variant tweaks (Tailwind class changes)
- Simple prop additions to existing components
- Adding a single small function to an existing file
- Updating a configuration value

## When to Hand Off to V2
- Anything >50 lines of code changes
- Touching >3 files
- New pages or components
- Refactoring existing code
- Database schema changes
- New API routes
- Build new feature, add page, refactor, big change

## Anti-Patterns
- NEVER do large refactors — hand off to Neptune V2
- NEVER edit /home/hermes/* — that's VPS, not my codebase
- NEVER commit secrets (.env, tokens, credentials)
- NEVER skip pnpm build locally before push
- NEVER assume Vercel deploy succeeded — VERIFY
- NEVER push directly to main — use feat/ branches

## Safeguards
- Before push: pnpm typecheck + pnpm build must pass
- After push: poll Vercel REST API until state=READY (max 8 min)
- After READY: curl the changed route, verify HTTP 200 + expected content
- If smoke fails: read Vercel logs, fix, re-push
- If task is >50 lines or touches >3 files: HAND OFF TO V2

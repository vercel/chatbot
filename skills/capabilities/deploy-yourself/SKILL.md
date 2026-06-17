---
name: deploy-yourself
version: 1.0.0
kind: capability
primary_domain: engineering
headline: |
  How any Neptune-family agent deploys changes to itself or any Vercel+GitHub project.
  Shared skill referenced by both Neptune Chat and Neptune V2.
type: "skill"
access: internal
---

# Deploy-Yourself — Shared Deployment Capability

This is a **UNIVERSAL** skill shared by all Neptune-family agents (Chat, V2, and any future siblings). It describes the canonical deploy pipeline: pre-flight, push, verify, smoke, rollback.

## Operational Knowledge

### Neptune Chat
- **Vercel Project**: prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl
- **Team**: team_NXlYvSlpN5mMinKXi0emQkFT
- **Production URL**: https://neptune-chat-ashy.vercel.app
- **Repo**: github.com/abhiswami2121/neptune-chat

### Neptune V2
- **Vercel Project**: prj_lEoqz6p4zgdrLlObPl845TI2ApOm
- **Team**: team_NXlYvSlpN5mMinKXi0emQkFT
- **Production URL**: https://neptune-v2.vercel.app
- **Repo**: github.com/abhiswami2121/neptune-v2

### Shared
- **Vercel REST API**: https://api.vercel.com
- **Commit Author**: abhiswami2121 <abhiswami2121@gmail.com>
- **Auto-deploy**: Both projects auto-deploy on push to main

## Pre-flight Checklist

Before every push:
1. `pnpm install` — ensure dependencies are up to date
2. `pnpm typecheck` — must pass with 0 errors
3. `pnpm build` — must pass with 0 errors
4. `pnpm test` — must pass if tests exist
5. `git status` — no uncommitted changes left behind
6. `git config user.email` — must be abhiswami2121@gmail.com

## Push & Deploy Pipeline

```
git push → Vercel auto-detects → Build → Deploy → Health Check → Live
```

1. Commit with proper author and Co-Authored-By trailer
2. Push to GitHub (branch or main)
3. Vercel auto-detects push and starts deploy
4. Poll Vercel REST API:
   ```
   GET /v9/projects/{projectId}?teamId={teamId}
   ```
5. Monitor readyState: INITIALIZING → BUILDING → READY (or ERROR)
6. Max wait: 8 minutes (Chat) / 10 minutes (V2)

## Verify — Smoke Test

After deploy READY:
1. `curl -sS -o /dev/null -w '%{http_code}' {deployedUrl}/` — must return 200
2. `curl -sS {deployedUrl}/api/health` — if exists, must return ok
3. `curl -sS {deployedUrl}/api/context` — must return valid JSON with current commit
4. Curl changed routes — must return 200 + expected content
5. Check Vercel function logs for errors in new routes

## Rollback

If smoke fails irreparably:
1. `git revert <bad-commit>` on main
2. Push revert commit
3. Wait for Vercel deploy READY
4. Re-smoke
5. If still broken: investigate Vercel build logs for root cause

## Anti-Patterns

- DON'T push without running pnpm build locally first
- DON'T assume Vercel deploy succeeded — VERIFY with API polling
- DON'T close a phase without smoke-testing deployed URL
- DON'T leave TypeScript errors for "Vercel to figure out"
- DON'T use `vercel env add` CLI (silent empty bug per cardinal 6a273f70)
- DON'T commit if typecheck or build fails
- DON'T rebase main into feat branch with uncommitted changes
- DON'T edit /home/hermes/* for VPS deploys (that's a different playbook)

## Cross-Agent Context

Both agents expose context at `/api/context`:
```json
{
  "agent": "Neptune Chat" | "Neptune V2",
  "repoUrl": "github.com/abhiswami2121/...",
  "vercelProjectId": "prj_...",
  "deployedUrl": "https://...",
  "currentCommit": "abc123...",
  "capabilities": ["...", "..."],
  "siblingAgent": "https://..."
}
```

Chat can query V2: `curl https://neptune-v2.vercel.app/api/context`
V2 can query Chat: `curl https://neptune-chat-ashy.vercel.app/api/context`

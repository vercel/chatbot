---
type: "playbook"
name: "Playbook Self Coding"
description: "Auto-generated description for Playbook Self Coding"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Self-Coding Playbook — Neptune Chat

## Section 1: Identity & Context

I am **Neptune Chat**, the conversational AI agent running at:
- **Production URL**: https://neptune-chat-ashy.vercel.app
- **GitHub Repo**: https://github.com/abhiswami2121/neptune-chat
- **Vercel Project**: `prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl`
- **Vercel Team**: `team_NXlYvSlpN5mMinKXi0emQkFT`
- **Stack**: Next.js 16, AI SDK 6, NextAuth v5, Tailwind, shadcn/ui
- **Runtime**: Node.js (Vercel LAMBDAS)
- **Commit Author**: abhiswami2121 <abhiswami2121@gmail.com>

My sibling agent is:
- **Neptune V2** at https://neptune-v2.vercel.app
- **V2 Repo**: https://github.com/abhiswami2121/neptune-v2
- **V2 Vercel Project**: `prj_lEoqz6p4zgdrLlObPl845TI2ApOm`

## Section 2: Self-Coding Routines

### Routine: Fix Small Bug
**Trigger**: "fix the X", "change the Y", "update Z color", "correct typo in"
**Steps**:
1. Use `selfCode` tool with task description
2. Tool assesses scope — if ≤50 lines and ≤3 files, proceed
3. Clone repo via Vercel Sandbox SDK
4. Make the change, preserving existing patterns
5. Run `pnpm typecheck` and `pnpm build`
6. Create feat/<slug> branch, commit, push
7. Poll Vercel deploy until READY
8. Smoke test the affected route(s)
9. Report result to user with commit SHA and deploy ID

### Routine: Hand Off to V2
**Trigger**: "build new feature", "add page", "refactor", "big change"
**Steps**:
1. Use `spawnCodingAgent` with mode=modify_existing, repoName=neptune-chat
2. Provide full context about the task
3. Monitor V2 progress via `streamV2Progress`
4. Report PR URL to user when V2 completes

### Routine: Deploy Myself
**Trigger**: Any push to the neptune-chat repo
**Steps**:
1. Vercel auto-deploys on push to main
2. Poll `GET /v9/projects/prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl` via Vercel REST API
3. Wait for readyState=READY
4. Smoke test: `curl -sS -o /dev/null -w '%{http_code}' https://neptune-chat-ashy.vercel.app/<changed-route>`
5. If smoke fails, read Vercel build logs, fix, re-push

## Section 3: Context Endpoints

- **Self context**: `GET /api/context` — returns repo URL, Vercel project, current commit, deployed URL, capabilities
- **V2 context**: `GET https://neptune-v2.vercel.app/api/context` — returns V2's repo, project, capabilities
- **Health**: `GET /api/health` — returns { status: "ok", uptime, version }

## Section 4: Self-Healing Rules

### Error: Typecheck fails after edit
→ Revert the edit, double-check TypeScript syntax, try again with corrected types

### Error: Build fails after push
→ Read Vercel build logs via REST API, identify broken file, fix, commit again

### Error: Deploy stuck in BUILDING >8 min
→ Abort wait, check Vercel dashboard, report to user with deploy ID

### Error: Smoke test returns non-200
→ The change may have broken the page. Check Vercel function logs, rollback if needed

### Error: Task too large (>50 lines)
→ Hand off to V2 via spawnCodingAgent. Do NOT attempt large self-modifications.

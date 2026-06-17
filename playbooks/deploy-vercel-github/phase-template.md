---
type: "playbook"
name: "Phase Template"
description: "Auto-generated description for Phase Template"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Phase Execution Template (CS0 Enforced)

These steps are MANDATORY for every phase CS1-CS8. They enforce the deploy-discipline playbook.

## PHASE START

1. Read playbook-deploy.md safeguards section
2. Confirm git config: user.name=abhiswami2121, user.email=abhiswami2121@gmail.com
3. Confirm working on correct repo + branch

## PRE-FLIGHT (BEFORE any push)

```bash
cd <project> && pnpm install
pnpm typecheck     # MUST PASS — 0 errors
pnpm build         # MUST PASS — 0 errors
pnpm test          # if exists, MUST PASS
git status         # no uncommitted changes
git config user.email  # verify abhiswami2121@gmail.com
```

If typecheck fails: fix errors, re-run until pass, then continue.
If build fails: fix errors, re-run until pass, then continue.
After 3 consecutive build failures: rollback to last known good commit, log, skip rest of phase.

## COMMIT + PUSH

```bash
git add -A
git commit -m "feat(cs<X>): <description>"
git push origin feat/cs<X>-<slug>
```

## PR + MERGE

1. Create PR via gh CLI
2. Wait for CI green (max 5 min)
3. If CI red: read failure, fix, re-push
4. Merge PR (squash) once CI green

## POST-DEPLOY (AFTER merge to main)

1. Wait 30s for Vercel to spawn deploy
2. GET https://api.vercel.com/v9/projects/{id}/deployments?limit=1
3. Poll every 30s until state == READY or ERROR (max 8 min)
4. If ERROR: GET deployment events, read build logs, attempt fix
5. If READY: smoke test the deployed URL with affected routes
6. Record deploy_id, state, url, smoke results in phase proof JSON

## PHASE COMPLETE

1. Write /home/hermes/data/cs<X>_complete.json with vercel_deploys[].state=READY
2. Post Slack synthesis to #jarvis-admin
3. Mark phase as complete

## ANTI-LOOP ENFORCEMENT

- Checkpoint every 30 tool calls
- Same file edited 4+ times in 10 min → stop, log, move on
- Same tool call 5+ times in 60s → abort, write partial proof, continue
- Build failures 3 in a row → rollback, skip rest of phase
- Vercel deploy stuck >8 min → abort wait, write checkpoint, move on
- NEVER pm2 reload from inside session

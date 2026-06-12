# Deploy Playbook (Chat + V2 + VPS)

## Operational Knowledge
- Neptune Chat: prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl @ neptune-chat-ashy.vercel.app
- Neptune V2: prj_lEoqz6p4zgdrLlObPl845TI2ApOm @ neptune-v2.vercel.app
- Both auto-deploy on push to main
- Vercel REST API: https://api.vercel.com/v9/projects/{id}/deployments
- Commit author MUST be abhiswami2121 <abhiswami2121@gmail.com>
- VPS Hermes lives at port 8102

## Anti-Patterns (DO NOT DO)
- DON'T push without running pnpm build locally first
- DON'T assume Vercel deploy succeeded — VERIFY
- DON'T close a phase without smoke-testing the deployed URL
- DON'T leave TypeScript errors for 'Vercel to figure out'
- DON'T use vercel env add CLI (silent empty bug per cardinal 6a273f70)
- DON'T commit if pnpm test or pnpm typecheck fails
- DON'T rebase main into a feat branch with uncommitted changes

## Safeguards (REQUIRED before claiming success)

Before every push to main (or merge):
1. cd <project> && pnpm install
2. pnpm typecheck (must pass)
3. pnpm build (must pass with 0 errors)
4. pnpm test (if exists, must pass)
5. git status (no uncommitted changes left behind)
6. git config check: user.email=abhiswami2121@gmail.com

After every push to main (auto-deploy):
1. Wait 30 sec for Vercel to spawn deploy
2. GET https://api.vercel.com/v9/projects/{id}/deployments?limit=1 - read latest
3. Poll every 30 sec until state == READY or ERROR (max 8 min)
4. If ERROR: GET deployment events + log output, read errors, write to proof JSON, attempt fix
5. If READY: smoke test the deployed URL
   - curl /api/health if exists
   - curl key affected pages, expect 200 + correct content
   - check function logs for the new route
6. Update proof JSON with deploy_id, state, smoke results
7. If smoke failed: log + continue but flag for follow-up

VPS Hermes deploy (semi-playbook):
1. Before editing /home/hermes/claude-agent-api/server.py: backup + ast.parse + diff
2. After editing: NEVER pm2 reload from inside session (cardinal 6a153d63)
3. Use at(1) deferred reload: echo 'pm2 reload claude-agent-api --update-env' | at now + 1 minute
4. After deferred reload completes: dispatch tiny test session to verify
5. If verify fails: revert from backup

## Routines

### Routine: 'Ship a feature'
Trigger words: 'ship', 'deploy', 'land', 'merge to main', 'release'

Mandatory steps:
1. Verify on feature branch (not main)
2. pnpm typecheck — must pass
3. pnpm build — must pass
4. git add + commit (author=abhiswami2121@gmail.com)
5. git push origin <branch>
6. Open PR via gh CLI or Octokit
7. Wait for CI green
8. Merge PR (squash preferred)
9. Wait 30s for Vercel auto-deploy
10. Poll Vercel deploy state until READY (max 8 min)
11. Smoke test deployed URL
12. If smoke passes: phase complete
13. If smoke fails: read Vercel function logs, identify root cause, fix and re-push

### Routine: 'Diagnose stale UI'
Trigger words: 'live UI doesn't match commits', 'why isn't X showing', 'I committed but I don't see it'

Mandatory steps:
1. Pull latest from main + verify commit landed
2. GET Vercel latest deployment for the project
3. If deploy state ERROR: read build logs
4. If deploy state READY: check the URL serves the new file
5. If file in build but old version served: check CDN cache, force-refresh
6. If file not in build at all: check if file was actually committed (git log <path>)

## Custom Skills (under connectors/neptune)

### Connectors
| Skill Pack | Actions | Path | Used For |
|-----------|---------|------|----------|
| `github` | 35 | `connectors/neptune/skills/github/` | Repos, branches, commits, PRs, issues, workflows, releases |
| `vercel` | 25 | `connectors/neptune/skills/vercel/` | Deployments, builds, projects, domains, env vars, analytics |

### Functions
| Function | Path | Used For |
|----------|------|----------|
| `usage-telemetry` | `connectors/neptune/functions/usage-telemetry.ts` | Track deploy success/failure rates and durations |

## Refinement Notes
- 2026-06-11: Recurring V2 deploy failures (commits 9ffc6ec, cc860a6) indicate we keep shipping broken code. Enforce pnpm build locally before push.
- 2026-06-11: UX2-UX6 from prior mission committed but never deployed — agent assumed success without verifying.
- 2026-06-12: Phase 8 — GitHub (35) + Vercel (25) provide complete deploy pipeline tooling via neptune skills.

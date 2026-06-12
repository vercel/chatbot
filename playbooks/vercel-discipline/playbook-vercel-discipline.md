---
playbook: vercel-discipline
version: 1.0.0
domain: vercel-discipline
scope: domain
auto_load: true
headline: Vercel deployment standards, security patterns and framework discipline
priority: P1
intent_tags:
  - vercel
  - deploy
  - environment variables
  - project configuration
  - build
  - edge
  - serverless
associated_connectors:
  - vercel
  - github
associated_skills:
  - capabilities/deploy-yourself
  - capabilities/code-review
  - connectors/vercel
  - connectors/github
associated_functions:
  - validate-action
routines_count: 3
---

# Vercel Discipline Playbook

## Operational Knowledge
- **Projects:** neptune-chat (prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl), neptune-v2 (prj_lEoqz6p4zgdrLlObPl845TI2ApOm)
- **Auto-deploy:** Push to main triggers Vercel deployment automatically
- **REST API Base:** https://api.vercel.com/v9
- **CRITICAL:** vercel CLI is BANNED — silent empty bug (cardinal 6a273f70)
- **Env Management:** VERCEL_TOKEN for auth, never expose to client
- **Framework:** Next.js 16 App Router, auto-detected by Vercel
- **Regions:** All regions enabled for edge caching

## Business Context
- Both Chat and V2 deploy on push to main
- Deployments auto-retry on failure (Vercel built-in)
- VERCEL_TOKEN stored in VPS secrets, never in repo
- Build logs available via REST API: GET /v9/projects/{id}/deployments/{did}/events
- Function logs via REST API for debugging runtime errors

## Anti-Patterns (DO NOT DO)
- DON'T use vercel CLI for ANY operation (cardinal 6a273f70)
- DON'T use vercel env add (silent empty bug)
- DON'T expose VERCEL_TOKEN in client code or env vars
- DON'T push without local pnpm build passing
- DON'T assume deploy succeeded — always verify state=READY
- DON'T deploy to production without smoke testing
- DON'T leave environment variables out of sync between Chat and V2
- DON'T use Vercel Analytics without consent (GDPR)

## Safeguards
1. Before deploy: pnpm typecheck + pnpm build must pass locally
2. After push: wait 30s, poll deploy state every 30s until READY/ERROR (max 8 min)
3. On ERROR: read build events + function logs, diagnose, fix
4. On READY: smoke test affected URLs with curl
5. Never commit VERCEL_TOKEN or .env to git
6. Vercel REST API calls: authenticate via Bearer token
7. Monitor concurrent deployments — don't trigger new one while one is building
8. Rollback: use Vercel dashboard or REST API to promote previous deployment

## Routines

### Routine: 'Verify Deployment'
Trigger words: 'check deploy', 'deploy status', 'is it live',
              'verify deployment', 'did it deploy'

Mandatory steps:
1. GET https://api.vercel.com/v9/projects/{projectId}/deployments?limit=1
2. Read latest deployment: state, created, creator, commit
3. If state=READY: report URL + timestamp
4. If state=ERROR: read build events, diagnose failure
5. If state=BUILDING or QUEUED: wait and re-poll
6. Smoke test: curl deployed URL + key routes
7. Report deployment health to #jarvis-admin

### Routine: 'Rollback Deployment'
Trigger words: 'rollback', 'revert deploy', 'go back to previous',
              'undeploy', 'previous version'

Mandatory steps:
1. GET list of recent deployments (last 5)
2. Identify target deployment (previous READY deployment)
3. Confirm rollback target with deployment URL + timestamp
4. POST promote or redeploy via REST API
5. Verify new deployment reaches READY
6. Smoke test reverted state
7. Post rollback confirmation to #jarvis-admin

### Routine: 'Audit Environment Variables'
Trigger words: 'check env', 'environment variables', 'audit env',
              'verify secrets', 'env drift'

Mandatory steps:
1. GET environment variables for both Chat and V2 projects via REST API
2. Compare key variables across projects (base URLs, API keys, tokens)
3. Check for drift: variables in one but not the other
4. Verify no secrets are exposed in client-side env (NEXT_PUBLIC_ prefix)
5. Flag any missing or mismatched variables
6. Report audit summary with recommendations

## Custom Skills (under connectors/neptune)

### Connectors
| Skill Pack | Actions | Path | Used For |
|-----------|---------|------|----------|
| `vercel` | 25 | `connectors/neptune/skills/vercel/` | Deployments, builds, projects, domains, env vars, analytics, security |

## Refinement Notes
- 2026-06-11: vercel CLI permanently banned after cardinal 6a273f70 incident.
- 2026-06-11: U2.2 moved deploy playbook from organizations/ to playbooks/ flat layout.
- 2026-06-12: Added env audit routine for cross-project consistency.
- 2026-06-12: Phase 8 — Vercel (25 actions) provides complete deploy lifecycle via REST API.

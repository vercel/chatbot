---
connector: vercel
version: 0.2.0
scope: connector
auto_load: true
trigger_tools:
  - vercel:listDeploys
  - vercel:getDeployLog
  - vercel:listProjects
  - vercel:createProject
  - vercel:redeploy
headline: |
  Vercel deployment platform. Never hardcode project IDs — resolve by name via listProjects.
  VERCEL_TOKEN is server-only. Concurrent deploys can race — check before redeploying.
---

# Vercel Connector Playbook

## Operational Knowledge

### Architecture
Vercel connector communicates directly with `api.vercel.com` REST API (v7-v13 endpoints) using Bearer token auth. No intermediate bridge — calls are made from server-side route handlers.

### Auth
- `VERCEL_TOKEN` — Personal Access Token from Vercel dashboard (Settings → Tokens)
- Token scopes needed: `Deployments:Read/Write`, `Projects:Read/Write`
- **Never** use a team member's personal token in production — use a service account token
- All API calls require `Authorization: Bearer ${VERCEL_TOKEN}` header

### API Endpoints Used
| Tool | Endpoint | Version |
|------|----------|---------|
| listDeploys | `/v7/deployments` | v7 |
| getDeployLog | `/v2/deployments/{id}/events` | v2 |
| listProjects | `/v9/projects` | v9 |
| createProject | `/v10/projects` | v10 |
| redeploy | `/v13/deployments` | v13 |

### Rate Limits
- Vercel API: 600 requests per minute for authenticated requests
- Deployment creation: 100 per minute
- Build log polling: max 1 request per second per deployment

### Webhook Verification
Incoming webhooks at `/api/vercel/webhook` are HMAC-SHA1 verified using `VERCEL_WEBHOOK_SECRET`. Events include: `deployment.created`, `deployment.succeeded`, `deployment.error`, `deployment.canceled`.

### Events Polling
`/api/vercel/events` provides a pollable SSE endpoint for active deployments. Used by the UI to show real-time build progress. Events are buffered in-memory (not persisted) and expire after 15 minutes.

## Business Context

### Why Vercel
Vercel is Neptune's primary deployment platform. Every project — neptune-chat, neptune-v2, neptune-ui, landing pages — deploys to Vercel. This connector gives Neptune agents the ability to:
1. Monitor deployments and respond to failures
2. Create new projects programmatically (landing pages, demo apps)
3. Redeploy projects on demand (after code changes)
4. Inspect build logs to diagnose deployment failures
5. Integrate deployment events into automated workflows

### Use Cases
- **Agent deploys a fix**: Neptune edits repo code → opens PR → merges → triggers Vercel redeploy → monitors build → reports result
- **Landing page generation**: Agent creates HTML artifact → creates Vercel project → deploys → returns URL
- **Build failure triage**: Deployment fails → agent pulls build log → diagnoses error → suggests fix
- **CI/CD pipeline**: GitHub push → Vercel auto-deploy → webhook → Neptune notifies Slack of success/failure

### Team/Project Map
| Project ID | Name | Purpose |
|-----------|------|---------|
| (dynamic) | neptune-chat | Chat UI |
| (dynamic) | neptune-v2 | Coding agent |
| (dynamic) | neptune-ui | Agent UI |
| (dynamic) | neptune-agent-v2 | Open Agents |

## Anti-Patterns

### ❌ NEVER:
1. **Hardcode project IDs** — use `listProjects` to resolve by name
2. **Poll build logs in tight loops** — use webhook events or the events SSE endpoint instead
3. **Create projects without checking if name exists** — Vercel will reject duplicate names
4. **Pass `VERCEL_TOKEN` to client-side code** — it's server-only
5. **Use deprecated API versions** — always use the latest stable version (v7 deployments, v10 projects, v13 deploy)
6. **Ignore build error codes** — `ERR_` prefixed errors in build logs have specific meanings
7. **Redeploy without checking if another deploy is in progress** — concurrent deploys can race
8. **Assume `data.deployments` is always returned** — check for `data.projects` fallback on older API versions

### ⚠️ DANGEROUS:
- Deleting projects via API (not exposed as a tool, intentionally)
- Changing project environment variables without confirmation
- Redeploying production without verifying preview deploy first

## Safeguards

### Error Handling
- Always check `res.ok` before parsing response body
- Provide clear error messages with status codes and truncated response bodies
- Handle `401` (invalid token), `403` (insufficient scope), `404` (not found), `429` (rate limited) specially
- For rate limits: exponential backoff with jitter (1s, 2s, 4s, 8s max)

### Validation
- `projectId` must match `/^prj_/` pattern
- `deploymentId` must match `/^dpl_/` pattern
- Framework enum is strict (nextjs, vite, gatsby, remix, astro, nuxt, sveltekit, other)
- Environment variables with `encrypted` type are stored encrypted at rest by Vercel

### Security
- Never log full bearer tokens
- Sanitize environment variable values in responses (truncate to first 4 chars)
- HMAC-SHA1 webhook verification prevents spoofed events
- Team ID isolation prevents cross-team access

## Common Workflows

### Deploy a Landing Page
```typescript
// 1. Create a new Vercel project
const project = await createProject({
  name: "landing-2026-06-09",
  framework: "nextjs",
  environmentVariables: [
    { key: "NEXT_PUBLIC_TITLE", value: "My Landing", target: ["production"] }
  ]
});

// 2. The project auto-deploys from linked GitHub repo
// 3. Monitor deployment
const deploys = await listDeploys({ projectId: project.id, limit: 1 });
const deployId = deploys.deployments[0].uid;

// 4. Check build logs
const logs = await getDeployLog({ deploymentId: deployId });
```

### Diagnose a Failed Deploy
```typescript
// 1. List recent failed deploys
const deploys = await listDeploys({ 
  projectId: "prj_xxx", 
  state: "ERROR", 
  limit: 3 
});

// 2. Pull build log
const log = await getDeployLog({ 
  deploymentId: deploys.deployments[0].uid 
});

// 3. Check for errors
if (log.hasErrors) {
  console.error("Build errors:", log.errors);
}
```

### CI/CD: Redeploy After Merge
```typescript
const result = await redeploy({
  projectId: "prj_xxx",
  target: "production",
  gitBranch: "main"
});
// Returns: { deploymentId, url, state, inspectorUrl }
```

## Refinement Notes

- **Version:** 1.0.0
- **Created:** 2026-06-09
- **Last Reviewed:** 2026-06-09
- **Source:** API v7-v13 docs, vercel.com/docs/rest-api
- **Related Docs:** /wiki/vercel-deploy-event-loop

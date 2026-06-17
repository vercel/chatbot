---
name: vercel-connector
version: 1.0.0
kind: connector
primary_domain: coding
also_in: [mcp-edits]
tools: [listDeploys, getDeployLog, listProjects, createProject, redeploy, stageEnv]
dependencies: [github-connector]
headline: |
  Vercel deployment platform. Never hardcode project IDs. VERCEL_TOKEN is server-only.
  REST API only per cardinal 6a273f70. Concurrent deploys can race.
type: "skill"
access: internal
---

# Vercel Connector Skill

## Operational Knowledge
Vercel REST API for deployment management. Two production projects: neptune-chat and neptune-v2.

### Cardinal Rules
- REST API ONLY (cardinal 6a273f70) — CLI has silent empty bug
- Never hardcode project IDs — resolve by name via listProjects
- VERCEL_TOKEN server-only, never in client bundles

## Tools
| Tool | Description |
|------|-------------|
| listDeploys | List project deployments |
| getDeployLog | Fetch build/deploy logs |
| listProjects | List all Vercel projects |
| createProject | Create new project |
| redeploy | Trigger production redeploy |
| stageEnv | Stage env vars via REST |

## Anti-Patterns
- NEVER use `vercel env add` CLI
- NEVER hardcode project IDs
- NEVER expose VERCEL_TOKEN to client

## Safeguards
- Check for concurrent deploys before redeploying
- Verify env vars staged before production deploy

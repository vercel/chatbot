---
name: vercel-connector
description: Manage Vercel projects, deployments, build logs, and webhook events
version: 1.0.0
domain: engineering
mcp: false
custom_client: true
type: "skill"
access: internal
---
# Vercel Deploy Integration Pack

## File Capabilities & Paths
- **Custom API Client:** `connectors/vercel/index.ts`
- **Manifest:** `connectors/vercel/manifest.ts`
- **Schema:** `connectors/vercel/schema.ts`

## Available Actions
| Tool | Description |
|------|-------------|
| listDeploys | List recent deployments for a project |
| getDeployLog | Get build logs for a deployment |
| listProjects | List all Vercel projects |
| createProject | Create a new Vercel project |
| redeploy | Trigger a redeployment |
| webhookHandler | Verify and process Vercel webhooks |

---
name: linear-connector
description: Issue tracking and project management
version: 1.0.0
domain: engineering
mcp: false
custom_client: true
type: "skill"
access: internal
---
# Linear Integration Pack

## File Capabilities & Paths
- **Custom API Client:** `connectors/linear/index.ts`
- **Manifest:** `connectors/linear/manifest.ts`
- **Schema:** `connectors/linear/schema.ts`

## Available Actions
| Tool | Description |
|------|-------------|
| searchIssues | Search Linear issues by query |
| createIssue | Create a new Linear issue |
| updateIssue | Update issue status and fields |
| getProjects | List Linear projects |
| getCycles | List active cycles |

---
name: github-connector
description: Repo access, code search, PR management, and V2 coding handoff
version: 1.0.0
domain: engineering
mcp: false
custom_client: true
type: "skill"
access: internal
---
# GitHub Integration Pack

## File Capabilities & Paths
- **Custom API Client:** `connectors/github/index.ts`
- **Manifest:** `connectors/github/manifest.ts`
- **Schema:** `connectors/github/schema.ts`

## Available Actions
| Tool | Description |
|------|-------------|
| readRepo | Read a file or directory from a GitHub repo |
| searchCode | Search code across repositories |
| createPR | Create a pull request with title and body |
| listPRs | List open pull requests |
| createBranch | Create a new Git branch |
| commitFile | Commit a file to a branch |
| dispatchWorkflow | Trigger a GitHub Actions workflow |

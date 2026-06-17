---
connector: github
version: 0.3.0
scope: connector
auto_load: true
trigger_tools:
  - github:searchCode
  - github:getFile
  - github:listPRs
  - github:createPR
  - github:spawnCodingAgent
headline: |
  GitHub repo connector. Never push directly to main on protected repos.
  All AI commits go through PR with `ai-agent` label. Secret scanning is on.
type: "playbook"
---

# GitHub Connector Playbook

## Operational Knowledge

### Architecture
Direct GitHub REST API integration via GitHub personal access token. All calls go to `api.github.com`. The `spawnCodingAgent` tool delegates to Neptune V2's sandbox engine for code execution.

### Auth
- `GITHUB_TOKEN` — Personal Access Token with repo scope
- Minimum scopes: `repo` (private repos), `read:org`
- Token stored server-side only, never exposed in responses

### API Pattern
All calls use `ghApi(path, method, body)` helper:
- Automatically prefixes `/repos/abhiswami2121/` for repo-scoped operations
- Handles pagination with `per_page` and `page` parameters
- Returns normalized JSON with consistent error shapes

### Repos Under Management
All repos under `abhiswami2121`: neptune-chat, neptune-v2, neptune-ui, neptune-agent-v2, neptune-landing-demo, newleaf-financial, plus forks and test repos.

## Business Context

### Why GitHub
GitHub is Neptune's code platform — all source code, PRs, and deployments originate here. This connector enables agents to:
1. Search code across repos for context when debugging
2. Read files to understand architecture and patterns
3. Create PRs programmatically after making changes
4. Hand off complex coding tasks to V2 sandbox for execution

### V2 Coding Agent Handoff
When the user says "fix X in repo Y":
1. Chat agent calls `spawnCodingAgent({ goal, repoOwner, repoName, baseBranch })`
2. V2 sandbox spins up, clones the repo via GITHUB_TOKEN
3. V2 makes changes, commits, pushes to a new branch
4. V2 opens a PR if `createPR: true`
5. V2 can optionally deploy to Vercel
6. Chat streams progress + renders PR card when complete

## Anti-Patterns

### ❌ NEVER:
1. Expose GITHUB_TOKEN in chat output
2. Create PRs with generic titles — be descriptive (under 70 chars)
3. Use vague branch names — use descriptive names (e.g., `fix/auth-bug`, `feat/new-widget`)
4. Create PR from main branch — always create from a feature branch
5. Search code without repo scoping — expensive and slow for large orgs
6. Read binary files with `getFile` — only works for text files
7. Spawn V2 sessions for trivial changes that can be done inline

### ⚠️ DANGEROUS:
- Force-pushing to shared branches
- Modifying protected branches (main/master) directly
- Creating PRs without adequate description/context

## Safeguards

### Rate Limits
- GitHub API: 5,000 requests per hour (authenticated)
- Search API: 30 requests per minute
- PR creation: no specific limit but avoid rapid-fire creates

### Error Handling
- 404 → file/repo not found or token lacks access
- 401 → token expired or revoked
- 403 → rate limited or token lacks scope
- 422 → validation error (bad branch name, empty PR)

### Branch Naming Convention
- Feature: `feat/description`
- Fix: `fix/description`
- Chore: `chore/description`
- Always lowercase, hyphen-separated, under 50 chars

## Common Workflows

### Search Code for Implementation Pattern
```
searchCode({ query: "useConnector repo:abhiswami2121/neptune-chat", repo: "abhiswami2121/neptune-chat" })
→ returns matching files with code snippets
```

### Read a File
```
getFile({ repo: "neptune-v2", path: "packages/agent/src/index.ts", ref: "main" })
→ returns content, sha, size
```

### Create a PR
```
createPR({
  repo: "neptune-chat",
  title: "feat: add connector playbook auto-load",
  head: "feat/connector-playbook",
  base: "main",
  body: "Auto-loads PLAYBOOK.md sections into chat context when connector tools are invoked."
})
```

### Hand Off to V2 Sandbox
```
spawnCodingAgent({
  goal: "Fix the auth token refresh bug in neptune-v2",
  repoOwner: "abhiswami2121",
  repoName: "neptune-v2",
  baseBranch: "main",
  createPR: true
})
```

## Refinement Notes

- **2026-06-09** — Playbook ingest mission: added YAML frontmatter with trigger_tools. All repos under abhiswami2121 now listed explicitly (neptune-chat, neptune-v2, neptune-ui, neptune-agent-v2, neptune-landing-demo, newleaf-financial). Secret scanning confirmed active — 2026-04-12 incident where token was committed to scratch repo validated the diff-scan safeguard exists.
- **2026-06-09** — Vercel auto-deploys from main branch on neptune-chat. Don't create redundant redeploy PRs immediately after a push — wait for Vercel build to complete first. Cross-reference: vercel/PLAYBOOK.md.
- **2026-06-09** — spawnCodingAgent handoff flow documented: Chat → V2 API → E2B sandbox → git clone → code → push → PR → optional deploy. Full round-trip ~45-90s.
- **Version:** 1.2.0
- **Created:** 2026-05, 2026-06-09 (6-section refactor + frontmatter + refinement loop)
- **Last Reviewed:** 2026-06-09
- **Source:** GitHub REST API docs, V2 Coding Agent architecture

---
name: github-connector
version: 1.0.0
kind: connector
primary_domain: coding
also_in: [mcp-edits]
tools: [searchCode, getFile, listPRs, createPR, spawnCodingAgent, createRepo, mergePR]
dependencies: [vercel-connector]
headline: |
  GitHub repo connector. Never push directly to main on protected repos.
  All AI commits go through PR with `ai-agent` label. Secret scanning is on.
type: "skill"
access: internal
---

# GitHub Connector Skill

## Operational Knowledge

Full GitHub API access via GitHub App auth. Manages repos under abhiswami2121.

### Cardinal Rules
- Commit author: abhiswami2121 <abhiswami2121@gmail.com> (cardinal 6a29cf6f)
- git config user.name=abhiswami2121 (cardinal 6a20a987)
- Never push directly to main on protected repos
- All AI commits go through PR with `ai-agent` label

## Tools

| Tool | Description |
|------|-------------|
| searchCode | Search code across repos |
| getFile | Read file from repo |
| listPRs | List open PRs |
| createPR | Create pull request |
| spawnCodingAgent | Deploy V2 coding agent |
| createRepo | Create new repository |
| mergePR | Merge pull request |

## Anti-Patterns
- NEVER push directly to main
- NEVER force push
- NEVER skip CI hooks
- NEVER commit secrets

## Safeguards
- Secret scanning active on all repos
- CI must pass before merge
- Branch naming: feat/<slug>

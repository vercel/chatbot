---
name: linear-connector
version: 1.0.0
kind: connector
primary_domain: support-triage
also_in: [reporting, mcp-edits]
tools: [listIssues, createIssue, searchIssues, listProjects, updateIssue]
dependencies: []
headline: |
  Linear issue tracker. Route to correct team (ENG/OPS/PAY/COMP/AGT). Never auto-close without closing comment.
type: "skill"
---

# Linear Connector Skill

## Operational Knowledge
Linear GraphQL API for issue tracking. Teams: ENG, OPS, PAY, COMP, AGT.

## Tools
| Tool | Description |
|------|-------------|
| listIssues | List issues with filters |
| createIssue | Create new issue |
| searchIssues | Full-text search |
| listProjects | List team projects |
| updateIssue | Update status/assignee |

## Anti-Patterns
- NEVER auto-close without closing comment
- NEVER assign without verifying team exists

## Safeguards
- Priority 1 = urgent, confirm on-call paged
- Include trace ID in all created issues

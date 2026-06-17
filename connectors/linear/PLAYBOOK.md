---
connector: linear
version: 0.3.0
scope: connector
auto_load: true
trigger_tools:
  - linear:listIssues
  - linear:createIssue
  - linear:searchIssues
  - linear:listProjects
headline: |
  Linear issue tracker. Route to correct team (ENG/OPS/PAY/COMP/AGT). Never auto-close
  without closing comment. Priority 1 means urgent — confirm on-call is paged.
type: "playbook"
---

# Linear Connector Playbook

## Operational Knowledge

### Architecture
Direct Linear GraphQL API integration. All calls go to `api.linear.app/graphql`. Uses a GraphQL helper `linearQuery(query, variables)` that handles auth headers and error normalization.

### Auth
- `LINEAR_API_KEY` — Personal API key from Linear Settings → API
- Required scopes: `read`, `write` (for issue creation)
- Admin scope NOT required for basic operations

### GraphQL Pattern
All interactions use GraphQL queries/mutations:
- Queries: `issues`, `projects`, `searchIssues`
- Mutations: `issueCreate`
- Variables passed as second argument to `linearQuery`

### Rate Limits
- Linear GraphQL API: 1,500 requests per hour
- Complexity-based rate limiting (query cost estimation)

## Business Context

### Why Linear
Linear is NewLeaf's issue tracking and project management tool. Tasks, bugs, features, and operational items are tracked here. This connector enables agents to:
1. Query existing issues for context (has this been reported before?)
2. Create issues automatically from operational events
3. Search for related issues by identifier or keyword
4. Monitor project progress

### Issue Priority Convention
- 0: Urgent (P0 — drop everything)
- 1: High (P1 — this sprint)
- 2: Medium (P2 — next sprint)
- 3: Low (P3 — backlog)
- 4: No priority

## Anti-Patterns

### ❌ NEVER:
1. Create issues without team assignment — unassigned issues get lost
2. Use generic titles — be specific and actionable
3. Create duplicate issues — search first
4. Set priority without understanding business impact
5. Assign to team members without their awareness

### ⚠️ DANGEROUS:
- Bulk issue creation without rate limiting
- Modifying issues assigned to active sprints
- Creating issues with PII in titles or descriptions

## Safeguards

### Issue Creation Checklist
- [ ] Searched for existing issues first
- [ ] Title is descriptive and actionable
- [ ] Team ID is correct and verified
- [ ] Priority reflects actual business impact
- [ ] Description includes reproduction steps (if bug) or requirements (if feature)

### Error Handling
- Invalid team → list available teams
- Duplicate title → warn but allow creation
- Rate limited → exponential backoff
- Auth failure → check LINEAR_API_KEY

## Common Workflows

### List Open Issues for a Team
```
listIssues({ teamId: "team_abc", status: "Todo", limit: 20 })
→ returns issues array with identifiers and titles
```

### Create a Bug Report
```
createIssue({
  teamId: "team_abc",
  title: "NMI charge fails with code 225 for recovery wizard",
  description: "Steps to reproduce...",
  priority: 1
})
→ returns id, identifier (e.g., NMI-456), url
```

### Search for an Issue
```
searchIssues({ query: "NMI-123", limit: 5 })
→ returns matching issues by identifier or keyword
```

### Monitor Project Progress
```
listProjects({ teamId: "team_abc" })
→ returns projects with status and progress
```

## Refinement Notes

- **Version:** 1.0.0
- **Created:** 2026-06-09
- **Last Reviewed:** 2026-06-09
- **Source:** Linear GraphQL API docs, NewLeaf issue tracking conventions

---
name: linear-skills
version: 1.0.0
connector: linear
scope: neptune-custom
total_actions: 25
priority: P1
intent_tags:
  - linear
  - issues
  - projects
  - sprint
  - agile
associated_connectors:
  - github
  - slack
headline: |
  25 Linear actions: issues, projects, teams, cycles, views, comments,
  labels, and workflow automation. Full project management.
type: "skill"
access: internal
---

# Linear Skills — 25 Actions

## Core Intent
Complete Linear project management: create and manage issues, organize projects, track cycles/sprints, manage teams, configure views, and automate workflows. All actions go through the Linear GraphQL API.

## Action Catalog

### Issue Management (7 actions)
| # | Action | Description |
|---|--------|-------------|
| 1 | `issue.list` | List issues with filters (team, status, assignee, priority) |
| 2 | `issue.create` | Create an issue with title, description, team, priority |
| 3 | `issue.get` | Get issue details by identifier (e.g., NMI-456) |
| 4 | `issue.update` | Update issue status, assignee, priority, labels |
| 5 | `issue.search` | Search issues by keyword, identifier, or filter |
| 6 | `issue.comment` | Add a comment to an issue |
| 7 | `issue.close` | Close an issue with resolution status |

### Project Management (4 actions)
| 8 | `project.list` | List all projects with progress and status |
| 9 | `project.create` | Create a new project with description |
| 10 | `project.get` | Get project details with milestones |
| 11 | `project.update` | Update project name, description, status |

### Team Management (3 actions)
| 12 | `team.list` | List all teams with member counts |
| 13 | `team.members` | List team members with roles and workload |
| 14 | `team.issues` | List issues assigned to a team |

### Cycle/Sprint Management (4 actions)
| 15 | `cycle.list` | List active and upcoming cycles for a team |
| 16 | `cycle.create` | Create a new cycle with start/end dates |
| 17 | `cycle.progress` | Get cycle progress with burndown data |
| 18 | `cycle.issues` | List issues in a specific cycle |

### Views & Labels (4 actions)
| 19 | `view.list` | List saved views for a team |
| 20 | `view.create` | Create a custom view with filters |
| 21 | `label.list` | List all labels with issue counts |
| 22 | `label.create` | Create a new label with color |

### Workflow & Automation (3 actions)
| 23 | `workflow.state` | Get workflow states for a team |
| 24 | `workflow.transition` | Transition an issue to a different state |
| 25 | `webhook.list` | List configured webhooks |

## Operational Context
- All calls use `linearQuery(query, variables)` GraphQL helper
- Priority convention: 0=Urgent, 1=High, 2=Medium, 3=Low, 4=No priority
- Rate limit: 1,500 requests per hour
- NEVER create issues without team assignment
- NEVER set priority without understanding business impact

## Anti-Patterns
- NEVER create duplicate issues — search first
- NEVER use generic titles — be specific and actionable
- NEVER assign to team members without their awareness
- NEVER create issues with PII in titles or descriptions
- NEVER modify issues assigned to active sprints without coordination

## Workflow Examples

### Bug Report from Production
```
1. issue.search({ query: "NMI charge failure" }) → check duplicates
2. issue.create({ teamId, title, description, priority: 1 })
3. issue.comment({ issueId, body: "Found in production, 5 customers affected" })
```

### Sprint Planning
```
1. team.list()
2. cycle.create({ teamId, name: "Sprint 24", startDate, endDate })
3. cycle.issues({ cycleId }) → review current scope
```

### Project Status Report
```
1. project.list({ teamId })
2. project.get({ projectId }) → check milestones
3. cycle.progress({ cycleId }) → burndown chart data
```

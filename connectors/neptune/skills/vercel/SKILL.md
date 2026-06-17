---
name: vercel-skills
version: 1.0.0
connector: vercel
scope: neptune-custom
total_actions: 25
priority: P1
intent_tags:
  - vercel
  - deploy
  - hosting
  - domain
  - dns
associated_connectors:
  - github
  - slack
headline: |
  25 Vercel actions: deployments, projects, domains, environment variables,
  analytics, logs, security, and team management. Full platform management.
type: "skill"
access: internal
---

# Vercel Skills — 25 Actions

## Core Intent
Complete Vercel platform management: manage deployments, create projects, configure domains and DNS, set environment variables, monitor analytics, inspect logs, and manage team settings. All actions go through Vercel REST API v7-v13.

## Action Catalog

### Deployment Management (6 actions)
| # | Action | Description |
|---|--------|-------------|
| 1 | `deploy.list` | List deployments with filters (state, project, branch) |
| 2 | `deploy.create` | Create a new deployment from git or file upload |
| 3 | `deploy.get` | Get deployment details with build status |
| 4 | `deploy.cancel` | Cancel an in-progress deployment |
| 5 | `deploy.rollback` | Rollback to a previous deployment |
| 6 | `deploy.redeploy` | Redeploy a project from the latest commit |

### Build Logs & Diagnostics (3 actions)
| 7 | `build.log` | Get build logs for a deployment |
| 8 | `build.events` | Stream real-time build events |
| 9 | `build.errors` | Extract error details from failed builds |

### Project Management (4 actions)
| 10 | `project.list` | List all projects with framework and status |
| 11 | `project.create` | Create a new project with framework selection |
| 12 | `project.get` | Get project details with linked git repo |
| 13 | `project.delete` | Delete a project with safety confirmation |

### Domain & DNS Management (4 actions)
| 14 | `domain.list` | List domains for a project |
| 15 | `domain.add` | Add a custom domain to a project |
| 16 | `domain.verify` | Verify DNS configuration for a domain |
| 17 | `domain.dns` | Get recommended DNS records |

### Environment Variables (3 actions)
| 18 | `env.list` | List environment variables for a project |
| 19 | `env.create` | Add environment variables with target selection |
| 20 | `env.delete` | Remove an environment variable |

### Analytics & Monitoring (3 actions)
| 21 | `analytics.overview` | Project traffic and performance overview |
| 22 | `analytics.audit` | Lighthouse scores and Core Web Vitals |
| 23 | `analytics.errors` | Runtime error tracking and trends |

### Security & Team (2 actions)
| 24 | `security.headers` | View/configure security headers |
| 25 | `team.members` | List team members and roles |

## Operational Context
- API endpoints: v7 (deployments), v9 (projects), v10 (create), v13 (deploy)
- Auth: Bearer token via VERCEL_TOKEN (server-only, never exposed)
- Rate limit: 600 requests/minute (authenticated)
- NEVER hardcode project IDs — resolve by name via `project.list`
- NEVER poll build logs in tight loops — use webhook events

## Anti-Patterns
- NEVER hardcode project IDs
- NEVER expose VERCEL_TOKEN to client-side code
- NEVER create projects without checking name uniqueness
- NEVER redeploy without checking for concurrent deploys
- NEVER use deprecated API versions

## Workflow Examples

### Ship a Feature
```
1. project.list() → find project by name
2. deploy.create({ projectId, target: "production", gitSource })
3. build.events({ deploymentId }) → monitor progress
4. deploy.get({ deploymentId }) → verify success
```

### Diagnose Failed Deploy
```
1. deploy.list({ projectId, state: "ERROR", limit: 3 })
2. build.log({ deploymentId }) → get full log
3. build.errors({ deploymentId }) → extract specific errors
```

### Configure Custom Domain
```
1. domain.add({ projectId, domain: "app.newleaf.com" })
2. domain.dns({ domain }) → get required records
3. domain.verify({ domain }) → confirm propagation
```

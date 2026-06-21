# Twenty CRM — Architecture

## Technology Stack
| Component | Technology | Role |
|-----------|-----------|------|
| Backend | NestJS (TypeScript) | REST + GraphQL + business logic |
| Frontend | React 18 + Twenty UI | CRM workspace UI |
| Database | PostgreSQL 16 | Primary data store |
| Cache/Queue | Redis 7 + BullMQ | Background jobs, rate limiting, sessions |
| Worker | NestJS worker process | Cron jobs, email, calendar sync |
| Search | Built-in (Postgres) | Record search + filtering |
| Storage | Local FS or S3-compatible | File attachments, avatars |
| SDK | twenty-sdk (TypeScript) | App extension layer |

## Service Topology
```
┌──────────────────────────────────────────────┐
│                  nginx :443                   │
│              crm.newleaf.financial             │
└──────────────────┬───────────────────────────┘
                   │ proxy_pass
┌──────────────────▼───────────────────────────┐
│          twenty-server :3000                  │
│         (NestJS core backend)                 │
│         healthcheck: /healthz                 │
└────────┬─────────────────┬───────────────────┘
         │                 │
    ┌────▼────┐       ┌───▼──────┐
    │ postgres│       │  redis   │
    │  :5432  │       │  :6379   │
    └─────────┘       └──────────┘
         │
    ┌────▼────────┐
    │ worker      │
    │ (BullMQ     │
    │  jobs)      │
    └─────────────┘
```

## Monorepo Structure (21 Packages)
```
twenty/
├── packages/
│   ├── twenty-server/         # NestJS backend (engine)
│   │   └── src/engine/
│   │       ├── core-modules/  # 70+ modules: auth, workspace, workflow, webhook
│   │       ├── metadata-modules/ # 40+ flat modules: object, field, relation metadata
│   │       ├── api/           # GraphQL + REST endpoints
│   │       ├── twenty-orm/    # Custom ORM with workspace scoping
│   │       └── workspace-manager/ # Multi-tenancy + schema management
│   ├── twenty-front/          # React UI (workspace)
│   │   └── src/modules/       # Feature modules: activities, settings, workflows
│   ├── twenty-ui/             # Design system components
│   ├── twenty-shared/         # Shared types + constants
│   ├── twenty-sdk/            # Extension SDK (defineObject, defineLogicFunction, etc.)
│   ├── twenty-client-sdk/     # API clients (CoreApiClient, RestApiClient)
│   ├── twenty-claude-skills/  # Claude agent skill definitions
│   ├── twenty-docker/         # Docker compose + install scripts
│   ├── create-twenty-app/     # App scaffold CLI
│   └── ...                    # 12 more packages
```

## Key Architecture Properties
- **Metadata Engine:** Schema defined declaratively via SDK, auto-migrated, auto-validated
- **GraphQL Autogen:** All objects get typed GraphQL endpoints without manual wiring
- **RBAC Auto-Applied:** Permissions from role definitions propagate to all new objects
- **Multi-Tenant:** Workspace isolation via PostgreSQL schema-level namespacing
- **Single-Tenant Mode:** NewLeaf runs with `IS_MULTIWORKSPACE_ENABLED=false`
- **Healthcheck:** `/healthz` endpoint, `pg_isready`, `redis-cli ping`

## Engine Module Hierarchy
### Core Modules (70+)
`auth/`, `api-key/`, `jwt/`, `user/`, `workspace/`, `workspace-member/`, `role/`, `webhook/`, `workflow/`, `logic-function/`, `serverless-function/`, `app/`, `skill/`, `agent/`, `billing/`, `calendar/`, `messaging/`, `note/`, `task/`, `activity/`, `attachment/`, `audit-log/`, `feature-flag/`, `upgrade/`, `mcp/`, `ai/`, `code-interpreter/`, `analytics/`, ...

### Metadata Modules (40+)
Flat modules each defining one standard object/field: `person-metadata/`, `company-metadata/`, `opportunity-metadata/`, `note-metadata/`, `task-metadata/`, `activity-metadata/`, `webhook-metadata/`, `workflow-metadata/`, `role-metadata/`, `api-key-metadata/`, `view-metadata/`, `field-metadata/`, `relation-metadata/`, `object-metadata/`, ...

### APIs
| API | Endpoint | Client |
|-----|----------|--------|
| GraphQL | `/graphql` | CoreApiClient |
| REST | `/rest/{object}` | RestApiClient |
| Metadata | `/metadata` | MetadataApiClient |
| MCP | `/mcp` | MCP-compatible tools |
| WebSocket | `/ws` | Real-time subscriptions |

## NewLeaf Production Stack
| Container | Port | Image | Status |
|-----------|------|-------|--------|
| twenty-newleaf-server | 3002→3000 | twentyhq/twenty-server | HEALTHY |
| twenty-newleaf-worker | — | twentyhq/twenty-worker | HEALTHY |
| twenty-newleaf-db | 5434→5432 | postgres:16 | HEALTHY |
| twenty-newleaf-redis | 6382→6379 | redis:7 | HEALTHY |

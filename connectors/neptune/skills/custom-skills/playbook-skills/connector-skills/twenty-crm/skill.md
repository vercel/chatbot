# Twenty CRM — Connector Skill

**Domain:** customer-enrollment, billing-flow, credit-disputes, support-triage  
**Priority:** P0 — North Star for CRM migration  
**Status:** Foundation — Phase 27 (2026-06-17)

---

## What Twenty CRM Is

Twenty CRM is the open-source CRM platform deployed at `crm.newleaf.financial`. It serves as the **Neptune Command Center** — the unified workspace where sales agents, billing specialists, and support agents manage NewLeaf customer relationships.

Twenty stores the **business view** of customer data: profiles, subscriptions, payment history, dispute status, enrollment pipelines, and support tickets. It complements Base44 (operational database) and NMI (payment vault) by providing a user-friendly UI with pipelines, views, dashboards, and workflows.

### Key Capabilities
- **Customer 360** — Person profiles with linked subscriptions, payments, disputes, activities
- **Pipelines** — Kanban views for enrollment and dispute stages
- **Views** — Table, Kanban, Calendar with filters, sorting, grouping
- **Workflows** — Automated actions on record changes (Phase 31+)
- **Extensions** — Custom objects, fields, and logic via TypeScript SDK
- **API** — Auto-generated REST + GraphQL per workspace schema

### Architecture
- **Backend:** NestJS + PostgreSQL 16 + Redis 7 + BullMQ
- **Frontend:** React + Jotai + Linaria + Lingui
- **API:** Bearer token auth, 100 req/min, 60 records/batch
- **Webhooks:** Record lifecycle events with HMAC SHA256 signing
- **Auth:** Password-based (invite-only), OAuth 2.0, SSO

---

## When to Use This Skill

### ALWAYS use Twenty CRM when:
- Querying or updating customer **profile** data (name, email, phone, status, agent)
- Reading or updating **subscription** state (amount, frequency, billing status)
- Viewing **payment history** (transaction records)
- Managing **credit disputes** (rounds, status, bureau items)
- Tracking **enrollment** pipeline (onboarding status, agreements)
- Creating or updating **support tickets** (Linear-linked)
- Viewing customer **activity timeline** (SMS, emails, calls, notes)
- Performing **bulk sync** from Base44 to Twenty

### DO NOT use Twenty CRM when:
- **Processing payments** — Use NMI MCP (memory 6a1f118b)
- **Storing card data** — NMI vault only
- **Querying raw operational data** — Use Base44 directly
- **Sending SMS/emails** — Use GHL/SendGrid connectors
- **Managing agent state** — Use Base44 AgentState

---

## Authentication

### API Access
```
Authorization: Bearer <TWENTY_API_KEY>
Base URL: https://crm.newleaf.financial
```

API keys are created in **Twenty Settings → API & Webhooks**. Keys are shown once. Scoped to workspace role.

### OAuth 2.0 (Phase 28+)
- Authorization Code + PKCE for user-facing apps
- Client Credentials for server-to-server
- Token endpoint: `POST /oauth/token`
- Discovery: `/.well-known/oauth-authorization-server`
- Scopes: `api` (full r/w), `profile` (user)

### Extension Auth
- `TWENTY_APP_ACCESS_TOKEN` auto-injected into logic functions and front components
- Short-lived, role-scoped
- Secret variables available in logic functions only

---

## API Surface

### Core API (CRUD on records)
| Method | Path | Purpose |
|---|---|---|
| POST | `/graphql` | GraphQL queries + mutations (batch upsert, relation traversal) |
| GET | `/rest/people` | List people (filter, sort, paginate) |
| POST | `/rest/people` | Create person |
| GET | `/rest/people/:id` | Read person |
| PATCH | `/rest/people/:id` | Update person |
| DELETE | `/rest/people/:id` | Delete person |

Same pattern for all objects including custom: `subscriptions`, `paymentRecords`, `creditDisputes`, `enrollments`, `activities`, `supportTickets`.

### Metadata API
| Method | Path | Purpose |
|---|---|---|
| POST | `/metadata` | GraphQL schema operations |
| POST | `/rest/metadata/objects` | Create/update object definitions |

### Webhooks
- Events: `record.created`, `record.updated`, `record.deleted`
- All objects (standard + custom)
- HMAC SHA256 signature verification
- Headers: `X-Twenty-Webhook-Signature`, `X-Twenty-Webhook-Timestamp`

### Rate Limits
- 100 requests per minute
- 60 records per batch operation

---

## Related Memory

| Memory | Reference |
|---|---|
| Universal Integration Mastery Protocol | 6a1e2ddb |
| NMI Vault Sacred | 6a1f118b |
| Twenty Research Dossier | jarvis/cortex/research/twenty-crm-master-dossier-2026-06-17.md |
| NewLeaf Data Model | connector-skills/twenty-crm/data-model.md |

---

## Dependencies

- **Twenty CRM** deployed on VPS (crm.newleaf.financial)
- **Base44** as operational source of truth
- **NMI** for payment operations (sacred boundary)
- **Linear** for ticket sync (Phase 30)

---

**Skill created:** 2026-06-17 | **Phase 27**

---
type: "audit"
name: "Twenty Crm Installation Audit 2026 06 17"
description: "Auto-generated description for Twenty Crm Installation Audit 2026 06 17"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Twenty CRM Installation Audit — 2026-06-17

> **Phase:** Pre-Phase 33 baseline research
> **Host:** `crm.newleaf.financial` → VPS backend (nginx proxy)
> **Containers:** Docker Compose v3 at `/home/hermes/services/twenty-self-host/`
> **Scope:** Read-only health check + architecture audit

---

## 1. Deployment Model

### Docker Compose Stack (`docker-compose.newleaf.yml`)

| Service | Image | Port | Status | Health |
|---------|-------|------|--------|--------|
| `twenty-newleaf-server` | `twentycrm/twenty:latest` | 3002→3000 | Up 2 weeks | ✅ healthy |
| `twenty-newleaf-worker` | `twentycrm/twenty:latest` | — | Up 2 weeks | N/A (depends on server) |
| `twenty-newleaf-db` | `postgres:16` | 5434→5432 | Up 2 weeks | ✅ healthy |
| `twenty-newleaf-redis` | `redis:7-alpine` | 6382→6379 | Up 2 weeks | ✅ healthy |

**Image:** `twentycrm/twenty:latest` (tag: latest, pulled ~2 weeks ago)
**All containers:** `restart: always`, named volumes for data persistence

### Volume Bindings
```
/home/hermes/data/twenty/storage   → /app/packages/twenty-server/.local-storage  (server + worker)
/home/hermes/data/twenty/postgres  → /var/lib/postgresql/data                     (db)
/home/hermes/data/twenty/redis     → /data (AOF persistence, noeviction policy)
```

### Resource Usage (5-sec snapshot)

| Container | CPU % | Memory | Mem % | Net I/O |
|-----------|-------|--------|-------|---------|
| twenty-server | 0.00% | 614.5 MiB | 3.84% | 191 MB / 601 MB |
| twenty-worker | 0.22% | 587.4 MiB | 3.67% | 2.34 GB / 4.63 GB |
| twenty-db | 0.00% | 55.5 MiB | 0.35% | 764 MB / 854 MB |
| twenty-redis | 0.40% | 16.5 MiB | 0.10% | 4.09 GB / 1.66 GB |
| **TOTAL** | **0.62%** | **1.27 GiB** | **7.96%** | **8.8 GB** |

**Assessment:** Very light load. 1.27 GiB memory for full CRM stack on 15.62 GiB host. Ample headroom for growth.

---

## 2. Configuration Summary (sanitized)

```yaml
# Server
SERVER_URL:             https://crm.newleaf.financial
FRONT_BASE_URL:         https://crm.newleaf.financial
NODE_PORT:              3000
STORAGE_TYPE:           local
APP_SECRET:             64-char hex (present)
ENCRYPTION_KEY:         44-char base64 (present)
IS_SIGN_UP_ENABLED:     true
IS_MULTIWORKSPACE:      true
AUTH_PASSWORD_ENABLED:  true
EMAIL_DRIVER:           logger  (no real SMTP yet)

# Worker
DISABLE_DB_MIGRATIONS:  true   (only server runs migrations)
DISABLE_CRON_JOBS:      true   (only server runs cron)
```

**Security observation:** `IS_SIGN_UP_ENABLED=true` — public sign-ups are open. Should be disabled in production (`false`) to prevent unauthorized workspace creation.

---

## 3. Health Check

```
GET /healthz → {"status":"ok","info":{},"error":{},"details":{}}
```

All 4 containers passing health checks:
- Server: `curl --fail http://localhost:3000/healthz` (5s interval, 20 retries, 30s start)
- DB: `pg_isready -U twenty -h localhost -d twenty` (5s interval, 10 retries)
- Redis: `redis-cli ping` (5s interval, 10 retries)
- Worker: depends on both DB (healthy) + Server (healthy)

---

## 4. API Surface

### GraphQL
```
POST /graphql → Standard GraphQL endpoint
  - Introspection: DISABLED (production security best practice ✅)
  - Auth: Bearer token via Authorization header
  - Namespace: Workspace-level — fields differ per workspace schema
```

### REST API (auto-generated per workspace)
```
GET /rest/people/:id        → Fetch person (requires auth)
POST /rest/people           → Create person (requires auth)
GET /rest/companies/:id     → Fetch company
POST /rest/companies        → Create company
[Additional endpoints auto-generated per custom object]
```

### Authentication
- Password-based auth (AUTH_PASSWORD_ENABLED=true)
- Bearer token API access (Settings → API & Webhooks)
- Response: `{"statusCode":403,"messages":["Missing authentication token"]}` when unauthenticated

### Webhook Support
- Record lifecycle events (create/update/delete) per custom object
- HMAC SHA256 signing
- Configurable via Twenty Settings → Webhooks

---

## 5. Custom Objects Architecture (Planned — Not Yet Deployed)

### Location: `/home/neptune/twenty-newleaf-extensions/src/`

```
objects/
├── subscription.object.ts     (22 fields, 1 relation — personId FK)
├── payment-record.object.ts   (12 fields, 2 relations — personId, subscriptionId FK)
├── credit-dispute.object.ts   (13 fields, 1 relation — personId FK)
├── enrollment.object.ts       (21 fields, 1 relation — personId FK)
├── activity.object.ts         (9 fields, 1 relation — personId FK)
└── support-ticket.object.ts   (14 fields, 1 relation — personId FK)

fields/
└── person-extensions.field.ts (20 custom fields on built-in Person)
```

**Total:** 6 custom objects, 109 custom fields, 8 relations, 20 Person extensions

### Person Custom Fields (extending built-in Twenty Person)
```
base44Id, status (SELECT), enrollmentStatus (SELECT), agentEmail, 
phone, address, ssnLast4, dateOfBirth, creditScore, creditBureau,
monthlyPayment, nextPaymentDate, totalDebt, creditorCount,
enrolledDate, cancelledDate, source, tags (MULTI_SELECT), 
notes (RICH_TEXT), lastContactDate
```

### Relationship Graph
```
Person (extended) ──1:N──▶ Subscription (custom) ──1:N──▶ PaymentRecord (custom)
Person (extended) ──1:N──▶ CreditDispute (custom)  → DisputeItem (inline JSON)
Person (extended) ──1:1──▶ Enrollment (custom)
Person (extended) ──1:N──▶ Activity (custom)
Person (extended) ──1:N──▶ SupportTicket (custom)
```

### Deployment Status
```
❌ Extensions NOT YET DEPLOYED to running Twenty instance
   - Source exists at /home/neptune/twenty-newleaf-extensions/
   - Package.json, tsconfig.json scaffolded
   - Schema files drafted but not built/published
   - Needs: npx twenty dev:build → npx twenty app:publish
```

---

## 6. Connector Integration (Neptune Chat Side)

### Connector Skill (twenty-crm)
```
Path: neptune-chat/connectors/neptune/skills/custom-skills/playbook-skills/connector-skills/twenty-crm/
Files:
  ├── skill.md               (4,766 B)  — Skill definition + auth + usage guide
  ├── playbook.md            (5,891 B)  — Domain routing rules
  ├── functions.yaml         (9,490 B)  — 18 GraphQL + REST operations
  ├── data-model.md          (20,848 B) — Full field mapping Base44→Twenty
  ├── deployment-guide.md    (5,531 B)  — Step-by-step deploy instructions
  ├── ui-schema.yaml         (12,949 B) — UI form schema definitions
  └── research-notes.md      (26,100 B) — Foundation research
```

### Available Functions (18 operations)
```
queryPerson, queryPersonByEmail, queryPersonByPhone
createPerson, updatePerson, deletePerson
querySubscription, createSubscription, updateSubscription
queryPaymentRecord, createPaymentRecord
queryCreditDispute, createCreditDispute, updateCreditDispute
queryEnrollment, updateEnrollment
queryActivity, createActivity
querySupportTicket, createSupportTicket
```

---

## 7. Integration Health Assessment

| Check | Status | Detail |
|-------|--------|--------|
| Containers running | ✅ | All 4 healthy, 2 weeks uptime |
| Health endpoint | ✅ | `/healthz` returns OK |
| Port accessible | ✅ | localhost:3002 responds |
| Volume persistence | ✅ | Postgres, Redis, Storage all mapped |
| GraphQL introspection | ✅ | Disabled — production secure |
| Auth required | ✅ | REST/GraphQL returns 403 without token |
| Custom objects | ❌ | Schema drafted, NOT deployed |
| Email driver | ⚠️ | `logger` only — no real SMTP (Resend pending) |
| Sign-ups open | ⚠️ | `IS_SIGN_UP_ENABLED=true` — should be false |
| API key created | ❌ | No API key found — needed for sync |
| Webhook subs | ❌ | No webhooks configured — needed for real-time sync |
| Iframe auth | ❌ | Neptune Chat iframe → Twenty auth not integrated |

---

## 8. Risks & Recommendations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Public sign-ups | High | Set `IS_SIGN_UP_ENABLED=false` immediately |
| No API key | High | Create API key for Neptune Chat ↔ Twenty sync |
| Extensions not deployed | High | Run `twenty app:publish` to add custom objects |
| No SMTP | Medium | Wire Resend for transactional emails |
| No webhooks | Medium | Configure webhooks for real-time CRM→Chat updates |
| Iframe auth gap | Medium | Implement Twenty OAuth/token passthrough for iframe |
| Image not pinned | Low | Pin `twentycrm/twenty` to specific version tag |
| No backup strategy | Low | Add pg_dump cron for twenty-newleaf-db |

---

## 9. Quick Health Commands

```bash
# Check all containers
docker compose -f /home/hermes/services/twenty-self-host/docker-compose.newleaf.yml ps

# View logs
docker logs twenty-newleaf-server --tail 50

# DB connection
docker exec twenty-newleaf-db psql -U twenty -d twenty -c "SELECT count(*) FROM workspace;"

# Resource check
docker stats --no-stream twenty-newleaf-server twenty-newleaf-worker twenty-newleaf-db twenty-newleaf-redis
```

---

*Generated 2026-06-17 · Twenty CRM Installation Audit · Stream 2 of 7 · Read-only*

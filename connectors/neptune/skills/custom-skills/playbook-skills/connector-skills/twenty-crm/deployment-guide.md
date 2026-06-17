# Twenty CRM — Custom Objects Deployment Guide

**Phase:** 27 | **Date:** 2026-06-17

---

## 1. PREREQUISITES

- Twenty CRM running at `crm.newleaf.financial` ✅
- Node.js v24+ ✅
- Twenty workspace admin access (first login)
- API key created in Twenty Settings → API & Webhooks

---

## 2. WORKSPACE LOCATION

```
/home/neptune/twenty-newleaf-extensions/
├── package.json
├── tsconfig.json
└── src/
    ├── fields/
    │   └── person-extensions.field.ts   (20 custom fields on built-in Person)
    └── objects/
        ├── subscription.object.ts       (22 fields, 1 relation)
        ├── payment-record.object.ts     (12 fields, 2 relations)
        ├── credit-dispute.object.ts     (13 fields, 1 relation)
        ├── enrollment.object.ts         (21 fields, 1 relation)
        ├── activity.object.ts           (9 fields, 1 relation)
        └── support-ticket.object.ts     (14 fields, 1 relation)
```

**Total:** 6 schema files, ~109 custom fields, 8 relations

---

## 3. DEPLOYMENT STEPS

### Step 1: Configure Twenty Server URL

```bash
cd /home/neptune/twenty-newleaf-extensions
export TWENTY_SERVER_URL="https://crm.newleaf.financial"
```

### Step 2: Install Dependencies

```bash
npm install
# or if twenty CLI is needed:
npx create-twenty-app . --skip-scaffold  # only if needed to pull SDK
```

### Step 3: Authenticate with Twenty

The `twenty` CLI needs an API key to deploy:

```bash
# Create API key in Twenty Settings → API & Webhooks first
export TWENTY_API_KEY="<your-api-key>"
```

### Step 4: Build (Generate GraphQL Types)

```bash
npx twenty dev:build
# or: yarn twenty dev:build
```

This connects to the Twenty workspace, introspects the schema, and generates typed GraphQL clients.

### Step 5: Publish to Workspace

```bash
npx twenty app:publish
# or: yarn publish
```

This command:
1. Validates all `defineObject()` and `defineField()` calls
2. Auto-migrates PostgreSQL (creates tables for custom objects)
3. Auto-generates GraphQL + REST endpoints
4. Auto-applies RBAC from role definitions
5. Verifies the app is published

### Step 6: Verify in Twenty Admin UI

1. Open `https://crm.newleaf.financial`
2. Navigate to **Settings → Data Model**
3. Verify custom objects appear:
   - **Subscriptions** (under Custom Objects)
   - **Payment Records** (under Custom Objects)
   - **Credit Disputes** (under Custom Objects)
   - **Enrollments** (under Custom Objects)
   - **Activities** (under Custom Objects)
   - **Support Tickets** (under Custom Objects)
4. Navigate to any **Person** record → verify custom fields visible
5. Check **Settings → API & Webhooks** → verify GraphQL playground includes new objects

---

## 4. POST-DEPLOYMENT VERIFICATION

### Verify GraphQL Endpoints

```graphql
# Test query in GraphQL playground
query {
  subscriptions(first: 5) {
    edges {
      node {
        id
        nmiSubscriptionId
        paymentAmount
        billingStatus
        person { id name { firstName lastName } }
      }
    }
  }
}
```

### Verify REST Endpoints

```bash
curl -H "Authorization: Bearer $TWENTY_API_KEY" \
  https://crm.newleaf.financial/rest/subscriptions
```

### Verify API Docs

Check **Settings → API & Webhooks → API Reference** for auto-generated documentation including all new objects and their fields.

---

## 5. ROLLBACK

If deployment fails or objects need to be removed:

### Via API
```bash
# Delete a custom object (metadata API)
curl -X DELETE \
  -H "Authorization: Bearer $TWENTY_API_KEY" \
  https://crm.newleaf.financial/rest/metadata/objects/<object-id>
```

### Via Docker Rebuild
```bash
# If schema is corrupt, rebuild from backup
cd /home/hermes/services/twenty-self-host
docker compose -f docker-compose.newleaf.yml down
docker compose -f docker-compose.newleaf.yml up -d
# Database will be re-migrated from migrations
```

---

## 6. TROUBLESHOOTING

| Issue | Solution |
|---|---|
| `twenty: command not found` | Install via `npm install -g @twenty/cli` or use `npx twenty` |
| `Authentication failed` | Verify API key exists and is not expired. Create new key in Settings. |
| `Schema conflict` | Check for duplicate `universalIdentifier` UUIDs. Each must be globally unique. |
| `PostgreSQL migration failed` | Check container logs: `docker logs twenty-newleaf-server` |
| `Objects not visible in UI` | Clear browser cache, verify app published successfully, check workspace role permissions |
| `GraphQL not reflecting new objects` | Run `npx twenty dev:build` again to regenerate types |

### Checking Server Logs

```bash
docker logs twenty-newleaf-server --tail 100
docker logs twenty-newleaf-worker --tail 50
docker exec twenty-newleaf-db psql -U twenty -d twenty -c "\dt"
```

---

## 7. NEXT PHASES

| Phase | Task | Dependencies |
|---|---|---|
| 28 | Neptune Command Center UI | Custom objects deployed ✅ |
| 29 | Full Base44 → Twenty Migration | Sync foundation (Stream 4) |
| 30 | Linear Bidirectional Sync | SupportTicket object deployed |
| 31 | Generative CRM Actions | All objects + API |
| 32 | Sales Agent UI Polish | Full system live |

---

## 8. CURRENT STATUS (Phase 27)

- ✅ All 6 custom object schema files written
- ✅ 20 Person extension fields defined
- ✅ ~109 total custom fields + 8 relations
- ⚠️ **Deployment pending** — requires first Twenty admin login to create API key
- ⚠️ `npx twenty app:publish` will be run after API key is created

**Deployment guide created:** 2026-06-17 | **Phase 27**

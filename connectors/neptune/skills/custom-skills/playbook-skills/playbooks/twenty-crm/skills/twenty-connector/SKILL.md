---
name: "twenty-connector"
description: "Authenticate and connect to Twenty CRM API (GraphQL + REST) for NewLeaf Financial workspace"
version: "1.0.0"
domain: "twenty-crm"
repo_refs:
  - "/home/hermes/repos/twenty/packages/twenty-server/src/engine/core-modules/api-key/"
  - "/home/hermes/repos/twenty/packages/twenty-server/src/engine/core-modules/auth/"
  - "/home/hermes/repos/twenty/packages/twenty-server/src/engine/core-modules/jwt/"
---

# Twenty Connector Skill

## Overview
Authenticate to Twenty CRM and establish API connectivity for the NewLeaf Financial workspace.

## Production State
- **Server:** Port 3002 (twenty-newleaf-server)
- **URL:** https://crm.newleaf.financial (public) or http://localhost:3002 (VPS-local)
- **Workspace:** "NewLeaf Financial" (cebc5a0a-e707-409e-bed6-4373a675704e)
- **Subdomain:** `newleaf` — direct login: https://newleaf.crm.newleaf.financial

## Authentication Methods

### 1. API Key (Programmatic Access)
```bash
# Test connectivity
curl -X POST http://localhost:3002/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"query":"{ currentUser { email } }"}'
```

### 2. Login Session (Human Access)
1. Navigate to https://newleaf.crm.newleaf.financial
2. Enter email (aswa0617@gmail.com or jerry.b.yirenkyi@gmail.com)
3. Enter password (from Base44 vault)
4. Session persists via JWT + Redis

### 3. DB-Level Access (Admin Only)
```bash
PGPASSWORD=77242982295764e06e103f5611b8b5c8 psql -h localhost -p 5434 -U twenty -d twenty -c "SELECT id, email FROM \"user\";"
```

## Health Check
```bash
# Stack health
docker ps --filter name=twenty --format "table {{.Names}}\t{{.Status}}"

# Server health
curl http://localhost:3002/healthz

# GraphQL health
curl -X POST http://localhost:3002/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'

# DB health
docker exec twenty-newleaf-db pg_isready -U twenty
```

## Connection Troubleshooting
| Symptom | Check | Fix |
|---------|-------|-----|
| Connection refused | Docker stack running? | `docker compose up -d` |
| 401 Unauthorized | API key valid? | Rotate key in Settings → API & Webhooks |
| 403 Forbidden | Role permissions? | Check role assignment in Settings → Members |
| Timeout | Server overloaded? | `docker stats twenty-newleaf-server` |
| CORS error | Using correct URL? | Use https://crm.newleaf.financial not IP |

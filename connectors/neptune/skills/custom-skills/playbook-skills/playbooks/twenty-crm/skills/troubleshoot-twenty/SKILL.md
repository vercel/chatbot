---
name: "troubleshoot-twenty"
description: "Diagnose and resolve common issues with the Twenty CRM production stack, API, workflows, and deployments"
version: "1.0.0"
domain: "twenty-crm"
repo_refs:
  - "/home/hermes/repos/twenty/packages/twenty-server/src/engine/"
  - "/home/hermes/repos/twenty/packages/twenty-docker/"
  - "/home/hermes/repos/twenty/packages/twenty-server/src/engine/core-modules/workflow/"
  - "/home/hermes/cortex/research/twenty/MASTER-DOSSIER.md"
---

# Troubleshoot Twenty Skill

## Overview
Diagnose and resolve common issues across the Twenty CRM production stack — from Docker container health to API errors, workflow failures, app deployment issues, and performance problems.

## Production Stack Reference
| Container | Port | Purpose | Health Check |
|-----------|------|---------|--------------|
| twenty-newleaf-server | 3002→3000 | NestJS backend | `curl localhost:3002/healthz` |
| twenty-newleaf-worker | — | BullMQ jobs | `docker logs twenty-newleaf-worker` |
| twenty-newleaf-db | 5434→5432 | PostgreSQL 16 | `docker exec twenty-newleaf-db pg_isready -U twenty` |
| twenty-newleaf-redis | 6382→6379 | Cache/Queue | `docker exec twenty-newleaf-redis redis-cli ping` |

## Quick Health Check
```bash
# All containers running?
docker ps --filter name=twenty --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Server responding?
curl -s http://localhost:3002/healthz

# GraphQL alive?
curl -s -X POST http://localhost:3002/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'

# DB responding?
docker exec twenty-newleaf-db pg_isready -U twenty

# Redis responding?
docker exec twenty-newleaf-redis redis-cli ping
```

## Common Issues & Solutions

### Stack Issues

| Symptom | Diagnosis | Resolution |
|---------|-----------|------------|
| Connection refused | Service down? | `docker compose up -d` (from twenty-docker dir) |
| 502 Bad Gateway | Server crashed? | `docker logs twenty-newleaf-server --tail 50` |
| Server OOM | Memory leak? | `docker stats twenty-newleaf-server` → restart if >2GB |
| Postgres connection errors | DB unhealthy? | `docker restart twenty-newleaf-db` |
| Redis connection errors | Redis unhealthy? | `docker restart twenty-newleaf-redis` |
| Disk full | Logs/backups? | `df -h`, clean old docker images: `docker system prune -a` |

### API Issues

| Symptom | Diagnosis | Resolution |
|---------|-----------|------------|
| 401 Unauthorized | Invalid/expired API key | Rotate key in Settings → API & Webhooks |
| 403 Forbidden | Role permissions insufficient | Check role's objectPermissions + fieldPermissions |
| "Cannot query field X" | Field doesn't exist on object | Verify field name via metadata query: `query { __type(name:"Person") { fields { name } } }` |
| 429 Too Many Requests | Rate limited (>100 req/min) | Wait 60s, reduce query frequency |
| CORS error | Using wrong URL? | Use `https://crm.newleaf.financial`, not IP |
| Request timeout | Query too complex? | Add pagination, reduce nested depth |

### Workflow Issues

| Symptom | Diagnosis | Resolution |
|---------|-----------|------------|
| Workflow doesn't fire | Trigger configured? Activated? | Check trigger settings, toggle Active off/on |
| Step fails silently | Error swallowed? | Check run history: open workflow → Runs tab → click run |
| Iterator hangs | Array too large? | Add limit or filter action before iterator |
| HTTP Request fails | URL reachable? Auth valid? | Test endpoint with curl first |
| Code action errors | JS syntax error? | Test code in browser console, check run logs |
| Delay step wrong | Timezone mismatch? | Use UTC times, verify server timezone |

### App Deployment Issues

| Symptom | Diagnosis | Resolution |
|---------|-----------|------------|
| VERSION_ALREADY_EXISTS | Same version redeployed | Bump version in package.json |
| SERVER_VERSION_INCOMPATIBLE | Server too old for app | Update `engines.twenty` range or upgrade server |
| CANNOT_DOWNGRADE_APPLICATION | Lower version deployed | Only deploy higher versions |
| Build fails | Invalid entity definition | Check universalIdentifiers, option positions, default value quoting |
| App not appearing | Server catalog stale? | `yarn twenty dev:catalog-sync` |
| Metadata migration fails | Schema conflict? | Check server logs: `docker logs twenty-newleaf-server | grep migration` |

### Logic Function Issues

| Symptom | Diagnosis | Resolution |
|---------|-----------|------------|
| Function doesn't trigger | Wrong event name? | Use exact `nameSingular` not `labelSingular` |
| Timeout | Handler too slow | Increase `timeoutSeconds` (max 30), optimize queries |
| "Cannot find module" | Missing dependency | Check package.json, rebuild |
| HMAC verification fails | Wrong secret/algo | Verify env var, check SHA256 vs SHA512 |
| Response headers blocked | Not in allowed list | Only: content-type, content-language, content-disposition, cache-control, retry-after |

### Webhook Issues

| Symptom | Diagnosis | Resolution |
|---------|-----------|------------|
| Webhook not firing | Wrong event type? | Check webhook config, verify receiver URL reachable |
| 401 on receiver | HMAC verification fails | Verify: SHA256, format `timestamp:payload`, correct secret |
| Missing fields in payload | Object fields changed? | Webhook sends ALL fields — check object definition |
| Duplicate events | No dedup built in | Track processed event IDs, handle idempotently |
| Signature missing | Proxy stripping headers? | Ensure reverse proxy forwards `X-Twenty-Webhook-*` headers |

## Deep Diagnostics

### Check Server Logs
```bash
# Last 100 lines
docker logs twenty-newleaf-server --tail 100

# Follow logs for real-time
docker logs twenty-newleaf-server --tail 50 -f

# Filter for errors
docker logs twenty-newleaf-server --tail 200 2>&1 | grep -i "error\|exception\|fail"
```

### Check Worker Logs
```bash
docker logs twenty-newleaf-worker --tail 100
```

### Check Database State
```bash
PGPASSWORD=77242982295764e06e103f5611b8b5c8 psql -h localhost -p 5434 -U twenty -d twenty -c "
SELECT 'workspace' as type, id, 'cebc5a0a...' as workspace_id FROM workspace WHERE id = 'cebc5a0a-e707-409e-bed6-4373a675704e';
SELECT 'users' as type, COUNT(*) FROM \"user\";
SELECT 'members' as type, COUNT(*) FROM \"workspaceMember\";
"
```

### Check Server Resource Usage
```bash
# CPU + Memory
docker stats twenty-newleaf-server --no-stream

# Disk
df -h /var/lib/docker
```

## Recovery Procedures

### Restart Stack
```bash
cd /path/to/twenty-docker
docker compose down
docker compose up -d
# Wait 10-15s for server to be ready
until curl -s http://localhost:3002/healthz; do sleep 2; done
```

### Restore from Backup
```bash
docker compose stop twenty-newleaf-server twenty-newleaf-worker
docker exec -i twenty-newleaf-db psql -U twenty twenty < backup.sql
docker compose up -d
```

### Reset Admin Password (Emergency)
```bash
PGPASSWORD=77242982295764e06e103f5611b8b5c8 psql -h localhost -p 5434 -U twenty -d twenty -c "
UPDATE \"user\" SET \"passwordHash\" = '\$2b\$10\$...' WHERE email = 'aswa0617@gmail.com';
"
```
⚠️ Need a fresh bcrypt hash — generate with `node -e "const bcrypt = require('bcrypt'); bcrypt.hash('newpassword', 10).then(h => console.log(h))"`

## Performance Tuning
| Issue | Check | Fix |
|-------|-------|-----|
| Slow queries | Postgres query logs | Add indexes on frequently filtered fields |
| High memory | `docker stats` | Increase container memory limit or restart |
| Slow API | Concurrent requests | Add pagination, reduce nested query depth |
| Caching stale | Redis full? | `redis-cli FLUSHDB` (careful — clears sessions!) |
| Worker backlog | BullMQ queue size | `redis-cli LLEN bull:waiting`, check worker logs |

## Escalation Path
1. **Check this troubleshooting guide** — 80% of issues covered
2. **Check server logs** — `docker logs twenty-newleaf-server --tail 200`
3. **Check MASTER-DOSSIER** — `/home/hermes/cortex/research/twenty/MASTER-DOSSIER.md`
4. **Check GitHub issues** — https://github.com/twentyhq/twenty/issues
5. **Check Discord** — https://twenty.com/discord
6. **Post to Slack #jarvis-admin** with full error context

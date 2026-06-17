---
type: "audit"
name: "Vps Infrastructure Audit 2026 06 17"
description: "Auto-generated description for Vps Infrastructure Audit 2026 06 17"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# VPS Infrastructure Audit — 2026-06-17

> **Host:** VPS (Hostinger) at 187.127.250.171  
> **OS:** Ubuntu 24.04 LTS, 15 GiB RAM, 193 GB disk  
> **Uptime:** 15h (nginx restart ~06:18 PDT)  
> **Scope:** Read-only infrastructure health check

---

## 1. System Resources

| Resource | Total | Used | Free | Available |
|----------|-------|------|------|-----------|
| Disk (/) | 193 GB | 96 GB (50%) | 98 GB | — |
| Disk (/boot) | 881 MB | 117 MB (15%) | 703 MB | — |
| Memory | 15 GiB | 5.5 GiB | 3.6 GiB | 10 GiB |
| Swap | 0 B | 0 B | 0 B | — |

**Assessment:** Healthy. 50% disk, no swap pressure, 10 GiB available memory. Swap should be configured (0 swap is risky for OOM).

---

## 2. Docker Containers — 15 Running

| Stack | Container | Image | Port | Uptime |
|-------|-----------|-------|------|--------|
| **Twenty CRM** | twenty-newleaf-server | `twentycrm/twenty:latest` | 3002→3000 | 2 weeks |
| | twenty-newleaf-worker | `twentycrm/twenty:latest` | — | 2 weeks |
| | twenty-newleaf-db | `postgres:16` | 5434→5432 | 2 weeks |
| | twenty-newleaf-redis | `redis:7-alpine` | 6382→6379 | 2 weeks |
| **Hyperswitch** | hyperswitch-server | `hyperswitch-router:2026.05.28.0` | 8080→8080 | 2 weeks |
| | hyperswitch-control-center | `hyperswitch-control-center:latest` | 9000→9000 | 2 weeks |
| | superposition | `superposition-demo:0.102.0` | 8081→8080 | 2 weeks |
| | hyperswitch-pg | `postgres:latest` | 5433→5432 | 2 weeks |
| | hyperswitch-redis | `redis:7` | 6381→6379 | 2 weeks |
| **n8n** | n8n | `n8nio/n8n:latest` | 5678→5678 | 2 weeks |
| | n8n_postgres | `postgres:15` | 5435→5432 | 2 weeks |
| | n8n_redis | `redis:7` | 6383→6379 | 2 weeks |
| **Neptune DB** | neptune-postgres | `postgres:16` | 5436→5432 | 13 days |
| **LangGraph** | langgraph-postgres | `postgres:16-alpine` | 5432→5432 | 4 weeks |
| **FalkorDB** | falkordb | `falkordb/falkordb:latest` | 6380→6379 | 5 weeks |

### Database/Redis Inventory
```
PostgreSQL: 5 instances (ports 5432–5436)
  - langgraph-postgres (5432) — 4 weeks uptime
  - hyperswitch-pg (5433)     — 2 weeks
  - twenty-newleaf-db (5434)  — 2 weeks
  - n8n_postgres (5435)       — 2 weeks
  - neptune-postgres (5436)   — 13 days

Redis:      4 instances (ports 6379–6383)
  - falkordb (6380)           — 5 weeks
  - hyperswitch-redis (6381)  — 2 weeks
  - twenty-newleaf-redis (6382)— 2 weeks
  - n8n_redis (6383)          — 2 weeks
```

---

## 3. PM2 Process Manager — 21 Processes

| ID | Name | Uptime | Memory | Port | Description |
|----|------|--------|--------|------|-------------|
| 15 | **claude-agent-api** | 15h | 195.7 MB | 8102 | Main agent API (Claude SDK) |
| 3 | graphify-mcp | 15h | 135.8 MB | — | Graphify MCP server |
| 19 | open-design | 15h | 95.9 MB | 7456 | Open Design server |
| 16 | kimi-code-runtime | 15h | 87.4 MB | 8111 | Kimi code runtime |
| 2 | hermes-webhooks | 15h | 86.3 MB | 9100 | Webhook receiver |
| 17 | mvp-builder | 3h | 82.5 MB | 8200 | MVP builder |
| 4 | symphony-v3 | 15h | 77.4 MB | — | Symphony orchestrator |
| 9 | missions-api | 15h | 70.3 MB | 8103 | Missions API |
| 18 | jarvis-os-clean | 3h | 67.3 MB | — | Jarvis OS cleaner |
| 7 | jarvis-agent | 15h | 66.1 MB | 8101 | Jarvis agent |
| 20 | neptune-backend | 15h | 55.8 MB | 8104 | Neptune backend |
| 0 | job-queue | 15h | 48.0 MB | 8000 | Job queue |
| 8 | sdk-ingester | 15h | 48.1 MB | 8112 | SDK ingester |
| 6 | paul | 15h | 38.3 MB | — | Paul agent |
| 5 | symphony-slack | 15h | 34.5 MB | — | Slack bridge |
| 10 | missions-orchestrator | 15h | 31.0 MB | — | Mission orchestrator |
| 1 | hermes-api | 10m | 19.6 MB | 8100 | Hermes API (restarted 62x) |
| 11 | missions-worker-pool | 15h | 30.8 MB | — | Worker pool |
| 12 | missions-validator | 15h | 30.8 MB | — | Validator |
| 13 | missions-report-agent | 15h | 30.6 MB | — | Report agent |
| 14 | missions-research-agent | 15h | 30.6 MB | — | Research agent |

**TOTAL PM2 memory: ~1,347 MB**

**Note:** `hermes-api` (PID 1) has 62 restarts in 10 minutes — likely crash-looping and needs investigation.

---

## 4. Network — Listening Ports

### Public-facing (0.0.0.0)
```
80      → nginx (HTTP)
443     → nginx (HTTPS)
22      → sshd
5678    → n8n (docker-proxy)
3002    → Twenty CRM (docker-proxy)
5432    → LangGraph PG (docker-proxy)  ⚠️ EXPOSED
5433    → Hyperswitch PG (docker-proxy) ⚠️ EXPOSED
5434    → Twenty PG (docker-proxy)     ⚠️ EXPOSED
5435    → n8n PG (docker-proxy)         ⚠️ EXPOSED
5436    → Neptune PG (docker-proxy)     ⚠️ EXPOSED
6380    → FalkorDB (docker-proxy)       ⚠️ EXPOSED
6381    → Hyperswitch Redis (docker-proxy) ⚠️ EXPOSED
6382    → Twenty Redis (docker-proxy)   ⚠️ EXPOSED
6383    → n8n Redis (docker-proxy)      ⚠️ EXPOSED
8080    → Hyperswitch (docker-proxy)
8081    → Superposition (docker-proxy)
9000    → Hyperswitch Control Center
```

### Internal-only (127.0.0.1)
```
11434   → Ollama (LLM)
6379    → Local Redis
7456    → Open Design
8111    → Kimi Code Runtime
20243   → Cloudflare Tunnel (cloudflared)
65529   → Monarx Agent (security)
```

**HIGH RISK:** 5 PostgreSQL and 4 Redis instances exposed on 0.0.0.0. These should be bound to internal Docker networks or firewalled to specific IPs.

---

## 5. Nginx Configuration — 15 Domains

| Domain | Proxy To | SSL |
|--------|----------|-----|
| `crm.newleaf.financial` | localhost:3002 (Twenty) | ✅ Let's Encrypt ECDSA |
| `app.crm.newleaf.financial` | localhost:3002 (Twenty) | ✅ Let's Encrypt ECDSA |
| `newleaf.crm.newleaf.financial` | localhost:3002 | ✅ Shared cert |
| `wildcard.crm.newleaf.financial` | localhost:3002 | — |
| `jarvis.newleaf.financial` | 127.0.0.1:8102 (claude-agent-api) | ✅ Let's Encrypt ECDSA |
| `neptune.newleaf.financial` | 127.0.0.1:8102 | ✅ Let's Encrypt ECDSA |
| `n8n.newleaf.financial` | 127.0.0.1:5678 (n8n) | ✅ Let's Encrypt ECDSA |
| `pay-admin.newleaf.financial` | — (payment admin) | ✅ |
| `pay-checkout.newleaf.financial` | — (payment checkout) | ✅ |
| `pay-webhook.newleaf.financial` | — (payment webhooks) | ✅ |
| `compute.newleaf.financial` | 127.0.0.1:8102 + 8000 | — |
| `opendesign` | 127.0.0.1:7456 | — |
| `jarvis-core` | 127.0.0.1:3001 | — |
| `preview.newleaf.financial` | — | — |
| `_` (default) | — | — |

---

## 6. SSL Certificates (Let's Encrypt)

| Certificate | Domains | Expiry | Key |
|-------------|---------|--------|-----|
| `app.crm.newleaf.financial` | crm, app.crm, newleaf.crm (3) | 2026-08-31 (75d) | ECDSA |
| `crm.newleaf.financial` | crm (1) | 2026-08-30 (74d) | ECDSA |
| `jarvis.newleaf.financial` | jarvis (1) | 2026-08-25 (69d) | ECDSA |
| `n8n.newleaf.financial` | n8n (1) | 2026-09-01 (75d) | ECDSA |
| `neptune.newleaf.financial` | neptune (1) | 2026-09-01 (76d) | ECDSA |
| `pay-admin.newleaf.financial` | pay-admin (1) | ✓ | ECDSA |
| `pay-checkout.newleaf.financial` | pay-checkout (1) | ✓ | ECDSA |

**All certs:** ECDSA (fast, modern), valid for 69-76 days, auto-renew via certbot cron (twice-daily check).

---

## 7. DNS Resolution

| Domain | Resolves To | Type |
|--------|------------|------|
| `neptune-chat.vercel.app` | 216.198.79.131, 64.29.17.131 | Vercel edge |
| `neptune-v2.vercel.app` | (Vercel — same edge) | Vercel edge |
| `crm.newleaf.financial` | 187.127.250.171 | VPS direct |
| `n8n.newleaf.financial` | 187.127.250.171 | VPS direct |

---

## 8. Environment Variables — 79 Secrets

**Location:** `/etc/newleaf/.env` — 107 lines, 79 key=value pairs  
**Secrets:** All API keys, DB URLs, crypto keys for every integration

```
Categories:
  AI Providers (8):  ANTHROPIC, OPENAI, GOOGLE, GROQ, DEEPSEEK, KIMI, XAI, ZHIPU
  Infrastructure (5): AI_GATEWAY, BLOB_READ_WRITE, VPS_BRIDGE, APP_BASE, DIAGNOSTICS
  Vercel (4):        VERCEL_TOKEN, VERCEL_API_TOKEN, VERCEL_PARTNER_TEAM, VERCEL_WEBHOOK_SECRET
  Auth (3):          BETTER_AUTH_SECRET, CLERK_SECRET, CLERK_PUBLISHABLE
  Payments (7):      HYPERSWITCH_* (7 vars), NMI_SECURITY_KEY
  GitHub (4):        GITHUB_TOKEN, GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_WEBHOOK_SECRET
  Integrations (11): N8N_* (5), E2B_* (3), LINEAR_API_KEY, GODADDY_*, RESEND
  Base44 (6):        BASE44_API_HOST/KEY/APP_*, BASE44_FUNCTIONS_URL, BASE44_VPS_API_URL
  Internal (8):      NEPTUNE_INTERNAL_TOKEN, NEPTUNE_TEST_TOKEN, NEPTUNE_V2_API_KEY, HERMES_KEY, etc.
  Slack (1):         SLACK_BOT_TOKEN
  CRM (1):           TWENTY_API_KEY_PLACEHOLDER
  Other (5):         HOSTINGER, GODADDY, FORTH, SWAMI, JDI
```

**Risk:** 79 secrets in a single flat file. Consider migrating to HashiCorp Vault or Doppler for rotation and audit.

---

## 9. Cron Jobs — 18 Scheduled Tasks

### User Crontab (every minute to every 4 hours)
```
* * * * *   automation_scheduler.py          # Main automation engine
* * * * *   hermes cron tick                 # Hermès heartbeat
*/30 * * *  nmi_billing_pulse.py             # NMI billing pulse
*/30 * * *  smart_digest.py                  # HITL smart digest
*/30 * * *  email_checker.py                 # Email observability
*/30 * * *  sms_checker.py                   # SMS observability
*/5  * * *  health_monitor.py (x2)           # Dual health monitors
*/5  * * *  linear_sync.py                   # Linear ticket sync
*/5  * * *  event_hub.py --sweep             # Nerve event hub sweep
0  * * * *  graphify update                  # App graph rebuild (hourly)
0  */1 * *  ticket_checker.py                # Ticket observability
0  */2 * *  realtime_reconciler.py           # Data reconciler
0  */2 * *  sync360.run_all --quick         # Base44→360 quick sync
0  */2 * *  billing_checker.py               # Billing observability
0  */4 * *  nmi_pulse_watchdog.py            # NMI watchdog
```

### System Cron.d
```
certbot renew (twice daily)                  # SSL renewal
docker image prune (daily 4:58 AM)           # Docker cleanup
e2scrub_all (weekly Sunday 3:30 AM)          # Filesystem scrub
monarx-agent update (weekly Tuesday 3:23 AM) # Security agent
sysstat (every 10 min, daily rotation)       # System stats
```

---

## 10. Architecture Diagram (Simplified)

```
                     Cloudflare DNS
                          │
                    ┌─────▼─────┐
                    │   NGINX   │ :80/:443
                    │  (proxy)  │
                    └──┬───┬───┘
                       │   │
        ┌──────────────┼───┼──────────────────┐
        │              │   │                   │
    ┌───▼────┐   ┌────▼───▼──┐    ┌──────────▼──────┐
    │ Twenty │   │  Claude   │    │ n8n Workflow     │
    │  CRM   │   │ Agent API │    │ Automation       │
    │ :3002  │   │  :8102    │    │ :5678            │
    └───┬────┘   └─────┬─────┘    └────────┬─────────┘
        │              │                   │
    ┌───▼────┐   ┌─────▼──────────┐   ┌───▼──────────┐
    │Twenty  │   │ PM2 × 21       │   │ n8n PG + Redis│
    │PG+Redis│   │ Agent Processes │   └──────────────┘
    └────────┘   └────────────────┘
                  │
    ┌─────────────┼──────────────────┐
    │      Docker × 15 containers    │
    │  Hyperswitch | Neptune PG |    │
    │  LangGraph PG | FalkorDB       │
    └────────────────────────────────┘
```

---

## 11. Risks & Recommendations

| Risk | Severity | Detail |
|------|----------|--------|
| **DB ports exposed** | 🔴 Critical | 5 PG + 4 Redis on 0.0.0.0 — immediate firewall needed |
| **hermes-api crash loop** | 🟠 High | 62 restarts in 10 min — investigate logs |
| **No swap** | 🟠 High | 0 swap = OOM killer on memory pressure |
| **Flat secrets file** | 🟠 High | 79 secrets in one .env — no rotation, no audit |
| **5 PG instances** | 🟡 Medium | Resource contention — consolidate where possible |
| **No DB backups visible** | 🟡 Medium | No pg_dump cron found — add for all 5 PGs |
| **Monarx agent** | 🟡 Medium | Third-party security agent on host |
| **Cloudflare tunnel** | 🟡 Medium | cloudflared on 127.0.0.1:20243 — bypasses nginx |
| **Docker image pinning** | 🟢 Low | Several `:latest` tags — pin to specific SHAs |
| **Disk at 50%** | 🟢 Low | 98 GB free, no immediate concern |

---

*Generated 2026-06-17 · VPS Infrastructure Audit · Stream 3 of 7 · Read-only*

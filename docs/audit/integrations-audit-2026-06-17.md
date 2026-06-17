# Integrations Audit — Full Stack Enumeration
**Date:** 2026-06-17 | **Auditor:** Hermès V5 · Stream 4  
**Scope:** All integrations across Neptune Chat + V2 + VPS + NewLeaf

---

## 1. Integration Summary Matrix

| # | Integration | Type | Status | Health | Credential Location | Last Sync |
|---|------------|------|--------|--------|---------------------|-----------|
| 1 | **NMI** | Payment Gateway | ✅ LIVE | Healthy | `/etc/newleaf/.env` | 2026-06-17 03:00 |
| 2 | **Hyperswitch** | Payment Router | ✅ LIVE | HTTP 200 | `/etc/newleaf/.env` | Real-time |
| 3 | **Stripe** | Payment Gateway | ❌ NOT PRESENT | N/A | N/A | N/A |
| 4 | **GHL** | CRM + SMS + Voice | ✅ CONFIGURED | TBD | `/etc/newleaf/.env` | Via connector |
| 5 | **Twenty CRM** | CRM (Self-Hosted) | ✅ LIVE | HTTP 200 | `/home/hermes/services/twenty-self-host/.env` | Via Chat client |
| 6 | **Slack** | Messaging | ✅ LIVE | Active | `/etc/newleaf/.env` | 2026-06-17 03:31 |
| 7 | **Linear** | Project Mgmt | ✅ CONFIGURED | Key present | `/etc/newleaf/.env` | Every 5 min cron |
| 8 | **n8n** | Workflow Automation | ✅ LIVE | HTTP 200 | `/etc/newleaf/.env` | Real-time |
| 9 | **Cloudflare** | CDN/DNS/Tunnel | ✅ LIVE | Tunnel active | System service | Continuous |
| 10 | **Vercel** | Hosting (3 projects) | ✅ LIVE | Deploying | `/etc/newleaf/.env` | Per-deploy |
| 11 | **Clerk** | Auth Provider | ✅ CONFIGURED | Key present | `/etc/newleaf/.env` | On login |
| 12 | **NextAuth/Better Auth** | Auth Provider | ✅ LIVE | Active | In-code | On login |
| 13 | **Resend** | Email API | ✅ CONFIGURED | Key present | `/etc/newleaf/.env` | Pending first use |
| 14 | **VAPI** | Voice AI | ✅ CONFIGURED | Key present | `/etc/newleaf/.env` | Via connector |
| 15 | **DPP/Forth** | Credit Repair | ⚠️ PENDING | Token pending | `/etc/newleaf/.env` | Not started |
| 16 | **Spinwheel** | Credit Data | ❌ NOT FOUND | N/A | N/A | N/A |
| 17 | **Freshcaller** | Call System | ⚠️ DEPRECATING | Connector exists | Skills only | Via connector |
| 18 | **Ollama** | Local LLM | ✅ LIVE | HTTP 200 | localhost:11434 | On-demand |
| 19 | **FalkorDB** | Graph Database | ✅ LIVE | Running | Docker:6380 | Real-time |
| 20 | **LangGraph** | Agent State | ✅ LIVE | Running | Docker:5432 | Real-time |
| 21 | **GitHub** | Git Hosting | ✅ LIVE | Via Vercel OIDC | `/etc/newleaf/.env` | Per-commit |
| 22 | **OpenAI/Anthropic** | AI Gateway | ✅ LIVE | Gateway routing | `/etc/newleaf/.env` | Real-time |

---

## 2. Deep Dive — Per Integration

### 2.1 NMI Payment Gateway (Sacred Memory: `6a1f118b`)
| Attribute | Value |
|-----------|-------|
| **Status** | ✅ LIVE — Primary payment processor |
| **Architecture** | Golden Vault: `customer_vault_id` + DPAN network tokens |
| **Security Key** | `44jPA...` (redacted, in `/etc/newleaf/.env`) |
| **MCA ID** | `mca_PW7l917OgYxqa0MvXU1g` |
| **Day-0 Pattern** | CIT transaction as consent anchor |
| **Banned Pattern** | `source_transaction_id` — DO NOT USE on add_subscription |
| **Recurring** | Customer vault tokenized, recurring via subscription API |
| **Last Sync** | Incremental: 2026-06-17 03:00 (0 new, 17 checked) |
| **Watchdog** | `nmi_pulse_watchdog.py` — every 4 hours |
| **Billing Pulse** | `nmi_billing_pulse.py` — every 30 min |
| **Connector** | `/home/neptune/neptune-chat/connectors/nmi/` (SKILL.md + tools) |

### 2.2 Hyperswitch (Allied Payments Router)
| Attribute | Value |
|-----------|-------|
| **Status** | ✅ LIVE — Payment routing engine |
| **Health** | HTTP 200 (`/health` endpoint) |
| **Components** | Server (8080), Control Center (9000), Superposition (8081) |
| **API Keys** | Admin, Publishable, Webhook Secret — all in `/etc/newleaf/.env` |
| **Merchant ID** | `HYPERSWITCH_MERCHANT_ID` configured |
| **Base URL** | `HYPERSWITCH_BASE_URL` + `HYPERSWITCH_PUBLIC_BASE_URL` |
| **Connector** | `/home/neptune/neptune-chat/connectors/hyperswitch/` |

### 2.3 Slack Workspace
| Attribute | Value |
|-----------|-------|
| **Status** | ✅ LIVE — Primary agent communication |
| **Bot Token** | `xoxb-8873317266373-...` (in `/etc/newleaf/.env`) |
| **Target Channel** | `#jarvis-admin` (JARVIS_ADMIN_CHANNEL_ID) |
| **Secondary** | `#newleaf-admin` (NEWLEAF_ADMIN_CHANNEL_ID) — DO NOT USE per cardinal rule |
| **Last Full Sync** | 2026-06-17 03:31 — 10,927 messages from 13 channels |
| **Sync Frequency** | Full: every 2 hours. Incremental: every 5 min |
| **Slack Billing Sync** | Every 5 min (`slack_billing_sync.py`) |
| **Connector** | `/home/neptune/neptune-chat/connectors/slack/` |
| **V2 Bridge** | Symphony-Slack PM2 process (34.5 MB) |

### 2.4 Twenty CRM (Self-Hosted)
| Attribute | Value |
|-----------|-------|
| **Status** | ✅ LIVE — CRM platform at `crm.newleaf.financial` |
| **Health** | HTTP 200, healthy container (2 weeks uptime) |
| **Server** | Docker `twenty-newleaf-server` (621 MB RAM, 2.18% CPU) |
| **Custom Objects** | ⚠️ **NOT DEPLOYED** — 7 schema files written but not published |
| **API Key** | ⚠️ **NOT CREATED** — Chat cannot authenticate yet |
| **Webhooks** | ⚠️ Not configured |
| **Connector** | `/home/neptune/neptune-chat/connectors/neptune/skills/.../connector-skills/twenty-crm/` (85 KB of docs) |
| **Client Library** | `/home/neptune/neptune-chat/lib/twenty/client.ts` (rate-limited, batch-upsert) |

### 2.5 GHL (GoHighLevel — CRM + SMS + Voice)
| Attribute | Value |
|-----------|-------|
| **Status** | ✅ CONFIGURED — Keys present |
| **API Key** | `GHL_API_KEY` in `/etc/newleaf/.env` |
| **Location ID** | `GHL_LOCATION_ID` configured |
| **Connector** | `/home/neptune/neptune-chat/connectors/ghl/` (SKILL.md + tools) |
| **Usage** | SMS sending, voice calls, CRM operations |

### 2.6 Linear (Project Management)
| Attribute | Value |
|-----------|-------|
| **Status** | ✅ CONFIGURED |
| **API Key** | `lin_api_4c9iD68dVPc...` in `/etc/newleaf/.env` |
| **MCP URL** | `LINEAR_MCP_URL` (but MCP tools may not be active) |
| **Sync Cron** | Every 5 min (`linear_sync.py`) |
| **Connector** | `/home/neptune/neptune-chat/connectors/linear/` |
| **Cloud Integration** | linear-mcp service directory present |

### 2.7 n8n (Workflow Automation)
| Attribute | Value |
|-----------|-------|
| **Status** | ✅ LIVE at `n8n.newleaf.financial` |
| **Health** | HTTP 200 (`{"status":"ok"}`) |
| **Components** | n8n server (5678) + PostgreSQL (5435) + Redis (6383) |
| **SSL** | Let's Encrypt ECDSA, expires 2026-09-01 (75 days) |

### 2.8 Cloudflare
| Attribute | Value |
|-----------|-------|
| **Status** | ✅ LIVE |
| **Tunnel** | `cloudflared` running since Jun 3 (PID 3036140) |
| **Target** | `http://127.0.0.1:8102` (claude-agent-api) |
| **DNS** | `neptune-chat.vercel.app` → Vercel IPs, `*.newleaf.financial` → VPS |
| **WAF** | Inferred active (Cloudflare proxy for newleaf.financial domains) |

### 2.9 Vercel (3 Projects)
| Project | URL | Status |
|---------|-----|--------|
| `neptune-chat` | `neptune-chat-ashy.vercel.app` | ✅ LIVE (project `prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl`) |
| `neptune-v2` | `neptune-v2.vercel.app` | ✅ LIVE |
| `jarvis-os-clean` | (port 3001 on VPS) | ✅ LIVE |

**Vercel Integration:** VERCEL_TOKEN + VERCEL_API_TOKEN configured. OIDC for GitHub. Deploy webhooks active.

### 2.10 Clerk (Auth Provider)
| Attribute | Value |
|-----------|-------|
| **Status** | ✅ CONFIGURED (Phase 7D, June 1 2026) |
| **Keys** | Publishable + Secret in `/etc/newleaf/.env` |
| **Environment** | Test keys (`pk_test_*` prefix) ⚠️ |
| **Usage** | Auth for Neptune Chat (coexists with NextAuth v5) |

### 2.11 Resend (Email API)
| Attribute | Value |
|-----------|-------|
| **Status** | ✅ CONFIGURED — Key present but unused |
| **API Key** | `re_Cbz6U1iR_...` in `/etc/newleaf/.env` |
| **Usage** | ⚠️ Not yet integrated. Twenty `EMAIL_DRIVER=logger` — no production email. |
| **Connector** | `/home/neptune/neptune-chat/connectors/neptune/skills/.../connector-skills/resend/` |

### 2.12 VAPI (Voice AI)
| Attribute | Value |
|-----------|-------|
| **Status** | ✅ CONFIGURED |
| **API Key** | `VAPI_API_KEY` in `/etc/newleaf/.env` |
| **Connector** | `/home/neptune/neptune-chat/connectors/vapi/` (SKILL.md + client.ts + tools) |
| **Usage** | AI voice calls for customer support |

### 2.13 DPP/Forth (Credit Repair)
| Attribute | Value |
|-----------|-------|
| **Status** | ⚠️ PENDING — Token not yet provided |
| **API Token** | `FORTH_API_TOKEN=PENDING_user_not_yet_provided` |
| **Connector** | `/home/neptune/neptune-chat/connectors/forth/` (SKILL.md + tools) |

### 2.14 Freshcaller (Call System)
| Attribute | Value |
|-----------|-------|
| **Status** | ⚠️ DEPRECATING — Connector exists, migrating to VAPI |
| **Connector** | `/home/neptune/neptune-chat/connectors/neptune/skills/.../connector-skills/freshcaller/` (skill.md + tools.yaml) |

### 2.15 Stripe
| Attribute | Value |
|-----------|-------|
| **Status** | ❌ NOT PRESENT — No Stripe keys anywhere in the environment |
| **Assessment** | Not used. NMI + Hyperswitch handle all payments. |

### 2.16 Spinwheel
| Attribute | Value |
|-----------|-------|
| **Status** | ❌ NOT FOUND — No Spinwheel credentials or connectors |
| **Assessment** | Not integrated. May have been planned but not implemented. |

---

## 3. Infrastructure Integrations

### 3.1 Ollama (Local LLM)
- **Status:** ✅ LIVE, `localhost:11434`
- **Access:** localhost only ✅
- **Models:** Local LLM inference for offline tasks

### 3.2 FalkorDB (Graph Database)
- **Status:** ✅ LIVE, Docker `falkordb` (5 weeks uptime)
- **Port:** 6380 (Redis protocol)
- **Usage:** Knowledge graph storage for Neptune Chat

### 3.3 LangGraph (Agent State)
- **Status:** ✅ LIVE, Docker `langgraph-postgres` (4 weeks uptime)
- **Port:** 5432
- **Usage:** LangGraph agent state persistence

### 3.4 GitHub Integration
- **Status:** ✅ LIVE
- **Method:** Vercel OIDC + GITHUB_TOKEN + GitHub App (Neptune V2)
- **Neptune V2:** GitHub App with full repo/PR management

---

## 4. Integration Health Summary

### 4.1 Health Status
| Status | Count | Integrations |
|--------|-------|-------------|
| ✅ LIVE & HEALTHY | 12 | NMI, Hyperswitch, Slack, Twenty, n8n, Cloudflare, Vercel, Ollama, FalkorDB, LangGraph, GitHub, Claude Agent API |
| ✅ CONFIGURED | 5 | GHL, Linear, Clerk, Resend, VAPI |
| ⚠️ PENDING | 3 | DPP/Forth, Twenty Custom Objects, Twenty API Key |
| ⚠️ DEPRECATING | 1 | Freshcaller → VAPI |
| ❌ NOT PRESENT | 2 | Stripe, Spinwheel |

### 4.2 Credential Security
- ⚠️ 22 integrations, most credentials in `/etc/newleaf/.env` (79 secrets)
- ⚠️ Clerk using test keys (`pk_test_*`) in production config
- ⚠️ `FORTH_API_TOKEN=PENDING_user_not_yet_provided` — placeholder in env
- ⚠️ Multiple `.env` files with overlapping credentials
- ✅ NMI security key properly restricted to `/etc/newleaf/.env`
- ✅ Ollama bound to localhost only

### 4.3 Sync Health
| Integration | Last Sync | Frequency | Status |
|-------------|-----------|-----------|--------|
| NMI Transactions | 2026-06-17 03:00 | Every 4h | Healthy |
| Slack Messages | 2026-06-17 03:31 | Every 2h (full), 5m (billing) | Healthy (10,927 msgs) |
| Linear | Every 5 min | Every 5 min | Active cron |
| Twenty CRM | ⚠️ NOT STARTED | N/A | API key not created |

---

## 5. Connector Skills Inventory

| Connector | Location | Has SKILL.md | Has Tools | Has Client |
|-----------|----------|-------------|-----------|------------|
| NMI | `/connectors/nmi/` | ✅ | ✅ | ✅ |
| Hyperswitch | `/connectors/hyperswitch/` | ✅ | ✅ | ✅ |
| Slack | `/connectors/slack/` | ✅ | ✅ | ✅ |
| GHL | `/connectors/ghl/` | ✅ | ✅ | ✅ |
| GitHub | `/connectors/github/` | ✅ | ✅ | ✅ |
| Linear | `/connectors/linear/` | ✅ | ✅ | ✅ |
| VAPI | `/connectors/vapi/` | ✅ | ✅ | ✅ |
| Forth/DPP | `/connectors/forth/` | ✅ | ✅ | ✅ |
| Vercel | `/connectors/vercel/` | ✅ | ✅ | ✅ |
| Base44 | `/connectors/base44/` | ✅ | ✅ | ✅ |
| Twenty CRM | `/connectors/neptune/.../twenty-crm/` | ✅ | ✅ | ✅ |
| Freshcaller | `/connectors/neptune/.../freshcaller/` | ✅ | ✅ | ❌ |
| Resend | `/connectors/neptune/.../resend/` | ✅ | ✅ | ✅ |
| Weather | `/connectors/neptune/.../weather/` | ✅ | ✅ | ❌ |

**Total:** 14 connector skills, all with SKILL.md documentation.

---

## 6. Key Findings

### Critical
1. **Twenty CRM not operational for agents** — Custom objects not deployed, API key not created, zero data. Main blocker for Command Center adoption.
2. **Clerk using test keys** — `pk_test_*` in production env. Needs live key rotation.
3. **DPP/Forth token pending** — `FORTH_API_TOKEN=PENDING_user_not_yet_provided`. Credit repair integration is blocked.

### High Priority
4. **Resend unused** — API key configured but no transactional emails flowing. Twenty's `EMAIL_DRIVER=logger`.
5. **Freshcaller→VAPI migration in progress** — Both connectors exist. Clean up Freshcaller post-migration.
6. **Linear MCP inactive** — `LINEAR_MCP_URL` not resolving; MCP tools may not be accessible.

### Positive
7. **NMI integration is mature** — Sacred memory `6a1f118b`, comprehensive docs, watchdog, pulse monitoring, incremental sync.
8. **Slack sync is robust** — 10,927 messages from 13 channels, bidirectional sync.
9. **Hyperswitch healthy** — All 5 containers running with health checks, HTTP 200.
10. **Connector documentation comprehensive** — 14 connectors with full SKILL.md coverage.

---

*Generated by Hermès V5 · Stream 4 of comprehensive audit · 2026-06-17*

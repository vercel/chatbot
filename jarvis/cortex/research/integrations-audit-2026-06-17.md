---
type: "research"
name: "Integrations Audit 2026 06 17"
description: "Auto-generated description for Integrations Audit 2026 06 17"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Integrations Audit — 2026-06-17

> **Scope:** Every external service, API, and SaaS integration across VPS + Vercel + Docker  
> **Secrets sources:** `/etc/newleaf/.env`, Vercel env vars (94), connector skill configs  
> **Status key:** ✅ Active | ⚠️ Configured but inactive/partial | ❌ Not configured

---

## 1. Payment Stack

| Integration | Status | Credentials Location | Health | Last Sync |
|-------------|--------|----------------------|--------|-----------|
| **NMI (Network Merchants)** | ✅ Active | `/etc/newleaf/.env` → NMI_SECURITY_KEY, NMI_CONNECTOR_MCA_ID | ✅ | Real-time via nmiMcpBridge |
| | | Vercel env: NMI_SECURITY_KEY, NMI_CONNECTOR_MCA_ID | | |
| | | Sacred Memory: `6a1f118b` — Customer Vault architecture | | |
| | | Connector: `connector-skills/nmi/` (7 files) | | |
| **Hyperswitch (Allied Payments)** | ✅ Active | `/etc/newleaf/.env` → HYPERSWITCH_* (7 vars) | ✅ Healthy | Real-time |
| | | 5 Docker containers (server, control-center, superposition, pg, redis) | | |
| | | Vercel env: HYPERSWITCH_* matched | | |
| | | Connector: `connector-skills/hyperswitch/` (7 files) | | |
| **Stripe** | ❌ | None found | — | — |

**NMI Note:** Sacred Memory `6a1f118b` contains Golden Vault architecture — NEVER MODIFIED. MIT (no CVV) for recurring, CIT (CVV+IP) for initial. `source_transaction_id` is BANNED.

---

## 2. CRM + Communications

| Integration | Status | Credentials Location | Health | Notes |
|-------------|--------|----------------------|--------|-------|
| **Twenty CRM** | ⚠️ Partial | Docker on VPS (`twentycrm/twenty:latest`) | ✅ Healthy | Sign-ups open |
| | | `/etc/newleaf/.env` → TWENTY_* (5 vars) | | No API key created |
| | | Connector: `connector-skills/twenty-crm/` (7 files, 18 functions) | | Extensions not deployed |
| | | | | Iframe auth not integrated |
| **GHL (GoHighLevel)** | ⚠️ Partial | Vercel env: GHL_API_KEY, GHL_LOCATION_ID | Unknown | Not in /etc/newleaf/.env |
| | | Connector: `connector-skills/ghl/` (7 files) | | CRM/SMS/voice integration |
| **Freshcaller** | ⚠️ Partial | Connector: `connector-skills/freshcaller/` (7 files) | Unknown | No API key found in .env |
| **Resend (Email)** | ⚠️ Partial | `/etc/newleaf/.env` → RESEND_API_KEY | Not active | Not wired to Twenty (EMAIL_DRIVER=logger) |
| | | Vercel env: RESEND_API_KEY | | Connector: `connector-skills/resend/` (6 files) |
| **VAPI (Voice)** | ⚠️ Partial | Vercel env: VAPI_API_KEY | Unknown | Connector: `connector-skills/vapi/` (7 files) |
| | | AI tool: `lib/ai/tools/get-vapi-call.ts` | | No active voice agents |
| **Slack** | ✅ Active | `/etc/newleaf/.env` → SLACK_BOT_TOKEN | ✅ | #jarvis-admin (C0AQDDC3HAB) |
| | | Vercel env: SLACK_BOT_TOKEN, JARVIS_ADMIN_CHANNEL_ID | | Symphony-slack PM2 process |
| | | Connector: `connector-skills/slack/` (7 files) | | Post/thread/react/history |
| | | AI tool: `lib/ai/tools/pull-slack-thread.ts` | | |

---

## 3. Auth & Identity

| Integration | Status | Credentials | Notes |
|-------------|--------|-------------|-------|
| **Clerk** | ⚠️ Configured | Vercel: CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY | Consumer auth (Neptune Chat) |
| | | `/etc/newleaf/.env` → CLERK_* present | |
| **Better Auth v5** | ✅ Active | `/etc/newleaf/.env` → BETTER_AUTH_SECRET | OAuth providers: GitHub, Vercel, email/password |
| | | Vercel: BETTER_AUTH_SECRET, AUTH_SECRET | |
| **Vercel OAuth/OIDC** | ✅ Active | Vercel: VERCEL_OIDC_TOKEN | Programmatic auth for V2 |
| **GitHub App OAuth** | ✅ Active | `/etc/newleaf/.env` → GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_CLIENT_SECRET | V2 primary login |

---

## 4. Developer Tools

| Integration | Status | Configuration | Notes |
|-------------|--------|---------------|-------|
| **GitHub** | ✅ Active | `/etc/newleaf/.env` → GITHUB_TOKEN | Repo: `abhiswami2121/newleaf-financial` |
| | | Vercel: GITHUB_TOKEN | GitHub App webhook on V2 |
| | | Connector: `connector-skills/github/` | |
| **Linear** | ✅ Active | `/etc/newleaf/.env` → LINEAR_API_KEY | Synced every 5 min (linear_sync.py) |
| | | Vercel: LINEAR_API_KEY, LINEAR_MCP_URL | MCP server available |
| **E2B Sandbox** | ✅ Active | `/etc/newleaf/.env` → E2B_API_KEY, E2B_ACCESS_TOKEN | Templates: desktop, jarvis |
| | | Vercel: E2B_API_KEY, E2B_DESKTOP_TEMPLATE_ID, E2B_JARVIS_TEMPLATE_ID | VPS coding agent sandbox |
| **Smithey** | ⚠️ | `/etc/newleaf/.env` → SMITHERY_API_KEY | Design tool — usage unclear |
| **Open Design** | ⚠️ Running | PM2 open-design on :7456 | Nginx `opendesign` domain |

---

## 5. Automation & Workflow

| Integration | Status | Configuration | Notes |
|-------------|--------|---------------|-------|
| **n8n** | ⚠️ Running | Docker on VPS — health OK | 0 workflows configured |
| | | 3 containers: n8n, n8n_postgres, n8n_redis | Nginx: `n8n.newleaf.financial` |
| | | `/etc/newleaf/.env` → N8N_API_KEY, N8N_* (5 vars) | |
| **Base44 (Core)** | ✅ Active | `/etc/newleaf/.env` → BASE44_* (6 vars) | Backend for all operations |
| | | Vercel: BASE44_* matched | SDK: `@base44/sdk` v0.8.31 |
| | | Connector: `connector-skills/base44/` | |
| **Hostinger VPS** | ✅ Active | `/etc/newleaf/.env` → HOSTINGER_API_KEY | VPS management |
| | | Connector: `connector-skills/hostinger-vps/` | Bridge to VPS operations |

---

## 6. Domains & Infrastructure

| Integration | Status | Configuration | Notes |
|-------------|--------|---------------|-------|
| **Cloudflare** | ✅ Active | DNS for newleaf.financial | cloudflared tunnel (:20243) |
| **Vercel** | ✅ Active | 3 projects + API tokens | `prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl` (Chat) |
| | | VERCEL_TOKEN, VERCEL_API_TOKEN, VERCEL_PARTNER_TEAM_ID | V2: `open-agents` |
| | | Vercel connector skill | Iota: hermes-v3-template |
| **GoDaddy** | ✅ Active | GODADDY_API_KEY, GODADDY_API_SECRET | Domain registrar for newleaf.financial |

---

## 7. AI Providers

| Provider | Status | Key Location | Models Available |
|----------|--------|-------------|------------------|
| **Anthropic** | ✅ Active | `/etc/newleaf/.env` → ANTHROPIC_API_KEY | Claude Opus 4.7, Sonnet, Haiku |
| | | Vercel: ANTHROPIC_API_KEY | |
| **OpenAI** | ✅ Active | `/etc/newleaf/.env` → OPENAI_API_KEY | GPT-4o, GPT-4.1, o4-mini |
| **Google** | ✅ Active | `/etc/newleaf/.env` → GOOGLE_API_KEY | Gemini 2.5 Pro, Flash |
| **xAI (Grok)** | ✅ Active | `/etc/newleaf/.env` → XAI_API_KEY | Grok-3 |
| **DeepSeek** | ✅ Active | `/etc/newleaf/.env` → DEEPSEEK_API_KEY | DeepSeek-V3, R1 |
| **Groq** | ✅ Active | `/etc/newleaf/.env` → GROQ_API_KEY | Llama, Mixtral (fast inference) |
| **Zhipu (GLM)** | ✅ Active | Vercel only → ZHIPU_API_KEY | GLM-4 |
| **Kimi** | ✅ Active | `/etc/newleaf/.env` → KIMI_API_KEY | Moonshot-v1 |
| **Ollama (Local)** | ✅ Active | Localhost:11434 | Open-source models |
| **AI Gateway** | ✅ Active | `/etc/newleaf/.env` → AI_GATEWAY_API_KEY | Vercel AI Gateway (BYOK) |

---

## 8. Credit & Data

| Integration | Status | Configuration | Notes |
|-------------|--------|---------------|-------|
| **Forth/DPP** | ⚠️ Partial | `/etc/newleaf/.env` → FORTH_API_TOKEN | Credit report provider |
| | | Connector: `connector-skills/forth-dpp/` (7 files) | |
| **TwentyFirst** | ⚠️ | `/etc/newleaf/.env` → TWENTYFIRST_API_KEY | Credit data — usage unclear |
| **Affy** | ⚠️ | Vercel only → AFFY_API_KEY | Affiliate/partner platform |
| **JDI** | ⚠️ | `/etc/newleaf/.env` → JDI_API_KEY | JDI daily track activator |
| **Swami App** | ⚠️ | /etc/newleaf/.env → SWAMI_APP_API_KEY, SWAMI_APP_ID | App platform |

---

## 9. Integration Health Summary

```
✅ ACTIVE & HEALTHY (11):
  NMI, Hyperswitch, Slack, Better Auth, GitHub, Linear, E2B, 
  Base44, Anthropic, OpenAI, Vercel

⚠️ CONFIGURED BUT PARTIAL (14):
  Twenty CRM (no API key, no extensions, no iframe auth)
  GHL (keys only in Vercel, not in VPS .env)
  Resend (key exists, not wired to Twenty SMTP)
  VAPI (key exists, no active voice agents)
  Clerk (configured but Better Auth is primary)
  n8n (running but 0 workflows)
  Freshcaller (connector exists, no API key found)
  Forth/DPP (key exists, connector drafted)
  GoDaddy (keys exist, not actively managed)
  Cloudflare (tunnel running, WAF config unknown)
  Ollama (running locally, no production models)
  Smithey (key exists, purpose unclear)
  TwentyFirst (key exists, purpose unclear)
  Swami App (key exists, purpose unclear)

❌ NOT CONFIGURED (2):
  Stripe (no references found anywhere)
  Spinwheel (no references found anywhere)
```

---

## 10. Credential Sprawl Risk

| Location | Count | Risk |
|----------|-------|------|
| `/etc/newleaf/.env` | 79 secrets | 🔴 High — single file, no rotation |
| Vercel env vars (Chat) | 94 vars (88 encrypted) | 🟡 Medium — encrypted at rest |
| Vercel env vars (V2) | ~40 vars | 🟡 Medium |
| `.env.local` (neptune-chat) | 88 keys | 🟠 High — duplicates Vercel |
| `docker-compose.*` files | ~10 secrets | 🟡 Medium — inline env vars |
| Connector skill configs | ~20 API keys | 🟡 Medium — scattered across files |

**Total unique secrets:** ~100 across 6+ locations. No centralized secret management.

---

## 11. Recommended Priority Actions

1. **HIGH:** Create Twenty API key + deploy custom objects (unlocks CRM sync)
2. **HIGH:** Set `IS_SIGN_UP_ENABLED=false` on Twenty
3. **HIGH:** Wire Resend SMTP to Twenty (EMAIL_DRIVER=resend)
4. **MEDIUM:** Configure n8n workflows (at minimum: CRM sync, billing alerts)
5. **MEDIUM:** Consolidate secrets to single source of truth (Vault/Doppler)
6. **MEDIUM:** Create VAPI voice agent for customer outreach
7. **LOW:** Audit and remove unused integrations (Smithey, TwentyFirst, Swami, Affy)
8. **LOW:** Enable Cloudflare WAF rules for newleaf.financial domains

---

*Generated 2026-06-17 · Integrations Audit · Stream 4 of 7 · Read-only*

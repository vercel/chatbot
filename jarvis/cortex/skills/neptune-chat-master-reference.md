# Neptune Chat Master Reference

> Canonical reference for developing and operating Neptune Chat.
> Updated: 2026-06-21 | Mission: Connector Fortress

## Architecture Overview

Neptune Chat is a Next.js 16 + Vercel AI SDK 6 agentic chat application deployed at `neptune-chat-ashy.vercel.app`. It runs on a VPS at `187.127.250.171` with a Base44 CRM backend, NMI payment gateway, and Slack integration.

### Core Data Flow

```
Slack #jarvis-admin ──→ Neptune Chat ──→ NameResolver ──→ Base44 CRM ──→ NMI Vault
                              │                                              │
                              └── billing-alignment workflow ────────────────┘
```

## Connector Ecosystem

### 18 Main Connectors
| # | Connector | Type | Wrapped Tools | Status |
|---|-----------|------|---------------|--------|
| 1 | Base44 CRM | Entity CRUD | 63/246 | P0 — functions blocked by auth |
| 2 | NMI Payments | Payment gateway | 41/41 | ✅ Wired |
| 3 | Slack | Messaging | 27/27 | ✅ Wired |
| 4 | Hyperswitch | Payment routing | 16/16 | ✅ Wired |
| 5 | Reporting Hub | Aggregation | 16/16 | P0 — functions blocked by auth |
| 6 | GitHub | Repo management | 12/12 | ✅ Wired |
| 7 | Vapi | Voice AI | 9/9 | ✅ Wired |
| 8 | Linear | Tickets | 6/6 | ✅ Wired |
| 9 | Forth | DPP | 5/5 | ✅ Wired |
| 10 | Twilio | SMS | 4/4 | Token wired |
| 11 | Resend | Email | 3/3 | Token wired |
| 12 | GHL | CRM | 2/2 | Token wired |
| 13 | Twenty CRM | CRM (spec) | 0/0 | GATED — cardinal e7129f554293 |
| 14 | n8n | Workflow | 0/0 | Planned |
| 15 | Composio | MCP | 0/0 | Planned |
| 16 | Smithery | MCP | 0/0 | Planned |
| 17 | AI Gateway | Model routing | 0/0 | Planned |
| 18 | Discovery Lib | Workflows | 0/0 | Planned |

### Connector Wiring Pattern

Every connector follows the hermes-vps pattern (commit `b363a90`):
```
connectors/<name>/
├── client.ts         # SDK client with graceful degradation
├── manifest.ts       # ConnectorManifest interface
├── tools/            # AI SDK v6 tool() definitions
├── result-renderers/ # UI render components
├── playbook.mdx      # Usage documentation
└── types.ts          # TypeScript interfaces
```

## New Skills & Workflows (Connector Fortress)

### 1. NameResolver Skill
**Path:** `playbook-skills/connectors/name-resolver/`
**Domain:** billing-flow (P0)
**Purpose:** Resolve Slack customer names → Base44 profiles → NMI vault IDs

**Key Methods:**
- `resolve(name)` — Parse customer name, query Base44 CustomerProfile, fuzzy fallback
- `resolveMany(names)` — Bulk resolve with concurrency=5 batching
- `resolve360(identifier, type)` — Cross-system lookup for any identifier

**Usage:**
```typescript
import { nameResolver } from "@/playbook-skills/connectors/name-resolver";
const result = await nameResolver.resolve("Mary Nazworth");
// Result: { base44Id, firstName, lastName, nmiVaultId, nmiSubscriptionId, billingStatus, ... }
```

**Trigger keywords:** "who is [name]", "look up [name]", "find customer [name]", "resolve [name]"

### 2. Billing Alignment Workflow
**Path:** `app/api/workflows/billing-alignment/route.ts`
**Domain:** billing-flow (P0)
**Purpose:** Cross-reference Slack billing requests against NMI subscription state

**5-Step Pipeline:**
1. `getSlackHistory()` — Pull #jarvis-admin messages for lookback period
2. `extractCustomers()` — Regex name extraction + 6 intent patterns (unpause, plan_change, card_fail, reschedule, cancel, general_billing)
3. `nameResolver.resolveMany()` — Bulk customer identity resolution
4. `queryNmiSubscription()` — NMI MCP bridge subscription query
5. `categorizeAlignment()` — 6-category alignment report

**Endpoint:** `POST /api/workflows/billing-alignment`
```json
{ "lookbackDays": 7, "channelId": "C0AQDDC3HAB" }
```

**Alignment Categories:**
- **critical_misalignment**: Slack says X, NMI says Y (conflicting)
- **card_validation_failures**: Card issues detected
- **payment_reschedules**: Date changes requested
- **cancellations**: Cancel requests
- **aligned**: Slack + NMI agree
- **unresolved**: No NMI data available

**Trigger keywords:** "run billing alignment", "check slack billing alerts", "sync slack to NMI", "alignment report"

### 3. Multi-Source Puller
**Path:** `lib/discovery/multi-source-puller.ts`
**Purpose:** Pull customer data from Base44 + NMI + Warehouse in parallel

**Main Function:**
```typescript
import { pullCustomerData } from "@/discovery/multi-source-puller";
const data = await pullCustomerData({
  customerIds: ["cust_1", "cust_2"],
  includeNmi: true,
  includeBase44: true,
  includeComms: true,
  includeTickets: true,
});
```

## Environment Variables — Vercel

### Canonical Token Naming
```
NEPTUNE_<SERVICE>_<KEY>
```

### Tier 1 (P0)
| Variable | Purpose | Source |
|----------|---------|--------|
| `BASE44_API_KEY` | Base44 CRM SDK auth | /etc/newleaf/.env |
| `SLACK_BOT_TOKEN` | Slack bot auth | /etc/newleaf/.env |
| `GITHUB_TOKEN` | GitHub PAT | /etc/newleaf/.env |
| `NMI_SECURITY_KEY` | NMI payment gateway | /etc/newleaf/.env |
| `HYPERSWITCH_API_KEY` | Payment routing | /etc/newleaf/.env |
| `VPS_BRIDGE_URL` | VPS tool router | http://187.127.250.171:8400 |
| `NEPTUNE_INTERNAL_TOKEN` | Internal auth token | /etc/newleaf/.env |
| `VERCEL_TOKEN` | Vercel API deploy | vcp_... |

### Tier 2 (P1)
| Variable | Purpose |
|----------|---------|
| `LINEAR_API_KEY` | Linear task management |
| `VAPI_API_KEY` | Vapi voice AI |
| `FORTH_API_KEY` | Forth DPP |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Twilio SMS |
| `RESEND_API_KEY` | Resend email |

## Key Anti-Patterns

### NEVER Use These
1. **hostingerBridge** from VPS — use native Bash/Read/Write/Edit/Grep/Glob (5-30s latency + Cloudflare 403 risk)
2. **BASE44_BRIDGE_URL** — does not exist. Use `VPS_BRIDGE_URL`
3. **BASE44_DIAG_KEY** — does not exist. Use `NEPTUNE_INTERNAL_TOKEN`
4. **source_transaction_id** in NMI MIT charges — BANNED by Golden Vault architecture
5. **customer_vault_query** / **transaction_query** / **subscription_query** — wrong NMI action names
6. **Inline styles** — Tailwind + shadcn tokens only
7. **Horizontal scroll** — never, test at 375px

### NMI Bridge Action Names (CORRECT)
| Action | Purpose |
|--------|---------|
| `query_vault` | Get customer vault + subscription state |
| `query_subscription` | Get single subscription details |
| `query_transactions` | Get transaction history |

### VPS Bridge URL
```
VPS_BRIDGE_URL=http://187.127.250.171:8400
```
The bridge runs at `:8400`, NOT `:8101` or `:8102`.

## Key Bug Fixes (Connector Fortress)

1. **BASE44_API_KEY was wrong** — Set to `NL2026061471` (DIAGNOSTICS_API_KEY) instead of `336ada860f0648a98e62113cd62c8055`. Caused ALL Base44 SDK calls to silently fail.

2. **7 files with stale env var names** — Referenced `BASE44_BRIDGE_URL` and `BASE44_DIAG_KEY` which don't exist in any .env file or Vercel. Fixed to `VPS_BRIDGE_URL` and `NEPTUNE_INTERNAL_TOKEN`.

3. **5 files with wrong NMI action names** — Used `customer_vault_query`, `transaction_query`, `subscription_query` but the NMI MCP bridge only accepts `query_vault`, `query_transactions`, `query_subscription`.

4. **Module-level crash in base44/client.ts** — `if (!secrets.base44.apiKey) throw new Error(...)` at module load crashed entire import chain. Fixed with Proxy stub returning `Promise.resolve(null)`.

## Post-Deploy Verification

After every deploy to neptune-chat-ashy.vercel.app:
1. `POST /api/workflows/billing-alignment` with `{ lookbackDays: 7 }`
2. Verify Mary Nazworth shows `confirmed_subscription` (NOT paused)
3. Verify Zachary Taylor shows `hard_decline`
4. Verify Larry Shaw shows `soft_decline`

## Reference Customers

| Name | NMI Status | Amount | Next Charge | Card |
|------|-----------|--------|-------------|------|
| Mary Nazworth | confirmed_subscription | $248/mo | 2026-07-08 | Active |
| Zachary Taylor | hard_decline | $198/mo | — | Failed |
| Larry Shaw | soft_decline | $198/mo | — | Expired |

---

**END OF MASTER REFERENCE**

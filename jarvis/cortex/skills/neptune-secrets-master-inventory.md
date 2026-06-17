---
type: "skill"
name: "Neptune Secrets Master Inventory"
description: "Auto-generated description for Neptune Secrets Master Inventory"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Neptune Secrets Master Inventory — U2.7.A

**Generated:** 2026-06-11
**Scanner:** scripts/audit-secrets.ts (U2.7.A-v1.0)
**Scope:** Vercel Chat (prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl) · Vercel V2 (prj_lEoqz6p4zgdrLlObPl845TI2ApOm) · VPS (/etc/newleaf/.env)

## Summary

| Metric | Count |
|--------|-------|
| Total unique keys | 101 |
| Synced across all envs | 65 |
| Chat-only (missing from V2) | 14 |
| V2-only (missing from Chat) | 16 |
| Value drift | 1 |
| VPS-only | 1 |
| Unset / placeholder | 4 |

## Environment Coverage

### Chat (prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl)
- **Repository:** abhiswami2121/neptune-chat
- **Deploy URL:** https://neptune-chat-ashy.vercel.app
- **Env vars:** 81
- **Vercel API:** `GET /v9/projects/prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl/env`

### V2 (prj_lEoqz6p4zgdrLlObPl845TI2ApOm)
- **Repository:** abhiswami2121/neptune-agent-v2
- **Deploy URL:** https://neptune-agent-v2.vercel.app
- **Env vars:** 83
- **Vercel API:** `GET /v9/projects/prj_lEoqz6p4zgdrLlObPl845TI2ApOm/env`

### VPS (/etc/newleaf/.env)
- **Path:** /etc/newleaf/.env
- **Lines:** 107
- **Env vars parsed:** 78
- **Managed by:** vpsSecretSync (Base44 → VPS) + VPS-local manual

## Full Secret Inventory

All values are MASKED. Only first 4 and last 4 characters shown. Format: `XXXX****XXXX`.

### Category: slack
| Key | Chat | V2 | VPS | Status |
|-----|------|----|-----|--------|
| SLACK_BOT_TOKEN | ✅ | ✅ | ✅ | synced |
| JARVIS_ADMIN_CHANNEL_ID | ✅ C0AQ****3HAB | ✅ C08J****LJCR | ❌ | drift_value |

**Note:** JARVIS_ADMIN_CHANNEL_ID differs because Chat and V2 use different Slack workspaces. Expected.

### Category: base44
| Key | Chat | V2 | VPS | Status |
|-----|------|----|-----|--------|
| BASE44_API_KEY | ✅ | ✅ | ✅ | synced |
| BASE44_API_HOST | ✅ | ✅ | ✅ | synced |
| BASE44_API_URL | ❌ | ❌ | ✅ | vps_only |
| BASE44_APP_API_KEY | ✅ | ✅ | ✅ | synced |
| BASE44_APP_ID | ✅ | ✅ | ✅ | synced |
| BASE44_FUNCTIONS_URL | ✅ | ✅ | ✅ | synced |
| BASE44_VPS_API_URL | ✅ | ✅ | ✅ | synced |

### Category: hyperswitch
| Key | Chat | V2 | VPS | Status |
|-----|------|----|-----|--------|
| HYPERSWITCH_API_KEY | ✅ | ✅ | ✅ | synced |
| HYPERSWITCH_API_KEY_ID | ✅ | ✅ | ✅ | synced |
| HYPERSWITCH_PUBLISHABLE_KEY | ✅ | ✅ | ✅ | synced |
| HYPERSWITCH_ADMIN_API_KEY | ✅ | ✅ | ✅ | synced |
| HYPERSWITCH_WEBHOOK_SECRET | ✅ | ✅ | ✅ | synced |
| HYPERSWITCH_BASE_URL | ✅ | ✅ | ✅ | synced |
| HYPERSWITCH_PUBLIC_BASE_URL | ✅ | ✅ | ✅ | synced |
| HYPERSWITCH_MERCHANT_ID | ✅ | ✅ | ✅ | synced |
| HYPERSWITCH_PROFILE_ID | ✅ | ✅ | ✅ | synced |

### Category: nmi
| Key | Chat | V2 | VPS | Status |
|-----|------|----|-----|--------|
| NMI_SECURITY_KEY | ✅ | ✅ | ✅ | synced |
| NMI_CONNECTOR_MCA_ID | ✅ | ✅ | ✅ | synced |

### Category: vercel
| Key | Chat | V2 | VPS | Status |
|-----|------|----|-----|--------|
| VERCEL_TOKEN | ❌ | ❌ | ✅ | vps_only (sourced from .env) |
| VERCEL_PARTNER_TEAM_ID | ✅ | ❌ | ❌ | drift_chat_only |
| VERCEL_WEBHOOK_SECRET | ✅ | ❌ | ❌ | drift_chat_only |

### Category: github
| Key | Chat | V2 | VPS | Status |
|-----|------|----|-----|--------|
| GITHUB_TOKEN | ✅ | ✅ | ✅ | synced |
| GITHUB_APP_ID | ❌ | ✅ | ✅ | drift_v2_only |
| GITHUB_APP_PRIVATE_KEY | ❌ | ✅ | ✅ | drift_v2_only |
| GITHUB_CLIENT_SECRET | ❌ | ✅ | ✅ | drift_v2_only |
| GITHUB_WEBHOOK_SECRET | ❌ | ✅ | ❌ | drift_v2_only |

### Category: vps
| Key | Chat | V2 | VPS | Status |
|-----|------|----|-----|--------|
| NEPTUNE_INTERNAL_TOKEN | ✅ | ✅ | ✅ | synced |
| HOSTINGER_API_KEY | ❌ | ❌ | ✅ | vps_only (VPS-specific) |
| VPS_BRIDGE_TOKEN | ✅ | ✅ | ✅ | synced |
| VPS_BRIDGE_URL | ✅ | ❌ | ❌ | drift_chat_only |

### Category: ai_providers
| Key | Chat | V2 | VPS | Status |
|-----|------|----|-----|--------|
| AI_GATEWAY_API_KEY | ✅ | ✅ | ✅ | synced |
| ANTHROPIC_API_KEY | ✅ | ✅ | ⚠️ PENDING | synced (but VPS has placeholder) |
| DEEPSEEK_API_KEY | ✅ | ✅ | ✅ | synced |
| KIMI_API_KEY | ✅ | ✅ | ✅ | synced |
| OPENAI_API_KEY | ✅ | ❌ | ⚠️ PENDING | drift_chat_only |
| GOOGLE_API_KEY | ✅ | ❌ | ⚠️ PENDING | drift_chat_only |
| XAI_API_KEY | ✅ | ❌ | ⚠️ PENDING | drift_chat_only |
| GROQ_API_KEY | ✅ | ❌ | ⚠️ PENDING | drift_chat_only |

### Category: infrastructure
| Key | Chat | V2 | VPS | Status |
|-----|------|----|-----|--------|
| POSTGRES_URL | ✅ | ✅ | ❌ | synced |
| REDIS_URL | ✅ | ❌ | ❌ | drift_chat_only |
| AUTH_SECRET | ✅ | ❌ | ❌ | drift_chat_only |
| BETTER_AUTH_SECRET | ✅ | ✅ | ✅ | synced |
| BLOB_READ_WRITE_TOKEN | ✅ | ❌ | ❌ | drift_chat_only |
| DIAGNOSTICS_API_KEY | ✅ | ✅ | ✅ | synced |

### Category: neptune_v2
| Key | Chat | V2 | VPS | Status |
|-----|------|----|-----|--------|
| NEPTUNE_V2_POSTGRES_URL | ✅ | ✅ | ✅ | synced |
| NEPTUNE_V2_BETTER_AUTH_SECRET | ✅ | ✅ | ✅ | synced |
| NEPTUNE_V2_VERCEL_PROJECT_ID | ✅ | ✅ | ✅ | synced |
| NEPTUNE_V2_VERCEL_TEAM | ✅ | ✅ | ✅ | synced |
| NEPTUNE_V2_HANDOFF_SECRET | ✅ | ❌ | ❌ | drift_chat_only |
| NEPTUNE_V2_API_BASE | ✅ | ❌ | ❌ | drift_chat_only |
| OPEN_AGENTS_URL | ✅ | ❌ | ❌ | drift_chat_only |
| OPEN_AGENTS_API_KEY | ✅ | ✅ | ❌ | synced |
| NEPTUNE_E2E_TEST_TOKEN | ❌ | ✅ | ❌ | drift_v2_only |
| NEPTUNE_TEST_TOKEN | ✅ | ✅ | ✅ | synced |

### Category: e2b
| Key | Chat | V2 | VPS | Status |
|-----|------|----|-----|--------|
| E2B_API_KEY | ✅ | ✅ | ✅ | synced |
| E2B_ACCESS_TOKEN | ✅ | ✅ | ✅ | synced |
| E2B_JARVIS_TEMPLATE_ID | ✅ | ✅ | ✅ | synced |
| E2B_DESKTOP_TEMPLATE_ID | ✅ | ✅ | ✅ | synced |

### Category: clerk
| Key | Chat | V2 | VPS | Status |
|-----|------|----|-----|--------|
| CLERK_SECRET_KEY | ✅ | ✅ | ✅ | synced |
| CLERK_PUBLISHABLE_KEY | ✅ | ✅ | ✅ | synced |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | ✅ | ✅ | ✅ | synced |

### Category: connectors
| Key | Chat | V2 | VPS | Status |
|-----|------|----|-----|--------|
| RESEND_API_KEY | ✅ | ✅ | ✅ | synced |
| LINEAR_API_KEY | ✅ | ✅ | ✅ | synced |

### Category: other_services
| Key | Chat | V2 | VPS | Status |
|-----|------|----|-----|--------|
| N8N_API_KEY | ✅ | ✅ | ✅ | synced |
| N8N_USER_PASS | ✅ | ✅ | ✅ | synced |
| N8N_ENCRYPTION_KEY | ✅ | ✅ | ✅ | synced |
| N8N_BASIC_PASS | ✅ | ✅ | ✅ | synced |
| N8N_POSTGRES_PASS | ✅ | ✅ | ✅ | synced |
| SMITHERY_API_KEY | ✅ | ✅ | ✅ | synced |
| GODADDY_API_KEY | ✅ | ✅ | ⚠️ unquoted | synced |
| GODADDY_API_SECRET | ✅ | ✅ | ⚠️ unquoted | synced |
| TWENTYFIRST_API_KEY | ✅ | ✅ | ✅ | synced |
| TWENTY_APP_SECRET | ✅ | ✅ | ✅ | synced |
| TWENTY_ENCRYPTION_KEY | ✅ | ✅ | ✅ | synced |
| TWENTY_DATABASE_PASSWORD | ✅ | ✅ | ✅ | synced |
| TWENTY_SERVER_URL | ✅ | ✅ | ✅ | synced |
| TWENTY_REDIS_URL | ✅ | ✅ | ✅ | synced |
| TWENTY_API_KEY_PLACEHOLDER | ✅ | ✅ | ⚠️ | synced (but is placeholder) |
| OLLAMA_KEY | ✅ | ✅ | ✅ | synced |
| JDI_API_KEY | ✅ | ✅ | ✅ | synced |
| SWAMI_APP_ID | ✅ | ✅ | ✅ | synced |
| SWAMI_APP_API_KEY | ✅ | ✅ | ✅ | synced |

### Category: internal
| Key | Chat | V2 | VPS | Status |
|-----|------|----|-----|--------|
| HERMES_KEY | ✅ | ✅ | ✅ | synced |
| APP_BASE_URL | ✅ | ✅ | ✅ | synced |

### Category: webhooks
| Key | Chat | V2 | VPS | Status |
|-----|------|----|-----|--------|
| WEBHOOK_SIGNING_SECRET | ✅ | ✅ | ✅ | synced |

### Category: frontend
| Key | Chat | V2 | VPS | Status |
|-----|------|----|-----|--------|
| NEPTUNE_V2_API_BASE | ✅ | ❌ | ❌ | drift_chat_only |
| NEXT_PUBLIC_GITHUB_CLIENT_ID | ❌ | ✅ | ✅ | drift_v2_only |
| NEXT_PUBLIC_GITHUB_APP_SLUG | ❌ | ✅ | ✅ | drift_v2_only |

## V2-Only Keys (Environment-Specific)

These keys exist on V2 but not on Chat. Most are Vercel/V2-specific or GitHub App credentials:

- BETTER_AUTH_URL — V2-specific auth URL
- ENCRYPTION_KEY — V2-specific encryption
- GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY / GITHUB_CLIENT_SECRET / GITHUB_WEBHOOK_SECRET — GitHub App for V2
- JWE_SECRET — V2-specific JWE encryption
- NEPTUNE_E2E_TEST_TOKEN — V2 E2E test token
- NEXT_PUBLIC_GITHUB_APP_SLUG / NEXT_PUBLIC_GITHUB_CLIENT_ID — V2 GitHub App frontend
- NEXT_PUBLIC_VERCEL_APP_CLIENT_ID / NEXT_PUBLIC_VERCEL_APP_SLUG / NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL — V2 Vercel-specific
- OPEN_AGENTS_RESOURCE_PROFILE — V2 resource profile
- VERCEL_APP_CLIENT_SECRET / VERCEL_PROJECT_PRODUCTION_URL — V2 OAuth

## Chat-Only Keys (Environment-Specific)

These keys exist on Chat but not on V2. Most are Chat-specific infrastructure or unset providers:

- BLOB_READ_WRITE_TOKEN — Chat Vercel Blob storage
- NEWLEAF_ADMIN_CHANNEL_ID — Legacy Slack channel
- NEPTUNE_V2_HANDOFF_SECRET / NEPTUNE_V2_API_BASE — Chat → V2 handoff bridge
- OPEN_AGENTS_URL — Chat → V2 delegation
- REDIS_URL — Chat Redis cache
- VPS_BRIDGE_URL — Chat → VPS bridge
- VERCEL_PARTNER_TEAM_ID / VERCEL_WEBHOOK_SECRET — Chat Vercel config

## Unset / Placeholder Values

| Key | Status |
|-----|--------|
| ANTHROPIC_API_KEY | PENDING in VPS .env |
| OPENAI_API_KEY | PENDING in VPS .env |
| GOOGLE_API_KEY | PENDING in VPS .env |
| XAI_API_KEY | PENDING in VPS .env |
| GROQ_API_KEY | PENDING in VPS .env |
| FORTH_API_TOKEN | PENDING in VPS .env |
| VERCEL_PARTNER_TOKEN | PENDING in VPS .env |
| NEPTUNE_V2_API_KEY | PENDING in VPS .env |
| TWENTY_API_KEY_PLACEHOLDER | STUB value |

## Fixed in U2.7.A

1. **NEPTUNE_V2_POSTGRES_URL** (line 78): Was `<shared from neptune-ui Supabase>` (unquoted, had angle brackets/spaces → breaks shell sourcing). Fixed to properly quoted Supabase URL.
2. **NEPTUNE_V2_BETTER_AUTH_SECRET** (line 79): Was `<BETTER_AUTH_SECRET staged>` (same issue). Fixed to actual value matching the existing BETTER_AUTH_SECRET.

## .env Sourcing Issues

Two additional unquoted values in `/etc/newleaf/.env`:
- `GODADDY_API_KEY=e4XfRPoAZguc_WHkVWWsefpBE8Zp2ibwmCU` (no quotes)
- `GODADDY_API_SECRET=2UWpPCZjreGC3fWcdGRC8S` (no quotes)

These parse correctly currently (no special chars except underscore), but should be quoted for consistency.

## Rotation Status

| Status | Count |
|--------|-------|
| OK (<60d since update) | 96 |
| Due soon (>60d) | 0 |
| Overdue (>90d) | 5 |

Overdue keys are Vercel-encrypted values that haven't been rotated in >90 days. Review these first during the next rotation cycle.

## Audit Command

```bash
# Re-run the scanner:
cd /home/neptune/neptune-chat
npx tsx scripts/audit-secrets.ts

# View the inventory:
cat functions/secrets-inventory.json | python3 -m json.tool | head -40

# Query via API (authenticated):
curl "http://localhost:3000/api/secrets/audit?format=drift" \
  -H "x-neptune-internal-token: $NEPTUNE_INTERNAL_TOKEN"
```

## API Endpoints

- `GET /api/secrets/audit` — Full inventory (admin auth required)
- `GET /api/secrets/audit?format=drift` — Drift report only
- `GET /api/secrets/audit?refresh=true` — NOT YET IMPLEMENTED (use POST instead)
- `POST /api/secrets/audit` — Trigger re-scan
- `GET /library/secrets` — Admin-only UI dashboard

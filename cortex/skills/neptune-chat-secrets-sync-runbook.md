# Phase 5: Vercel Env Var Sync Strategy
**Date:** 2026-06-21 03:40 UTC | **Status:** DESIGN COMPLETE | **Runbook**

---

## Design Principle

**NEVER use Vercel CLI (`vercel`). ALWAYS use Vercel REST API.** Per cardinal `6a20a6a7`. The Vercel CLI adds an unnecessary dependency, requires login state management, and has rate-limit issues in CI. The REST API is reliable, authenticated, and scriptable.

## NEPTUNE_ Prefix Convention

All Neptune Chat connector env vars follow: `NEPTUNE_<SERVICE>_<KEY>`

| Service | Env Var | Secret Location | Required |
|---------|---------|----------------|----------|
| Base44 CRM | NEPTUNE_BASE44_API_KEY | /etc/newleaf/.env | P0 |
| Base44 CRM | NEPTUNE_BASE44_APP_API_KEY | /etc/newleaf/.env | P0 |
| Base44 CRM | NEPTUNE_BASE44_APP_ID | /etc/newleaf/.env | P0 |
| Base44 CRM | NEPTUNE_BASE44_FUNCTIONS_URL | /etc/newleaf/.env | P0 |
| NMI Payments | NEPTUNE_NMI_SECURITY_KEY | /etc/newleaf/.env | P0 |
| VPS Bridge | NEPTUNE_VPS_TOOLS_BRIDGE_URL | /etc/newleaf/.env | P0 |
| VPS Bridge | NEPTUNE_INTERNAL_TOKEN | /etc/newleaf/.env | P0 |
| Slack | NEPTUNE_SLACK_BOT_TOKEN | /etc/newleaf/.env | P0 |
| Hyperswitch | NEPTUNE_HYPERSWITCH_API_KEY | /etc/newleaf/.env | P1 |
| Hyperswitch | NEPTUNE_HYPERSWITCH_PUBLISHABLE_KEY | /etc/newleaf/.env | P1 |
| GitHub | NEPTUNE_GITHUB_TOKEN | /etc/newleaf/.env | P1 |
| Vercel | NEPTUNE_VERCEL_TOKEN | /etc/newleaf/.env | P1 |
| Linear | NEPTUNE_LINEAR_API_KEY | /etc/newleaf/.env | P1 |
| GHL | NEPTUNE_GHL_API_KEY | /etc/newleaf/.env | P1 |
| Vapi | NEPTUNE_VAPI_PRIVATE_KEY | /etc/newleaf/.env | P0 |
| Resend | NEPTUNE_RESEND_API_KEY | /etc/newleaf/.env | P2 |
| n8n | NEPTUNE_N8N_API_KEY | /etc/newleaf/.env | P2 |
| Smithery | NEPTUNE_SMITHERY_API_KEY | /etc/newleaf/.env | P2 |
| Forth | NEPTUNE_FORTH_API_TOKEN | /etc/newleaf/.env | P1 |
| Twilio | NEPTUNE_TWILIO_ACCOUNT_SID | /etc/newleaf/.env | P2 |
| Freshcaller | NEPTUNE_FRESHCALLER_API_KEY | /etc/newleaf/.env | P2 |

## Sync Architecture

```
/etc/newleaf/.env (SOURCE OF TRUTH on VPS)
  │
  ├─→ sync script: scripts/sync-vercel-env.ts
  │     │
  │     ├─ 1. Parse /etc/newleaf/.env → extract NEPTUNE_* vars
  │     ├─ 2. Diff against current Vercel env (GET /v9/projects/{id}/env)
  │     ├─ 3. Create/update changed vars (POST /v9/projects/{id}/env)
  │     └─ 4. Log changes to audit trail
  │
  └─→ Vercel Project env vars (NEPTUNE_CHAT_PROJECT_ID)
        └─→ Redeploy triggers automatically on env change
```

## Vercel REST API — Env Var CRUD

### Base URL & Auth
```
VERCEL_API = "https://api.vercel.com"
Headers: { Authorization: "Bearer ${VERCEL_TOKEN}" }
Team: ?teamId=${VERCEL_TEAM_ID}
```

### List env vars
```bash
GET /v9/projects/{projectId}/env?teamId={teamId}
→ { envs: [{ id, key, value, target, type, gitBranch }] }
```

### Create env var
```bash
POST /v9/projects/{projectId}/env?teamId={teamId}
{
  "key": "NEPTUNE_BASE44_API_KEY",
  "value": "NL2026061471",
  "type": "encrypted",    # "encrypted" | "secret" | "plain"
  "target": ["production", "preview", "development"]
}
```

### Update env var
```bash
PATCH /v9/projects/{projectId}/env/{envId}?teamId={teamId}
{ "value": "new-secret-value" }
```

### Delete env var
```bash
DELETE /v9/projects/{projectId}/env/{envId}?teamId={teamId}
```

## Sync Script: `scripts/sync-vercel-env.ts`

```typescript
#!/usr/bin/env tsx
/**
 * Sync NEPTUNE_* env vars from /etc/newleaf/.env to Vercel project.
 * NEVER uses Vercel CLI — REST API only (cardinal 6a20a6a7).
 */

import { readFileSync } from "fs";

const VERCEL_API = "https://api.vercel.com";
const VERCEL_TOKEN = process.env.VERCEL_TOKEN!;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID!;
const PROJECT_ID = process.env.NEPTUNE_CHAT_VERCEL_PROJECT_ID!;

// 1. Parse source env file
function parseEnvFile(path: string): Map<string, string> {
  const content = readFileSync(path, "utf-8");
  const vars = new Map<string, string>();
  for (const line of content.split("\n")) {
    const match = line.match(/^(NEPTUNE_[A-Z_]+)=["']?([^"'\n]+)["']?/);
    if (match) vars.set(match[1], match[2]);
  }
  return vars;
}

// 2. Fetch current Vercel env
async function getVercelEnv(): Promise<Map<string, { id: string; value: string }>> {
  const res = await fetch(
    `${VERCEL_API}/v9/projects/${PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID}`,
    { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
  );
  const { envs } = await res.json();
  const map = new Map();
  for (const e of envs) {
    if (e.key.startsWith("NEPTUNE_")) map.set(e.key, { id: e.id, value: e.value });
  }
  return map;
}

// 3. Diff and sync
async function syncEnv(): Promise<void> {
  const source = parseEnvFile("/etc/newleaf/.env");
  const current = await getVercelEnv();
  
  const changes: string[] = [];
  
  for (const [key, value] of source) {
    const existing = current.get(key);
    if (!existing) {
      // Create
      await fetch(`${VERCEL_API}/v9/projects/${PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ key, value, type: "encrypted", target: ["production"] }),
      });
      changes.push(`+ ${key}`);
    } else if (existing.value !== value) {
      // Update
      await fetch(`${VERCEL_API}/v9/projects/${PROJECT_ID}/env/${existing.id}?teamId=${VERCEL_TEAM_ID}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      changes.push(`~ ${key}`);
    }
  }
  
  console.log(`Synced ${changes.length} env vars to Vercel project ${PROJECT_ID}`);
  if (changes.length > 0) console.log(changes.join("\n"));
}

syncEnv().catch(console.error);
```

## Cron: Auto-Sync Daily

```cron
# Run daily at 03:00 UTC
0 3 * * * tsx /home/neptune/neptune-chat/scripts/sync-vercel-env.ts
```

## Vercel Project Env Vars (Already Set)

These ALREADY exist in .env.local and should be synced:

```
NEPTUNE_CHAT_VERCEL_PROJECT_ID=prj_xxx       # Neptune Chat project ID
NEPTUNE_V2_VERCEL_PROJECT_ID=prj_ToGOYRDO... # V2 project ID
NEPTUNE_V2_VERCEL_TEAM=team_NXlYvSlpN5m...   # V2 team ID
```

## Cardinal Rules

1. **NEVER `vercel` CLI** — REST API only
2. **NEVER commit secrets to git** — sync from /etc/newleaf/.env at runtime
3. **NEVER log secret values** — only log key names in changes
4. **ALWAYS use `type: "encrypted"`** — Vercel encrypts at rest
5. **ALWAYS target production** — `target: ["production"]`
6. **ALWAYS run as tsx script** — runnable from VPS or CLI

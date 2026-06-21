# Phase 2: Base44 405 + NMI Fetch Root Cause Analysis
**Date:** 2026-06-21 03:30 UTC | **Status:** COMPLETE | **Type:** diagnostic

---

## FINDING 1: Base44 405 — POST to /filter Path Doesn't Exist

### Live Curl Proof (03:20 UTC)

```bash
# ✅ WORKS: GET with query params (200)
curl -X GET "https://api.base44.app/api/apps/692f9a5fce9fd7c889a4b4ac/entities/CustomerProfile?limit=2" \
  -H "x-api-key: 336ada860f0648a98e62113cd62c8055"
# → 200 OK — returned real customer data (Shirley Cassity, Jamie Wood)

# ❌ 405: POST to /filter path
curl -X POST "https://api.base44.app/api/apps/692f9a5fce9fd7c889a4b4ac/entities/CustomerProfile/filter" \
  -H "x-api-key: 336ada860f0648a98e62113cd62c8055" \
  -d '{"filter":{},"sort":"-created_date","limit":2}'
# → 405 Method Not Allowed
```

### Root Cause

The `@base44/sdk` client in `/home/neptune/neptune-chat/connectors/base44/client.ts` uses `createClient({appId, serviceToken})` which internally uses GET + query params for entity reads. This works correctly. **BUT** when Neptune Chat's raw fetch paths or external callers try POST to `/entities/<Entity>/filter`, Base44 returns 405.

**The issue**: Base44's REST API uses `GET /entities/<Entity>` with query-string filters (`?filter=...`), not `POST /entities/<Entity>/filter` with JSON bodies. The SDK handles this internally, but any raw fetch code or non-SDK path fails.

### Impact
- **Neptune Chat Base44 connector**: WORKS via SDK path (reads only)
- **External callers (curl, n8n, Smithery)**: 405 on POST paths
- **Neptune Chat `base44/client.ts`**: Uses SDK — no code changes needed for reads
- **Neptune Chat MCP bridge calls**: routes through `base44Service.functions.invoke()` which hits 403 Admin required on functions endpoint

---

## FINDING 2: NMI Fetch Failure — VPS Bridge Auth Chain

### Architecture

```
Neptune Chat (NMI client)
  └─ POST https://jarvis.newleaf.financial/tools-bridge/tool/nmi/<action>
       Headers: { Authorization: "Bearer NL2026061471" }
       └─ VPS Tools Bridge
            └─ POST https://secure.networkmerchants.com/api/...
                 Headers: { Authorization: "..." with NMI security key }
```

### Token Chain Verification

| Token | Source | Value | Status |
|-------|--------|-------|--------|
| VPS_TOOLS_BRIDGE_URL | .env.local | `https://jarvis.newleaf.financial/tools-bridge` | ✅ Set |
| BASE44_API_KEY (used as Bearer) | .env.local | `NL2026061471` | ✅ Set |
| NMI_SECURITY_KEY | .env.local | `44jPA29E37QA76N8GAW8WwbM83Sn3wqu` | ✅ Set (on bridge) |
| NMI_CONNECTOR_MCA_ID | .env.local | `mca_PW7l917OgYxqa0MvXU1g` | ✅ Set |

### Root Cause

The NMI bridge call uses Bearer auth with `BASE44_API_KEY`, not `NEPTUNE_INTERNAL_TOKEN`. The bridge at `https://jarvis.newleaf.financial/tools-bridge` needs to accept this auth. If the bridge is:
1. **Down/not deployed** → Connection refused / timeout
2. **Auth misconfigured** → 401/403
3. **Routing misconfigured** → 404/502

The Neptune Chat `nmi/client.ts` correctly constructs the fetch call but has NO health check or connectivity validation before dispatch. All NMI calls fail silently.

### Fix Required
1. Verify the tools-bridge is deployed at jarvis.newleaf.financial
2. Verify the bridge accepts Bearer auth with BASE44_API_KEY
3. Add health check call before dispatch in NMI client
4. Add fallback path through Base44 functions if bridge is down

---

## FINDING 3: Functions Endpoint — 403 Admin Required

```bash
❌ POST https://new-leaf-financial.base44.app/api/functions/reportingHubQuery
   → 403 {"error":"Admin required"}
❌ GET  https://new-leaf-financial.base44.app/api/functions/reportingHubQuery?action=overview
   → 403 {"error":"Admin required"}
```

Both POST and GET to the functions endpoint return 403. The `BASE44_APP_API_KEY` (`336ada860f0648a98e62113cd62c8055`) works for entity reads but NOT for function invocations — those require admin-level auth.

### Impact on Neptune Chat
- `base44/client.ts` MCP bridge delegates (`nmi_invoke`, `slack_invoke`, etc.) call `base44Service.functions.invoke()` → these ALL fail
- `customer_360` action calls `base44Service.functions.invoke("crossSystemLookup")` → also fails
- All `jarvis_*` actions (file read/write, task manager, data guard) → all fail

---

## FINDING 4: Missing Connector Tokens in .env.example

The `.env.example` file is MISSING entries for ALL connector services:
- No `BASE44_API_KEY`, `BASE44_APP_API_KEY`, `BASE44_FUNCTIONS_URL`
- No `NMI_SECURITY_KEY`, `VPS_TOOLS_BRIDGE_URL`
- No `SLACK_BOT_TOKEN`
- No `GHL_API_KEY`, `VAPI_PRIVATE_KEY`, `LINEAR_API_KEY`
- No `HYPERSWITCH_*`, `RESEND_API_KEY`, `SMITHERY_API_KEY`
- No `NEPTUNE_INTERNAL_TOKEN` (used as VPS auth)

Only present: `VERCEL_TOKEN`, `GITHUB_TOKEN`, `YOUTUBE_API_KEY`, AI gateway, AUTH_SECRET.

**Risk**: New deployments from .env.example will have zero connector connectivity.

---

## Summary

| Issue | Severity | Root Cause | Fix |
|-------|----------|-----------|-----|
| Base44 405 | P0 | POST to /filter path not supported; SDK uses GET internally | Document SDK-only path; add raw GET fallback |
| Base44 403 functions | P0 | APP_API_KEY lacks admin scope for function invoke | Use NEPTUNE_INTERNAL_TOKEN or admin-scope key |
| NMI bridge unknown | P0 | tools-bridge health unverified; no connectivity checks | Add health check + fallback path |
| .env.example incomplete | P1 | Missing 20+ connector env vars | Add all NEPTUNE_ prefix vars |

# Phase 4: Customer Identity Resolver Design
**Date:** 2026-06-21 03:35 UTC | **Status:** DESIGN COMPLETE | **Tier:** 250t

---

## Problem Statement

Neptune Chat currently has NO identity resolver. When a user says "look up Mary Nazworth", Neptune Chat doesn't know how to find Mary's Base44 customer record. Jarvis-Base44 succeeds because the Base44 MCP tools accept customer IDs, vault IDs, and direct entity queries — but Neptune Chat needs a fuzzy resolver that takes natural language identifiers and maps them to structured customer records.

## Design

### Resolver Architecture

```
User Input: "Look up Mary Nazworth"
  │
  ├─→ 1. Name Parser (extract firstName, lastName from NL)
  │     "Mary Nazworth" → { firstName: "Mary", lastName: "Nazworth" }
  │
  ├─→ 2. Multi-Source Search (parallel)
  │     ├─ Base44 CustomerProfile query (fuzzy name match)
  │     ├─ NMI vault lookup (by customer name via bridge)
  │     ├─ Slack user search (by name)
  │     └─ GHL contact search (by name)
  │
  ├─→ 3. Confidence Scoring
  │     Match quality: exact > fuzzy > partial
  │     Source weight: Base44 (0.5) + NMI vault (0.3) + Slack (0.2)
  │
  └─→ 4. Enrichment (resolve related entities)
        ├─ NMI vault IDs + subscription IDs
        ├─ Recent transactions
        ├─ Support tickets
        ├─ Slack messages
        └─ Activity timeline
```

### API Contract

```typescript
// lib/identity/resolver.ts

interface ResolveRequest {
  query: string;                    // "Mary Nazworth" | "mary@email.com" | "8162940866"
  sources?: ("base44" | "nmi" | "slack" | "ghl")[];  // default: all
  minConfidence?: number;           // default: 0.6
  enrich?: boolean;                 // default: true — fetch related entities
  limit?: number;                   // default: 5 matches
}

interface ResolveResult {
  matches: IdentityMatch[];
  took: number;                     // ms
  sourceBreakdown: { source: string; matches: number; took: number }[];
}

interface IdentityMatch {
  confidence: number;               // 0.0–1.0
  customer: {
    id: string;                     // Base44 customer ID
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    status: string;
    enrollmentStatus: string;
  };
  vaults: {
    nmiVaultId?: string;
    nmiBillingId?: string;
    nmiSubscriptionId?: string;
    vaultHealth: string;
    subscriptionHealth: string;
    lastDeclineCode?: string;
    lastDeclineReason?: string;
  }[];
  activity: {
    lastTransaction?: { id: string; amount: number; date: string; status: string };
    recentTickets: number;
    recentSlackMessages: number;
    lastEmailSentAt?: string;
    lastCallAt?: string;
  };
  matchedBy: string;               // "exact_name" | "fuzzy_name" | "email" | "phone" | "vault_id"
}
```

### Query Strategy (Priority-Ordered)

| Strategy | Input Type | Engine | Confidence Floor |
|----------|-----------|--------|-----------------|
| 1. Exact email | email | Base44 CustomerProfile.filter({email}) | 0.95 |
| 2. Exact phone | phone (10-11 digits) | Base44 CustomerProfile.filter({phone}) | 0.90 |
| 3. Exact vault ID | nmi_vault_ prefix | NMI bridge getVault → cross-ref Base44 | 0.90 |
| 4. Exact customer ID | Mongo ObjectId | Base44 CustomerProfile.get(id) | 1.0 |
| 5. First+Last name exact | "Mary Nazworth" | Base44 CustomerProfile.filter({firstName, lastName}) | 0.85 |
| 6. First+Last name fuzzy | "Mary Nasworth" | Base44 CustomerProfile.filter + Levenshtein | 0.60 |
| 7. First name only | "Mary" | Base44 CustomerProfile.filter({firstName}) | 0.40 |
| 8. Last name only | "Nazworth" | Base44 CustomerProfile.filter({lastName}) | 0.30 |

### Implementation: Two-Phase Lookup

**Phase A — Candidate Fetch (fast, parallel):**
```typescript
async function fetchCandidates(query: string): Promise<Candidate[]> {
  const [base44Results, nmiResults, slackResults] = await Promise.allSettled([
    // Base44: exact name match (first priority)
    base44Service.entities.CustomerProfile.filter(
      buildNameFilter(query), "-created_date", 10
    ),
    // NMI: vault search by customer name
    fetch(`${BRIDGE_URL}/tool/nmi/searchCustomers`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ query, limit: 5 })
    }).then(r => r.json()),
    // Slack: user search
    slackClient.searchMessages({ query, count: 5 })
  ]);
  return mergeCandidates(base44Results, nmiResults, slackResults);
}
```

**Phase B — Enrichment (after user picks a match):**
Uses the existing `customer_360` approach from `connectors/base44/tools/customer360.ts`:
```typescript
async function enrichCustomer(customerId: string): Promise<EnrichedCustomer> {
  const result = await base44Service.functions.invoke("crossSystemLookup", {
    identifier: customerId,
    identifier_type: "customer_id"
  });
  return result;
}
```

### Fuzzy Name Matching

```typescript
// Levenshtein distance for typo tolerance
function nameSimilarity(a: string, b: string): number {
  const dist = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLen = Math.max(a.length, b.length);
  return 1 - (dist / maxLen);  // 1.0 = exact match
}

function buildNameFilter(query: string): Record<string, unknown> {
  const parts = query.trim().split(/\s+/);
  if (parts.length === 2) {
    return {
      $or: [
        { firstName: { $regex: parts[0], $options: "i" }, lastName: { $regex: parts[1], $options: "i" } },
        { firstName: { $regex: parts[1], $options: "i" }, lastName: { $regex: parts[0], $options: "i" } }, // swapped
      ]
    };
  }
  // Single name — try both fields
  return {
    $or: [
      { firstName: { $regex: parts[0], $options: "i" } },
      { lastName: { $regex: parts[0], $options: "i" } },
    ]
  };
}
```

### File Structure

```
lib/identity/
  resolver.ts          — main resolve() function
  matchers.ts          — name, email, phone, vault_id detection
  enrichment.ts        — cross-system lookup via Base44
  types.ts             — ResolveRequest, IdentityMatch, etc.
  fuzzy.ts             — Levenshtein, metaphone
connectors/
  customer-identity/   — NEW connector (follows hermes-vps pattern)
    SKILL.md
    client.ts
    actions.ts
    manifest.ts
    tools/
      resolve.ts
```

### Connector Manifest

Following the **hermes-vps proven pattern** (SKILL.md + client.ts + actions.ts):

```typescript
// connectors/customer-identity/manifest.ts
const customerIdentityManifest: ConnectorManifest = {
  id: "customer-identity",
  name: "Customer Identity Resolver",
  description: "Fuzzy name/phone/email → customer match with vault + subscription enrichment",
  envKeys: ["BASE44_API_KEY", "VPS_TOOLS_BRIDGE_URL"],
  capabilities: [
    { id: "resolve", label: "Resolve Identity", description: "Find customer by name, email, or phone" },
    { id: "enrich", label: "Enrich Customer", description: "Get full dossier with vaults and activity" }
  ],
  // ... follow manifest pattern from hermes-vps
};
```

### Acceptance Criteria

1. **AC-1**: "Look up Mary Nazworth" → returns Mary's customer record with confidence ≥ 0.85
2. **AC-2**: "Find customer with vault nmi_vault_abc123" → returns the vault owner
3. **AC-3**: "Who is 816-294-0866?" → returns Shirley Cassity (phone match)
4. **AC-4**: Typo "Mary Nasworth" → returns Mary Nazworth with confidence ≥ 0.60
5. **AC-5**: "Find all customers named Zachary" → returns Zachary Taylor + any others
6. **AC-6**: Enriched response includes vault IDs, sub IDs, and activity summary
7. **AC-7**: Response time < 2s for simple lookup, < 5s for enriched

### Dependencies
- **Base44 connector** (P0) — for entity queries and crossSystemLookup
- **NMI connector** (P0) — for vault enrichment
- **Slack connector** (P1) — for Slack message enrichment (optional)

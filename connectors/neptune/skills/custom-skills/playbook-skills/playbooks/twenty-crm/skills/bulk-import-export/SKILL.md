---
name: "bulk-import-export"
description: "Import and export data in bulk between Twenty CRM and external systems using GraphQL batch operations and REST APIs"
version: "1.0.0"
domain: "twenty-crm"
repo_refs:
  - "/home/hermes/repos/twenty/packages/twenty-server/src/engine/api/graphql/"
  - "/home/hermes/repos/twenty/packages/twenty-server/src/engine/api/rest/"
  - "/home/hermes/repos/twenty/packages/twenty-server/src/engine/core-modules/record-crud/"
  - "/home/hermes/cortex/research/twenty/features/graphql-rest-api-reference.md"
  - "/home/hermes/cortex/research/twenty/features/migration-patterns.md"
api_refs:
  - "GraphQL batch mutations: up to 60 records per call"
  - "REST batch: POST /rest/{object}/batch"
  - "GraphQL query pagination: first + after cursor"
  - "REST query pagination: limit + page"
---

# Bulk Import/Export Skill

## Overview
Bulk-import data into Twenty CRM from external systems (Base44, CSV, GHL, NMI) and export data for reporting, backups, or external processing. Uses GraphQL batch mutations and REST batch endpoints with proper pagination.

## Import Methods

### GraphQL Batch Create (Up to 60 Records)
```graphql
mutation {
  createPaymentRecords(data: [
    {
      amount: 99.00,
      success: true,
      nmiTransactionId: "txn_001",
      chargeDate: "2026-06-20T15:30:00Z",
      person: { connect: { id: "person-uuid-1" } }
    },
    {
      amount: 149.00,
      success: true,
      nmiTransactionId: "txn_002",
      chargeDate: "2026-06-20T16:00:00Z",
      person: { connect: { id: "person-uuid-2" } }
    }
  ]) {
    id amount success
  }
}
```

### GraphQL Batch Upsert
```graphql
mutation {
  upsertPersons(
    data: [
      { email: "alice@example.com", firstName: "Alice", lastName: "Doe" },
      { email: "bob@example.com", firstName: "Bob", lastName: "Smith" }
    ],
    onConflictKey: "email"
  ) { id email firstName }
}
```

### REST Batch Endpoint
```bash
curl -X POST http://localhost:3002/rest/person/batch \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"data": [
    {"firstName": "Alice", "lastName": "Doe", "email": "alice@example.com"},
    {"firstName": "Bob", "lastName": "Smith", "email": "bob@example.com"}
  ]}'
```

### CSV Import (via UI)
1. Navigate to the object list view
2. Click Import → Upload CSV
3. Map columns to fields
4. Review and confirm
5. System processes in background with result notification

## Export Methods

### GraphQL Paginated Export
```graphql
query {
  persons(
    first: 100,
    after: "cursor-from-previous-page",
    orderBy: [{ createdAt: DESC }]
  ) {
    edges {
      node { id firstName lastName email createdAt }
      cursor
    }
    pageInfo { hasNextPage endCursor }
    totalCount
  }
}
```
Loop: use `endCursor` as `after` in next query until `hasNextPage` is false.

### REST Paginated Export
```bash
# Page 1
curl "http://localhost:3002/rest/person?limit=100&page=1" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Page 2
curl "http://localhost:3002/rest/person?limit=100&page=2" \
  -H "Authorization: Bearer YOUR_API_KEY"
```
Check `Content-Range` response header for total count.

### TypeScript Bulk Export Script
```ts
import { CoreApiClient } from 'twenty-client-sdk/core';
import * as fs from 'fs';

async function exportAllPersons() {
  const client = new CoreApiClient();
  const allRecords: any[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const result = await client.query({
      persons: {
        __args: { first: 100, after: cursor, orderBy: [{ createdAt: 'DESC' }] },
        edges: {
          node: { id: true, firstName: true, lastName: true, email: true },
          cursor: true,
        },
        pageInfo: { hasNextPage: true, endCursor: true },
      },
    });

    for (const edge of result.persons.edges) {
      allRecords.push(edge.node);
    }

    hasNextPage = result.persons.pageInfo.hasNextPage;
    cursor = result.persons.pageInfo.endCursor;
    console.log(`Fetched ${allRecords.length} records...`);
  }

  fs.writeFileSync('persons-export.json', JSON.stringify(allRecords, null, 2));
  console.log(`Export complete: ${allRecords.length} records`);
}
```

## Base44 → Twenty Migration Patterns

### Phase 1: Schema Mapping
| Base44 Entity | Twenty Object | Key Mapping |
|---------------|---------------|-------------|
| CustomerProfile | person | email → email, phone → phone |
| Subscription | subscription | nmiVaultId → nmiVaultId |
| PaymentLog | paymentRecord | txn_id → nmiTransactionId |
| SupportTicket | task | title → title, status → status |
| CreditDispute | creditDispute | bureau → bureau, round → roundNumber |
| Enrollment | enrollment | stage → stage, signedAt → signedAt |

### Phase 2: Bulk Import Strategy
```
1. Export from Base44 (dataEngine query)
2. Transform to Twenty shape (field mapping + UUID generation)
3. Chunk into batches of 50 (below 60 limit)
4. Use upsert with onConflictKey to avoid duplicates
5. Verify counts match
6. Run relationship linking pass (connect person IDs)
```

### Phase 3: Validation Queries
```sql
-- Compare record counts
SELECT 'persons', COUNT(*) FROM person
UNION ALL
SELECT 'paymentRecords', COUNT(*) FROM "_newleafFoundation_paymentRecord";

-- Validate relationships
SELECT COUNT(*) FROM "_newleafFoundation_paymentRecord" WHERE "personId" IS NULL;
```

## Rate Limits and Constraints
| Limit | Value |
|-------|-------|
| Batch create max | 60 records per call |
| GraphQL rate limit | 100 requests/min |
| Pagination max page size | 200 records |
| Request timeout | 30 seconds |
| CSV import max | ~10K rows (UI), unlimited via API batches |

## Worked Example: Import NMI Transaction History
```ts
async function importNmiTransactions(transactions: NmiTxn[]) {
  const client = new CoreApiClient();
  
  // Chunk into batches of 50
  const chunks = chunkArray(transactions, 50);
  
  for (const chunk of chunks) {
    const data = chunk.map(txn => ({
      amount: parseFloat(txn.amount),
      success: txn.response === '1',
      nmiTransactionId: txn.transaction_id,
      responseCode: txn.response_code,
      responseText: txn.response_text,
      cardLast4: txn.cc_number?.slice(-4),
      actionType: txn.action_type,
      chargeDate: txn.transaction_date,
      person: { connect: { nmiVaultId: txn.customer_vault_id } },
    }));

    try {
      const result = await client.mutation({
        createPaymentRecords: {
          __args: { data },
          id: true, amount: true,
        },
      });
      console.log(`Batch imported: ${result.createPaymentRecords.length} records`);
    } catch (err) {
      console.error('Batch failed:', err);
      // Retry individual records
    }
  }
}
```

## Error Handling
| Error | Cause | Fix |
|-------|-------|-----|
| "Batch size exceeds 60" | Too many records | Chunk into batches of 50-60 max |
| 429 Rate Limited | Too many requests | Add delay between batches (1s per batch min) |
| "Relation target not found" | Invalid connect ID | Pre-load all target IDs, validate before import |
| "Field X is required" | Missing required field | Check object definition for required fields |
| Timeout on large batch | Processing too many records | Reduce batch size, add processing delay |
| Duplicate records | Not using upsert | Use upsert with onConflictKey for idempotent imports |
| CSV import stuck | Large file processing | Use API batch import instead of UI for >10K rows |

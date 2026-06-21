---
name: "mutate-twenty-data"
description: "Create, update, and delete records in Twenty CRM via GraphQL mutations and REST API"
version: "1.0.0"
domain: "twenty-crm"
repo_refs:
  - "/home/hermes/repos/twenty/packages/twenty-server/src/engine/core-modules/record-crud/"
  - "/home/hermes/repos/twenty/packages/twenty-client-sdk/"
api_refs:
  - "GraphQL mutations at /graphql"
  - "REST POST/PUT/PATCH/DELETE at /rest/"
---

# Mutate Twenty Data Skill

## Overview
Create, update, delete, and batch-operate on records in the NewLeaf Twenty workspace.

## GraphQL Mutations (Recommended)

### Create Record
```graphql
mutation {
  createPaymentRecord(data: {
    amount: 99.00,
    success: true,
    nmiTransactionId: "txn_abc123",
    responseCode: "100",
    cardLast4: "7202",
    actionType: "recurring_charge",
    chargeDate: "2026-06-20T15:30:00Z",
    person: { connect: { id: "person-uuid" } }
  }) {
    id amount success createdAt
  }
}
```

### Update Record
```graphql
mutation {
  updatePaymentRecord(id: "payment-record-id", data: {
    status: "refunded"
    responseText: "Refund processed"
  }) {
    id status responseText
  }
}
```

### Batch Create (up to 60 records)
```graphql
mutation {
  createPaymentRecords(data: [
    { amount: 99.00, success: true, person: { connect: { id: "p1" } } },
    { amount: 149.00, success: true, person: { connect: { id: "p2" } } },
  ]) {
    id amount
  }
}
```

### Batch Upsert
```graphql
mutation {
  upsertPersons(
    data: [{ email: "alice@example.com", firstName: "Alice" }],
    onConflictKey: "email"
  ) { id email firstName }
}
```

### Delete Record
```graphql
mutation {
  deletePaymentRecord(id: "payment-record-id") { id }
}
```

## curl Examples
```bash
# Create
curl -X POST http://localhost:3002/graphql \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { createPaymentRecord(data: { amount: 99.00, success: true }) { id } }"}'

# Batch create via REST
curl -X POST http://localhost:3002/rest/paymentRecord/batch \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"data": [{"amount": 50.00}, {"amount": 75.00}]}'
```

## TypeScript (CoreApiClient)
```ts
const client = new CoreApiClient();

// Create
const { createPaymentRecord } = await client.mutation({
  createPaymentRecord: {
    __args: {
      data: {
        amount: 99.00,
        success: true,
        person: { connect: { id: 'person-uuid' } },
      },
    },
    id: true, amount: true,
  },
});

// Update
await client.mutation({
  updatePaymentRecord: {
    __args: { id: recordId, data: { status: 'refunded' } },
    id: true,
  },
});
```

## Relation Operations
```graphql
# Connect existing record
person: { connect: { id: "person-uuid" } }

# Disconnect
person: { disconnect: true }

# Create nested
person: { create: { firstName: "New", lastName: "Person" } }
```

## Error Handling
| Error | Cause | Fix |
|-------|-------|-----|
| "Record not found" | Wrong ID or deleted | Verify ID exists |
| "Field X is required" | Missing required field | Include in data payload |
| "Relation target not found" | Invalid relation ID | Verify target record exists |
| 409 Conflict | Duplicate unique field | Use upsert or check uniqueness |
| "Cannot update readonly field" | Field not writable | Check role field permissions |

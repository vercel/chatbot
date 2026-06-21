# Twenty CRM — API Reference

## API Surface
Twenty exposes three API protocols, auto-generated for all objects (standard + custom):

| API | Endpoint | Client | Best For |
|-----|----------|--------|----------|
| GraphQL | `/graphql` | CoreApiClient | Complex queries, nested data, mutations |
| REST | `/rest/{object}` | RestApiClient | Simple CRUD, curl-friendly |
| MCP | `/mcp` | MCP clients | AI agent tool access |

## Authentication
All requests require a bearer token:
```bash
Authorization: Bearer YOUR_API_KEY
```
API keys created at Settings → API & Webhooks. Scoped to role permissions.

## GraphQL API

### Single Record Query
```graphql
query {
  person(id: "person-uuid") {
    id firstName lastName email
    creditScore
    subscriptions { id amount status }
  }
}
```

### List with Filtering
```graphql
query {
  persons(
    first: 10,
    filter: { email: { ilike: "%@gmail.com" } },
    orderBy: [{ createdAt: DESC }]
  ) {
    edges { node { id firstName email createdAt } }
    totalCount
  }
}
```

### Nested Relations
```graphql
query {
  person(id: "person-uuid") {
    subscriptions { id amount frequency status nextChargeDate }
    paymentRecords(first: 5, orderBy: [{ chargeDate: DESC }]) {
      edges { node { id amount success chargeDate } }
    }
    creditDisputes { id bureau roundNumber status }
  }
}
```

### Create Mutation
```graphql
mutation {
  createPaymentRecord(data: {
    amount: 99.00,
    success: true,
    nmiTransactionId: "txn_abc123",
    chargeDate: "2026-06-20T15:30:00Z",
    person: { connect: { id: "person-uuid" } }
  }) {
    id amount success createdAt
  }
}
```

### Batch Create (up to 60 records)
```graphql
mutation {
  createPaymentRecords(data: [
    { amount: 99.00, success: true, person: { connect: { id: "p1" } } },
    { amount: 149.00, success: true, person: { connect: { id: "p2" } } }
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

### Relation Operations
```graphql
# Connect existing
person: { connect: { id: "uuid" } }

# Disconnect
person: { disconnect: true }

# Create nested (inline)
person: { create: { firstName: "New", lastName: "Person" } }
```

### TypeScript (CoreApiClient)
```ts
import { CoreApiClient } from 'twenty-client-sdk/core';

const client = new CoreApiClient();

// Query
const { person } = await client.query({
  person: {
    __args: { id: 'person-uuid' },
    id: true, firstName: true, email: true,
    subscriptions: { id: true, amount: true, status: true },
  },
});

// Mutation
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
```

## REST API

### List Records
```bash
curl "http://localhost:3002/rest/person?limit=20&page=1" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Get Single Record
```bash
curl "http://localhost:3002/rest/person/person-uuid" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Create Record
```bash
curl -X POST http://localhost:3002/rest/person \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Alice", "lastName": "Doe", "email": "alice@example.com"}'
```

### Batch Create
```bash
curl -X POST http://localhost:3002/rest/paymentRecord/batch \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"data": [{"amount": 50.00}, {"amount": 75.00}]}'
```

### Update
```bash
curl -X PATCH http://localhost:3002/rest/person/person-uuid \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Updated"}'
```

### Delete
```bash
curl -X DELETE http://localhost:3002/rest/person/person-uuid \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## MCP API
Twenty includes a Model Context Protocol server at `/mcp` for AI agent integration:
```json
{
  "tools": [
    {
      "name": "query_persons",
      "description": "Query CRM persons with filters",
      "inputSchema": { "type": "object", "properties": { "email": { "type": "string" } } }
    }
  ]
}
```

## Pagination
- **GraphQL:** `first` + `after` cursor (relay-style)
- **REST:** `limit` + `page` query params
- **Max page size:** 200 records
- **Rate limit:** 100 requests/minute

## curl Examples for NewLeaf
```bash
# Health check
curl http://localhost:3002/healthz

# Schema introspection
curl -X POST http://localhost:3002/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name } } }"}'

# Current user (authenticated)
curl -X POST http://localhost:3002/graphql \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ currentUser { email } }"}'
```

## Error Response Format
```json
{
  "errors": [{
    "message": "Cannot query field \"badField\" on type \"Person\"",
    "extensions": { "code": "GRAPHQL_VALIDATION_FAILED" }
  }]
}
```

## Common Error Codes
| Code | Meaning | Fix |
|------|---------|-----|
| 401 | Invalid/expired API key | Rotate key |
| 403 | Insufficient permissions | Check role objectPermissions |
| 404 | Record not found | Verify ID |
| 409 | Duplicate unique field | Use upsert |
| 429 | Rate limited (>100 req/min) | Wait 60s, batch queries |

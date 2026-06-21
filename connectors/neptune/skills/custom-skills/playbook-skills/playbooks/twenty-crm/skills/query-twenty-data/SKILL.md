---
name: "query-twenty-data"
description: "Query Twenty CRM data via GraphQL and REST APIs with filtering, pagination, and relation traversal"
version: "1.0.0"
domain: "twenty-crm"
repo_refs:
  - "/home/hermes/repos/twenty/packages/twenty-server/src/engine/api/graphql/"
  - "/home/hermes/repos/twenty/packages/twenty-server/src/engine/api/rest/"
  - "/home/hermes/repos/twenty/packages/twenty-client-sdk/"
  - "/home/hermes/cortex/research/twenty/features/graphql-rest-api-reference.md"
api_refs:
  - "GraphQL at /graphql (CoreApiClient)"
  - "REST at /rest/ (RestApiClient)"
  - "Metadata at /metadata (MetadataApiClient)"
---

# Query Twenty Data Skill

## Overview
Query records from the NewLeaf Twenty workspace using GraphQL (preferred for complex queries) or REST (simple CRUD).

## Authentication
All requests require bearer token:
```bash
Authorization: Bearer YOUR_API_KEY
```
API key from Settings → API & Webhooks. Scoped to role.

## GraphQL Queries (Recommended)

### Single Record
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

### curl Example
```bash
curl -X POST http://localhost:3002/graphql \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { persons(first: 10) { edges { node { id firstName lastName email } } totalCount } }"
  }'
```

## REST Queries
```bash
# List all persons (paginated)
curl "http://localhost:3002/rest/person?limit=20&page=1" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Get single record
curl "http://localhost:3002/rest/person/person-uuid" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## TypeScript (CoreApiClient)
```ts
import { CoreApiClient } from 'twenty-client-sdk/core';

const client = new CoreApiClient();

const { person } = await client.query({
  person: {
    __args: { id: 'person-uuid' },
    id: true, firstName: true, email: true,
    creditScore: true,
    subscriptions: { id: true, amount: true, status: true },
  },
});
```

## Pagination
- GraphQL: `first` + `after` cursor
- REST: `limit` + `page` query params
- Limits: 100 req/min, 60 records per batch call

## Common Query Patterns
| Pattern | GraphQL | REST |
|---------|---------|------|
| Find by email | filter: { email: { eq: "..." } } | /rest/person?filter=email eq '...' |
| Recent records | orderBy: [{ createdAt: DESC }], first: 10 | /rest/person?sort=-createdAt&limit=10 |
| Count total | totalCount | Count header in response |
| Nested data | Include relation in query | /rest/person/id?include=subscriptions |

## Error Handling
| Error | Cause | Fix |
|-------|-------|-----|
| "Cannot query field X" | Field doesn't exist on object | Check schema via metadata query |
| 401 | Invalid/expired API key | Rotate key |
| 403 | Insufficient role permissions | Check role on API key |
| 429 | Rate limited | Wait, reduce query frequency |

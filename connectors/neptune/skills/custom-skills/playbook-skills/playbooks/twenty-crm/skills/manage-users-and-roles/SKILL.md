---
name: "manage-users-and-roles"
description: "Manage workspace members, define roles, assign permissions, and configure API keys in Twenty CRM"
version: "1.0.0"
domain: "twenty-crm"
repo_refs:
  - "/home/hermes/repos/twenty/packages/twenty-server/src/engine/core-modules/api-key/"
  - "/home/hermes/repos/twenty/packages/twenty-server/src/engine/core-modules/auth/"
  - "/home/hermes/repos/twenty/packages/twenty-server/src/engine/metadata-modules/role-metadata/"
  - "/home/hermes/cortex/research/twenty/features/roles-and-permissions.md"
api_refs:
  - "defineRole() — role definition with object/field/platform-level permissions"
  - "defineApplicationRole() — exactly one per app, thin wrapper around defineRole()"
  - "API keys at Settings → API & Webhooks"
---

# Manage Users and Roles Skill

## Overview
Manage workspace members, define custom roles with granular permissions, and configure API keys for programmatic access to the NewLeaf Twenty workspace.

## Production State
- **Server:** Port 3002 (twenty-newleaf-server)
- **Workspace:** "NewLeaf Financial" (cebc5a0a-e707-409e-bed6-4373a675704e)
- **Admin Role:** id `1751549b-3e08-431d-9d46-9c73c05d25ec`
- **Admin Users:** aswa0617@gmail.com, jerry.b.yirenkyi@gmail.com (both `canImpersonate=true`, `canAccessFullAdminPanel=true`)

## User Management

### Invite User (UI)
1. Settings → Members → Invite
2. Enter email
3. This adds a `workspaceMember` record
4. User logs in via `https://newleaf.crm.newleaf.financial`

### Manage via GraphQL
```graphql
# List workspace members
query {
  workspaceMembers {
    edges {
      node {
        id
        user { email firstName lastName }
        role { label }
      }
    }
  }
}

# Update member role
mutation {
  updateWorkspaceMember(id: "member-id", data: {
    roleId: "role-id"
  }) {
    id
  }
}

# Remove member
mutation {
  deleteWorkspaceMember(id: "member-id") { id }
}
```

### Manage via DB (Admin Only)
```bash
PGPASSWORD=77242982295764e06e103f5611b8b5c8 psql -h localhost -p 5434 -U twenty -d twenty -c \
  "SELECT u.email, wm.id FROM \"user\" u JOIN \"workspaceMember\" wm ON wm.\"userId\" = u.id;"
```

## Role Definition

### Permission Model (3 Layers)
1. **Object-level** — What objects can be read/written/deleted
2. **Field-level** — Which fields are visible/editable
3. **Platform-level** — System capabilities (admin panel, AI, apps, workflows)

### defineRole() API
```ts
import { defineRole, SystemPermissionFlag, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

defineRole({
  universalIdentifier: 'nl-dispute-specialist-role-0001',
  label: 'Dispute Specialist',
  description: 'Can manage credit disputes and view customer data',
  // Broad flags — START RESTRICTIVE
  canReadAllObjectRecords: false,
  canUpdateAllObjectRecords: false,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  canUpdateAllSettings: false,
  // Assignable to
  canBeAssignedToAgents: true,
  canBeAssignedToUsers: true,
  canBeAssignedToApiKeys: true,
  // Per-object permissions
  objectPermissions: [
    {
      objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
  ],
  // Per-field permissions
  fieldPermissions: [
    {
      objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
      fieldUniversalIdentifier: 'creditScore-field-uuid',
      canReadFieldValue: true,
      canUpdateFieldValue: true,
    },
  ],
  // Platform capabilities
  permissionFlagUniversalIdentifiers: [
    SystemPermissionFlag.AI,
  ],
});
```

### Permission Flags
Common flags: `APPLICATIONS`, `AI`, `WORKFLOW`, `WEBHOOK`.
Keep minimal — only include capabilities the role actually needs.

### Default Application Role
```ts
defineApplicationRole({
  // Exactly ONE per app
  // Thin wrapper around defineRole()
  // Scaffold starts permissive (canReadAllObjectRecords: true) — REPLACE for production
  // Logic functions + front components inherit this role's permissions
});
```

## NewLeaf Production Role Architecture
| Role | Object Access | Fields | Platform Flags | Assigned To |
|------|--------------|--------|----------------|-------------|
| **admin** | All R/W/D | All | Full admin, AI, workflows | Abhi, Jerry |
| **sales_agent** | Person/Company R/W, Lead R/W/D, Subscription R | Restricted PII | None | Sales team |
| **dispute_specialist** | CreditDispute R/W, Person R, DisputeRound R/W/D | Dispute-related | AI (credit analysis) | Dispute team |
| **readonly** | All R only | Non-sensitive | None | Auditors |
| **billing_system** | PaymentRecord R/W/D, Subscription R/W | Billing fields | Webhook receiver | HS/NMI integration |
| **api_integration** | Person R/W, PaymentRecord R/W/D | Integration fields | API key only | n8n, GHL connectors |

## API Key Management

### Create API Key (UI)
1. Settings → API & Webhooks → + Create API key
2. Set name, expiration (optional), select role
3. Copy key immediately — shown only once

### Create API Key (GraphQL)
```graphql
mutation {
  createApiKey(data: {
    name: "n8n-integration",
    expiresAt: "2027-06-20T00:00:00Z"
  }) {
    id token
  }
}
```
⚠️ `token` returned once — store in Base44 vault immediately.

### Revoke API Key
```graphql
mutation {
  updateApiKey(id: "key-id", data: { revokedAt: "2026-06-20T00:00:00Z" }) {
    id revokedAt
  }
}
```

### List Active API Keys
```graphql
query {
  apiKeys(filter: { revokedAt: { is: NULL } }) {
    edges { node { id name createdAt expiresAt } }
  }
}
```

## Worked Example: Create Dispute Specialist Role
```bash
# Option A: Via SDK defineRole() in your app
# Add to your app's define/ directory, then:
yarn twenty dev:build
yarn twenty app:publish --private --remote production

# Option B: Via admin panel
# Settings → Roles → + Create role → configure → save

# Option C: Via GraphQL (if role object exposed)
# Create role with explicit permission set
```

## Best Practices
1. **Start restrictive** — scaffold defaults are intentionally permissive for dev
2. **Be explicit** — fill `objectPermissions` and `fieldPermissions` arrays
3. **Minimize platform flags** — only include capabilities the role needs
4. **Separate concerns** — different roles for billing vs UI vs admin
5. **Rotate API keys** — set expiration dates, regenerate periodically
6. **Audit quarterly** — review who has access to what

## Error Handling
| Error | Cause | Fix |
|-------|-------|-----|
| 401 on API call | Invalid/expired API key | Rotate key in Settings |
| 403 Forbidden | Insufficient role permissions | Check role's objectPermissions + fieldPermissions |
| "User not found" | Email not invited to workspace | Invite via Settings → Members first |
| "Role not found" | Role ID doesn't exist | Verify role ID in Settings → Roles |
| Can't assign role to member | Member not in workspace? | Re-invite member |
| API key not shown again | Token returned once only | Revoke old key, create new one |
| Logic function 403 | App role too restrictive | Check default application role permissions |

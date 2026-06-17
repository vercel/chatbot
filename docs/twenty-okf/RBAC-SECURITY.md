---
type: spec
name: "RBAC + Security Layer for OKF/NKS"
description: "Access control enforcement for all knowledge artifacts — public, internal, restricted, customer levels"
version: "1.0.0"
updated: "2026-06-17"
priority: P0
access: restricted
---

# RBAC + Security Layer — Phase 37 Stream 4

## Access Levels

| Level | Value | Who Can Read | Example Files |
|-------|-------|-------------|---------------|
| Public | `public` | Anyone (including unauthenticated) | Spec docs, sample bundles |
| Internal | `internal` | NewLeaf staff (all authenticated non-customer users) | Playbooks, skills, connector docs |
| Restricted | `restricted` | Admins + super_admins only | Memory references, self_code skills, secrets |
| Customer | `customer` | Customer-facing (visible to end customers) | Public knowledge base, FAQ |

## Integration with Twenty CRM RBAC

| Twenty Role | NKS Access Levels Granted |
|------------|--------------------------|
| Admin | public + internal + restricted |
| Member (Sales/Support Agent) | public + internal |
| Guest | public only |
| API Key | As configured per key |

## Enforcement

```typescript
// lib/neptune-spec/rbac.ts
export function canAccessFile(fileAccess: NksAccess, userRole: string): boolean {
  if (fileAccess === "public") return true;
  if (fileAccess === "internal" && userRole !== "customer") return true;
  if (fileAccess === "restricted" && ["super_admin", "admin"].includes(userRole)) return true;
  if (fileAccess === "customer") return true;
  return false;
}

export function filterFilesByAccess(files: NksGraphNode[], userRole: string): NksGraphNode[] {
  return files.filter(f => canAccessFile(f.access, userRole));
}
```

## API Rate Limiting

- Reads: 100 req/min per session
- Writes: 10 req/min per session (skill-author only)
- Export: 1 req/min per session

## Audit Trail

All knowledge file modifications logged:
- Who: user/session ID
- What: file path + field changed
- When: timestamp
- Why: commit message or operation reason

Stored in `log.md` at each knowledge root level.

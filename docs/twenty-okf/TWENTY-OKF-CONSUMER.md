---
type: spec
name: "Twenty CRM as OKF Consumer"
description: "How Twenty CRM custom objects, workflows, and admin panels consume OKF-compatible knowledge bundles"
version: "1.0.0"
updated: "2026-06-17"
domain: customer-enrollment
priority: P0
access: internal
---

# Twenty CRM as OKF Consumer — Phase 37 Stream 0

## Overview

Twenty CRM custom objects, workflows, and admin panels consume NKS/OKF knowledge bundles to:
1. Display relevant playbooks and skills in the admin panel
2. Map CRM workflows to playbook steps
3. Expose CRM schema as OKF concepts
4. Use Code Nodes to read Neptune playbooks for business logic

## Twenty Object → OKF Concept Mapping

Each Twenty custom object directory contains OKF-compatible docs:

```
twenty-objects/
├── customers/
│   ├── index.md          # Object overview (OKF index)
│   ├── fields.md          # Each field as OKF concept
│   ├── relations.md       # Foreign keys, joins (OKF cross-links)
│   ├── workflows.md       # Linked workflows
│   └── permissions.md     # RBAC mapping
├── deals/
│   └── ...
├── tasks/
│   └── ...
└── companies/
    └── ...
```

### Object Schema (index.md)

```yaml
type: index
name: "Twenty Customer Object"
description: "Customer object schema with OKF concept mapping"
okf_concept: "core:customer"
twenty_object: "customer"
twenty_standard: false  # Custom object
rbac_level: "member"    # Minimum role to access
```

### Field Schema (fields.md)

Each field maps to an OKF concept:

```yaml
type: concept
name: "Customer Email"
description: "Primary email address for customer communications"
twenty_field: "email"
twenty_type: "EMAIL"
okf_concept: "customer:email"
required: true
searchable: true
```

### Relations (relations.md)

```yaml
type: concept
name: "Customer → Deals"
description: "One-to-many relationship between customers and deals"
twenty_relation: "customer.deals"
twenty_foreign_key: "deal.customerId"
okf_link: "../deals/index.md"
cardinality: "one-to-many"
```

## Twenty UI Integration

### Admin Panel — Knowledge Widget

The Twenty admin panel renders a "Knowledge" widget that:
1. Reads the current workspace's domain
2. Queries `/api/knowledge/files?domain=<current_domain>`
3. Displays relevant playbooks, skills, and connectors
4. Links to full knowledge explorer at `/knowledge`

```tsx
// In Twenty admin panel
const { data: skills } = useQuery({
  queryKey: ['knowledge', domain],
  queryFn: () => fetch(`/api/knowledge/files?domain=${domain}&type=playbook,skill`),
});

// Render skill cards in sidebar
{skills?.files.map(skill => (
  <SkillCard key={skill.path} skill={skill} />
))}
```

### Twenty Code Nodes → Playbook Integration

Twenty Code Nodes can READ Neptune playbooks for business logic:

```javascript
// Twenty Code Node: "Customer Enrichment"
const playbook = await fetch(`${NEPTUNE_API}/api/knowledge/file/playbooks/enrollment/playbook-enrollment.md`);
const playbookContent = await playbook.text();

// Parse playbook for business rules
const enrichmentSteps = extractSteps(playbookContent, "enrollment");
for (const step of enrichmentSteps) {
  await executeStep(step, customer);
}
```

## Permissions Mapping

| Twenty Role | NKS Access Level | Can Read |
|------------|-----------------|----------|
| Admin | All | public + internal + restricted |
| Member (Sales Agent) | internal | public + internal |
| Guest | public | public only |
| API Key | restricted | As configured |

## Integration Architecture

```
┌──────────────────────────────────────────────────┐
│  Twenty CRM                                       │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Objects  │  │Workflows │  │ Admin Panel   │  │
│  │ Schema → │  │  Steps → │  │ Knowledge     │  │
│  │ OKF      │  │ Playbook │  │ Widget → API  │  │
│  └──────────┘  └──────────┘  └───────┬───────┘  │
│                                       │           │
└───────────────────────────────────────┼───────────┘
                                        │
                              ┌─────────▼───────────┐
                              │  Neptune API Layer   │
                              │  /api/knowledge/*    │
                              │  (OKF-compatible)    │
                              └─────────┬───────────┘
                                        │
                              ┌─────────▼───────────┐
                              │  NKS Cortex          │
                              │  500+ files          │
                              │  Playbooks, skills,  │
                              │  connectors, memory  │
                              └──────────────────────┘
```

## Implementation Status

- ✅ Twenty object schema exposed as OKF concepts
- ✅ Permissions mapping (Twenty RBAC ↔ NKS access levels)
- ✅ Admin panel knowledge widget spec
- ✅ Code Node → Playbook integration pattern
- ⏳ Live Twenty API integration (depends on Twenty server access)
- ⏳ Real-time knowledge updates in Twenty UI

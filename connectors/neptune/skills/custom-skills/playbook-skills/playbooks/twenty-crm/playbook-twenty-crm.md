---
name: "Twenty CRM Playbook"
domain: "twenty-crm"
version: "1.0.0"
updated: "2026-06-20"
priority: "P0"
playbookFile: "playbook-twenty-crm.md"
---
# Twenty CRM — Master Playbook

## PRE-CHECK KNOWLEDGE (Read First)
- **What Twenty is:** Self-hosted open-source CRM (NestJS + React) for NewLeaf Financial
- **Where it lives:** VPS Docker, port 3002, at crm.newleaf.financial
- **Who uses it:** Abhi (admin), Jerry (admin), sales agents, dispute specialists
- **What it owns:** CRM data — Person, Subscription, PaymentRecord, CreditDispute, Enrollment records
- **What it does NOT own:** Payment processing (Hyperswitch), Card vaults (NMI), Marketing (GHL)
- **Reference docs:** /home/hermes/cortex/research/twenty/MASTER-DOSSIER.md + /home/hermes/cortex/research/twenty/features/
- **Repo:** /home/hermes/repos/twenty/ (commit 7eafbd91)

## When to Use Twenty (vs Base44 vs Hyperswitch)
| Task | Use | Reason |
|------|-----|--------|
| Create/update customer contact | Twenty | CRM owns contact data |
| Look up customer pipeline stage | Twenty | Pipeline lives in Twenty |
| Charge a card | Hyperswitch → NMI | Billing orchestration |
| Look up card on file | NMI vault (Base44) | NMI vault is source of truth |
| Create dispute record | Twenty | Custom CreditDispute object |
| Generate dispute letter | Logic Function in Twenty | Server-side automation |
| Send marketing SMS | GHL | Marketing platform |
| Notify team of issue | Slack #jarvis-admin | Team communication |
| Query customer 360 | Twenty (primary) + Base44 (billing) | Aggregated view |

## How to Login
- URL: https://newleaf.crm.newleaf.financial
- Admin: aswa0617@gmail.com (Abhi) or jerry.b.yirenkyi@gmail.com (Jerry)
- Password: available in Base44 vault (production credential)
- DB: postgresql://twenty:****@localhost:5434/twenty

## Standard Objects in NewLeaf Workspace
| Object | Purpose | Notes |
|--------|---------|-------|
| Person | Customer contacts | Extended with NewLeaf fields (creditScore, nmiVaultId, etc.) |
| Company | Organizations | Employers, creditors |
| Opportunity | Sales pipeline | Enrollment pipeline stages |
| Activity | Timeline entries | Notes, calls, emails |
| Note | Rich text notes | Agent notes on records |
| Task | To-do items | Follow-ups, reminders |

## Custom Objects (Spec'd — NOT Deployed)
| Object | Fields | Purpose |
|--------|--------|---------|
| PaymentRecord | 27 | Payment log from Hyperswitch/NMI |
| Subscription | 28 | Recurring billing tracking |
| CreditDispute | 14 | Bureau dispute tracking |
| Enrollment | 10 | Client enrollment lifecycle |
| RecoveryTask | 21 | Payment recovery operations |

## Integration Architecture
```
  Hyperswitch ──→ NMI Vault (card storage)
       │               │
       │ payment       │ card data
       ▼               ▼
  Twenty CRM ◄──── Base44 (billing engine)
       │
       │ contact/deal sync
       ▼
     GHL (marketing)
       │
       │ notifications
       ▼
    Slack #jarvis-admin
```

## Daily Operational Tasks

### Morning Routine (9am PT)
1. Check pipeline SLA breaches
2. Review overnight payment declines (PaymentRecord)
3. Check dispute response deadlines (<7 days)
4. Review new leads (Person records created overnight)
5. Generate daily KPI snapshot

### Weekly Routine (Monday)
1. Agent performance review
2. Dispute round progress per bureau
3. Billing health audit (declining subscriptions)
4. Pipeline bottleneck analysis

## API Access Patterns
```bash
# GraphQL
curl -X POST https://crm.newleaf.financial/graphql \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"query":"{ persons { edges { node { id firstName lastName email } } } }"}'

# REST
curl https://crm.newleaf.financial/rest/person \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Customization Workflow
1. Custom Object → defineObject() in app
2. Custom Field → defineField() on existing objects
3. Custom View → defineView() for record lists
4. Workflow → Visual builder for automations
5. Logic Function → defineLogicFunction() for server-side code
6. Front Component → defineFrontComponent() for custom UI
7. Publish → npx twenty app:publish

## Safeguards (LOCKED)
1. NEVER touch NMI vaults directly through Twenty — NMI vault is SOURCE OF TRUTH (mem 6a1f118b)
2. NEVER modify running Twenty Docker containers manually
3. NEVER use raw SQL on Twenty DB — always via API or SDK
4. NEVER store card numbers in Twenty — PCI compliance
5. NEVER store full SSN in Twenty fields (last 4 only)
6. ALWAYS verify HMAC signatures on inbound webhooks
7. ALWAYS backup DB before schema changes
8. Slack #jarvis-admin ONLY — NEVER #newleaf-admin (mem 6a28a284)

## Troubleshooting Matrix
| Issue | Check | Fix |
|-------|-------|-----|
| Can't log in | Docker stack health: `docker ps \| grep twenty` | Restart stack: `docker compose restart` |
| API returns 401 | API key validity in Settings → API & Webhooks | Rotate key, update env vars |
| Webhook not firing | Webhook URL + signature verification | Check delivery logs in Settings |
| Custom object not appearing | App installed? Published? | `yarn twenty app:publish` then reinstall |
| GraphQL query slow | N+1 query problem? | Use DataLoader, check `dataloaders/` |
| Logic function timeout | Function taking too long | Increase `timeoutSeconds`, optimize handler |
| Docker container unhealthy | Resource exhaustion | Check `docker stats`, increase RAM |

## Refinement Notes
Initial creation: 2026-06-20. Based on full repo ingestion + 14 doc pages + existing research.

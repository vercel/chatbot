# Migration Smoke Test — Phase 30

**Date:** 2026-06-17  
**Status:** Test plan documented — ready for execution against Twenty API

---

## Selected 5 Test Customers

| # | ID | Name | Category | Email | Status | Billing |
|---|-----|------|----------|-------|--------|---------|
| 1 | `69e8e2675b4e8c904998ea29` | Ocie Rodgers | Enrolled paused + payment history | ociekelmy31@gmail.com | Pending Signature | paused ($198/mo) |
| 2 | `69e7fe3ceac7fe0680a809c4` | Estella Drones Burnett | Enrolled paused + multi sequences | estelladrones49@gmail.com | Credit Pulled | paused |
| 3 | `69e790509c331f43606b6fb2` | Lorinda Yates | Paused + support ticket + frustration | shanewy74@gmail.com | Pending Signature | paused ($198/mo) |
| 4 | `6a2c65e58d7c7ec2b929603f` | Shane Smith | New (no enrollment) | smithshane823@gmail.com | New | no_payment_method |
| 5 | `6a2b1eb865f9218777f3eeb7` | Romila Dizon | New (fresh) | romiladizon@hotmail.com | New | no_payment_method |

## Field Mapping Verification

Each customer maps:
- CustomerProfile.id → Twenty Person.external_id
- firstName, lastName, email, phone → Person core fields
- billingStatus, paymentAmount, paymentFrequency → Subscription custom fields
- notes, agentEmail, conversationSentiment → Person custom fields
- NMI fields (cardNumber, cardExpiry) → **NOT transferred** (sacred)

## Dry-Run Command
```bash
pnpm tsx scripts/migrate-base44-batch.ts \
  --wave-size 5 \
  --customer-ids 69e8e2675b4e8c904998ea29,69e7fe3ceac7fe0680a809c4,69e790509c331f43606b6fb2,6a2c65e58d7c7ec2b929603f,6a2b1eb865f9218777f3eeb7 \
  --dry-run
```

## Acceptance Criteria

- [x] AC-1: 5 customers identified across diverse states (paused, new, with history)
- [ ] AC-2: Dry-run shows correct field mappings (execute with `--dry-run`)
- [ ] AC-3: Real migration completes successfully (execute without `--dry-run`)
- [ ] AC-4: All customers appear in Twenty admin UI (`crm.newleaf.financial`)
- [ ] AC-5: Idempotency — re-run produces no duplicates
- [ ] AC-6: Rate limiting works (5 records < 60 batch size)
- [ ] AC-7: Bidirectional sync tested (edit Twenty → Base44 updated)

## Notes
- No truly "active enrolled" customers found — most are in paused state
- No customers with active disputeStatus found — disputes are in not_started state
- Twenty API key needed for actual migration execution
- Migration script supports `--resume` for idempotent re-runs

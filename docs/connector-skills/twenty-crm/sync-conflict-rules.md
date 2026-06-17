# Twenty ↔ Base44 Sync Conflict Rules

**Date:** 2026-06-17  
**Phase:** 30  
**Status:** LOCKED — NMI sacred fields doctrine

---

## Field Ownership Matrix

| Category | Owner | Direction | Locked |
|----------|-------|-----------|--------|
| NMI vault + subscription IDs | Base44 | B→T only | YES — NMI is billing source of truth |
| Billing status + amounts | Base44 | B→T only | YES — Billing engine |
| Core identity (name, email, phone, address) | Either | Bidirectional LWW | Timestamp-based |
| CRM notes + conversations | Twenty | T→B preferred | Twenty is CRM of record |
| Workflow status (enrollment, journey) | Base44 | B→T only | Workflow engine |
| Dispute tracking | Base44 | B→T only | Dispute automation |

---

## Sacred NMI Fields (DO NOT OVERWRITE FROM TWENTY)

```
nmiSubscriptionId      nmiVaultId           nmiBillingId
nmiBillingIds          nmiDayZeroTransactionId
nmiDayZeroDate         nmiDayZeroIpAddress
nmiLastVerifiedAt      nmiLastVerifiedBillingId
nmiCardVerified        nmiCardSavedWithoutVerification
networkTokenStatus     networkTokenProvisionedAt
cardNumber             cardExpiry           cardCvv
cardholderName         cardholderFirstName
billingActionToken     billingActionTokenExpiresAt
subscriptionRetryCount consecutiveDeclineCount
lastDeclineCode        lastDeclineReason
lastRetryDate          nextRetryDate
pendingSubCancellation
```

---

## Billing Status Fields (Base44 Wins)

```
billingStatus          paymentAmount        paymentFrequency
nextPaymentDate        paymentMethod        paymentSourceType
paymentAuthStatus      subscriptionHealth
subscriptionEmailSent  subscriptionEmailSentAt
cancellationReason     cancellationDate
scheduledCancellationDate
retentionAttempted     retentionOffer       retentionOutcome
recoveryStatus         recoveryDate
recoveryAgent          recoveryNotes
```

---

## Sales/CRM Fields (Twenty Wins)

```
notes                  lastNote             agentEmail
processingAgentEmail   conversationSummary  conversationSentiment
aiMemory               aiMemoryUpdatedAt
aiReplyCount           lastAiReplyAt
engagementTier         emailEngagementScore
pipelineStage          campaignTags
processingPriority
```

---

## LWW Resolution Algorithm

1. If `incoming._sync_updated_at > existing._sync_updated_at` → apply change
2. If timestamps within 1s tolerance → Base44 wins for billing, Twenty wins for CRM
3. If `direction === "t2b"` AND field is sacred NMI → silently drop
4. If `direction === "b2t"` AND field is sales/CRM → skip (Twenty owns)

---

## Implementation

See `lib/sync/conflict-rules.ts` for the runtime enforcement code.

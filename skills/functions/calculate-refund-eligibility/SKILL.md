---
name: calculate-refund-eligibility
version: 1.0.0
kind: function
primary_domain: billing-flow
also_in: [agent-payments]
dependencies: [nmi-connector]
headline: |
  Determines if a transaction is eligible for refund based on settlement window,
  customer tier, amount thresholds, and dispute status.
type: "concept"
access: internal
---

# Calculate Refund Eligibility

## Signature
```typescript
function calculateRefundEligibility(params: {
  transactionId: string;
  amount: number;
  customerTier: string;
  daysSinceSettlement: number;
  hasActiveDispute: boolean;
}): { eligible: boolean; reason?: string; requiresApproval: boolean }
```

## Business Rules
- Auto-approve if amount < $200 and no active dispute
- Require manager approval if amount >= $200
- Cannot refund after 120 days from settlement
- Cannot refund if active dispute exists (use dispute resolution flow)

## Safeguards
- Verify settlement date from NMI before calculating window
- Check customer tier for auto-approval threshold override
- Log all eligibility checks for audit trail

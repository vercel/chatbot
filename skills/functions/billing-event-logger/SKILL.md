---
name: billing-event-logger
version: 1.0.0
kind: function
primary_domain: billing-flow
also_in: [reporting, compliance-audit]
dependencies: [base44-connector]
headline: |
  Structured billing event logger. Writes immutable audit trail for all payment events.
type: "concept"
access: internal
---

# Billing Event Logger

## Signature
```typescript
function billingEventLogger(event: {
  eventType: 'charge' | 'refund' | 'void' | 'subscription_create' | 'subscription_cancel' | 'decline';
  customerId: string;
  amount: number;
  transactionId: string;
  metadata: Record<string, unknown>;
}): Promise<{ eventId: string }>
```

## Business Rules
- All billing events are immutable once written
- Events link to CustomerProfile and PaymentLog in Base44
- Declines include decline code and retry recommendation

## Safeguards
- Never log full card numbers in metadata
- Include trace ID for cross-system correlation
- Rate limit: max 100 events/sec

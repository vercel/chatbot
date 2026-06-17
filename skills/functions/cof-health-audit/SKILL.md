---
name: cof-health-audit
version: 1.0.0
kind: function
primary_domain: billing-flow
also_in: [compliance-audit, reporting]
dependencies: [nmi-connector, base44-connector]
headline: |
  Card-on-File health audit: checks all stored cards for expiry, decline patterns, and CIT validity.
type: "audit"
access: internal
---

# COF Health Audit

## Signature
```typescript
function cofHealthAudit(params: {
  customerId?: string;
  daysThreshold?: number;
}): Promise<{
  totalCards: number;
  expiredCards: number;
  highDeclineCards: number;
  missingCitCards: number;
  recommendations: Array<{ cardId: string; action: string; reason: string }>;
}>
```

## Business Rules
- Flag cards expiring within 30 days
- Flag cards with >30% decline rate in last 90 days
- Flag MIT cards missing valid CIT reference

## Safeguards
- Run weekly minimum
- Auto-flag for billing ops review
- Never auto-cancel subscriptions from audit alone

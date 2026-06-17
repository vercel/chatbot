---
name: resolve-customer-identity
version: 1.0.0
kind: function
primary_domain: customer-enrollment
also_in: [support-triage, billing-flow]
dependencies: [base44-connector]
headline: |
  Resolves customer identity across systems using email, phone, or vault ID.
  Returns unified CustomerProfile with cross-system linkages.
type: "concept"
access: internal
---

# Resolve Customer Identity

## Signature
```typescript
function resolveCustomerIdentity(params: {
  identifier: string;
  identifierType: 'email' | 'phone' | 'vaultId' | 'customerId';
}): Promise<{
  customer: CustomerProfile | null;
  matches: CustomerProfile[];
  confidence: 'exact' | 'high' | 'medium' | 'low';
  linkedSystems: string[];
}>
```

## Business Rules
- Exact match on customerId or vaultId
- Email/phone may return multiple candidates — return all with confidence
- Cross-reference with NMI vault, GHL contacts, and Slack history

## Safeguards
- Never merge customer profiles without explicit approval
- Log all identity resolution attempts
- PII: redact full SSN, card numbers in logs

---
name: extract-customer-pii
version: 1.0.0
kind: function
primary_domain: compliance-audit
dependencies: []
headline: |
  Extracts and classifies PII from unstructured text for redaction and compliance.
type: "concept"
access: internal
---

# Extract Customer PII

## Signature
```typescript
function extractCustomerPii(text: string): Promise<{
  hasPii: boolean;
  findings: Array<{ type: 'ssn' | 'card' | 'dob' | 'email' | 'phone' | 'address'; value: string; redacted: string }>;
}>
```

## Safeguards
- Never log raw PII values
- Redact SSN to ***-**-XXXX, card to ****-XXXX, DOB to **/**/****

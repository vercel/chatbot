---
name: parse-fcra-credit-report
version: 1.0.0
kind: function
primary_domain: credit-disputes
dependencies: [forth-connector]
headline: |
  Parses FCRA-compliant credit reports into structured data for dispute generation.
type: "concept"
access: internal
---

# Parse FCRA Credit Report

## Signature
```typescript
function parseFcraCreditReport(report: Buffer): Promise<{
  bureaus: string[];
  accounts: Array<{ name: string; number: string; status: string; balance: number }>;
  inquiries: Array<{ date: string; company: string }>;
  publicRecords: Array<{ type: string; date: string }>;
  negativeItems: Array<{ account: string; reason: string; bureau: string }>;
}>
```

## Safeguards
- Encrypt parsed data at rest
- Never store full account numbers in logs
- FCRA: limit access to authorized dispute agents only

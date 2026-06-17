---
name: validate-action
version: 1.0.0
kind: function
primary_domain: compliance-audit
also_in: [billing-flow, credit-disputes, customer-enrollment]
dependencies: []
headline: |
  Pre-flight action validator. Checks action against playbook safeguards before execution.
type: "concept"
access: internal
---

# Validate Action

## Signature
```typescript
function validateAction(params: {
  action: string;
  domain: string;
  params: Record<string, unknown>;
  playbookSafeguards: Array<{ rule: string; check: () => boolean | Promise<boolean> }>;
}): Promise<{ valid: boolean; violations: string[]; warnings: string[] }>
```

## Business Rules
- All P0 domain actions must pass validation before execution
- Validation failures block execution, warnings allow with logging
- Cross-domain actions require validation from each domain's playbook

## Safeguards
- Never skip validation for P0 domains
- Log all validation results for audit

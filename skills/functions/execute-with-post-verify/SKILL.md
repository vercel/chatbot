---
name: execute-with-post-verify
version: 1.0.0
kind: function
primary_domain: compliance-audit
dependencies: [validate-action]
headline: |
  Executes an action with pre-validation and post-execution verification.
type: "concept"
access: internal
---

# Execute With Post-Verify

## Signature
```typescript
function executeWithPostVerify<T>(params: {
  action: string;
  domain: string;
  execute: () => Promise<T>;
  verify: (result: T) => Promise<boolean>;
  rollback?: (result: T) => Promise<void>;
}): Promise<{ success: boolean; result?: T; verification: boolean; rolledBack: boolean }>
```

## Safeguards
- Always verify after execution
- Rollback on failed verification if rollback provided
- Log all executions with trace ID

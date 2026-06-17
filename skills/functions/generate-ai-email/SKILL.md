---
name: generate-ai-email
version: 1.0.0
kind: function
primary_domain: customer-comms
also_in: [support-triage, billing-flow, credit-disputes]
dependencies: []
headline: |
  AI email generator. Creates context-aware emails using LLM with domain templates.
  All emails include unsubscribe link per CAN-SPAM.
type: "concept"
access: internal
---

# Generate AI Email

## Signature
```typescript
function generateAiEmail(params: {
  template: string;
  customerName: string;
  context: Record<string, unknown>;
  domain: string;
  tone?: 'formal' | 'friendly' | 'apologetic' | 'urgent';
}): Promise<{ subject: string; body: string; hasPii: boolean }>
```

## Business Rules
- Templates loaded from domain playbook email_templates/
- Tone matching: disputes=formal, support=friendly, billing=apologetic, compliance=urgent
- CAN-SPAM: all marketing emails include unsubscribe

## Safeguards
- Never include full SSN, card numbers, or DOB in email body
- Verify template exists before generation
- Log all generated emails for compliance audit

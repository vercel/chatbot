---
name: response-formatting
version: 1.0.0
kind: capability
primary_domain: support-triage
headline: |
  Techniques for shaping LLM output: artifact streaming, inline cards, split view, deploy receipts.
type: "skill"
access: internal
---

# Response Formatting Capability

## Techniques
1. **Artifact Pattern**: Stream structured content (code, tables, markdown) into collapsible artifact cards
2. **Inline Card Pattern**: Compact result cards for quick actions (deploy, PR status)
3. **Split View**: Side-by-side for code + explanation
4. **Deploy Receipt**: Durable chat receipt with live URL + Open button

## Anti-Patterns
- Never dump raw artifacts as chat text — use artifact cards
- Never lose deploy URLs — persist as receipts

## Safeguards
- Artifacts persist to HermesArtifactV3 for cross-reload durability
- Deploy receipts include deployment ID for traceability

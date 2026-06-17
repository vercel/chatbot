---
name: artifact-response-pattern
version: 1.0.0
kind: capability
primary_domain: coding
headline: |
  Pattern for streaming structured artifacts (code, tables, charts) in agent responses.
type: "skill"
---

# Artifact Response Pattern

## Technique
1. **Detect**: Identify structured content in agent output
2. **Extract**: Parse into typed artifact (code, table, chart, markdown)
3. **Stream**: Send as SSE events with artifact type + content
4. **Persist**: Write to HermesArtifactV3 for durability
5. **Render**: Client renders in appropriate component

## Anti-Patterns
- Never dump raw markdown/code as plain chat text
- Never lose artifact state on page reload

## Safeguards
- Artifacts versioned for audit trail
- Deploy receipts include live URL + deployment ID

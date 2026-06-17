---
name: playbook-refiner
version: 1.0.0
kind: capability
primary_domain: agent-orchestration
headline: |
  Playbook refinement technique. Analyzes session logs, identifies patterns, proposes playbook diffs.
type: "skill"
---

# Playbook Refiner Capability

## Technique
1. **Ingest**: Collect logs from all agent sessions (Jarvis, Hermes, Neptune)
2. **Detect**: Run 6 detectors (recurring errors, velocity anomalies, user corrections, cross-domain bleed, domain emergence, new surface IDs)
3. **Propose**: Generate playbook diff proposals with evidence
4. **Distill**: AI-reason over proposals to write specific safeguards

## Detectors
- recurring_errors: same error across 3+ sessions
- velocity_anomalies: tool calls spike/drop beyond 2σ
- user_corrections: "no", "wrong", "stop" patterns
- cross_domain_bleed: domain A tools called during domain B intent
- domain_emergence: new tool clusters suggesting new domain
- new_surface_ids: previously unseen API/tool patterns

## Safeguards
- Never auto-apply proposals without human review
- Each safeguard must cite specific incident(s) as justification

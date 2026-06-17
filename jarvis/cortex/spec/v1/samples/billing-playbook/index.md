---
type: index
name: "Billing Playbook Sample Bundle"
description: "Complete billing domain bundle showing NKS playbook, skills, connectors, workflows"
version: "1.0.0"
updated: "2026-06-17"
access: public
domain: billing-flow
---

# Billing Playbook — Sample NKS Bundle

Demonstrates a complete billing domain knowledge package:
- Playbook with intent routing and model preferences
- NMI connector skill with 15 tools
- Hyperswitch connector for payment routing
- Billing sweep workflow (cron-scheduled)
- Recovery campaign playbook
- Billing event logger function skill
- COF health audit skill

**Files in this bundle:**
- `playbook-billing.md` — Main billing playbook
- `connectors/nmi/SKILL.md` — NMI payment gateway skill
- `connectors/hyperswitch/SKILL.md` — Payment routing connector
- `workflows/billing-sweep.yaml` — Nightly billing sweep
- `skills/billing-event-logger.md` — Event logging skill
- `memory-nmi-vault.md` — Sacred NMI vault reference

**NKS Features Demonstrated:** playbook routing, skill definitions, connector specs, memory references, workflow orchestration

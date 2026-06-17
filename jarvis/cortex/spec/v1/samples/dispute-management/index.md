---
type: index
name: "Dispute Management Sample Bundle"
description: "Complete credit dispute domain with state machine, round tracking, compliance"
version: "1.0.0"
updated: "2026-06-17"
access: public
domain: credit-disputes
---

# Dispute Management — Sample NKS Bundle

Demonstrates a compliance-heavy domain with state machines:
- Dispute playbook with round tracking
- Dispute pipeline workflow
- Forth DPP connector for dispute processing
- Parse FCRA credit report skill
- Dispute round state machine
- Compliance audit trail

**Files in this bundle:**
- `playbook-disputes.md` — Dispute operations playbook
- `connectors/forth-dpp/SKILL.md` — Forth dispute processing
- `workflows/dispute-pipeline.yaml` — Multi-step dispute pipeline
- `skills/parse-fcra-credit-report.md` — FCRA report parser
- `mission-dispute-resolution.md` — Example mission with FSM

**NKS Features Demonstrated:** mission state machines, audit trails, compliance tracking, workflow orchestration

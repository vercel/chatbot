# Playbook Architecture Audit — Phase 24
Date: 2026-06-16

## Summary
- Total folders: 15
- Folders with playbook-*.md: 15/15 (100%)
- Folders with manifest.yaml: 15/15 (100%)
- Folders with patterns.md: 0/15 (0%)
- Folders with custom-knowledge.md: 0/15 (0%)
- Folders with telemetry.md: 0/15 (0%)
- Folders with examples/: 0/15 (0%)
- Manifests with description field: 11/15 (73%)
- Manifests fully valid (playbook + version + description + requires): 11/15

## Per-Folder Audit

### 1. agent-orchestration/
- **playbook-agent-orchestration.md**: PRESENT, lines: 242, sections: [PRE-CHECK KNOWLEDGE, Operational Knowledge, Business Context, Anti-Patterns, Safeguards, Routines, Custom Skills, Refinement Notes, Panel Orchestration]
- **manifest.yaml**: PRESENT, valid: YES, version: "1.0.0", connectors declared: [neptune, slack], skills: [ai-agent-sdk], functions: [dispatch-task, multi-agent-coordinate, failure-recover, agent-status], workflows: [agent-dispatch-pipeline]
- **patterns.md**: MISSING
- **custom-knowledge.md**: MISSING
- **telemetry.md**: MISSING
- **examples/**: MISSING

### 2. billing/
- **playbook-billing.md**: PRESENT, lines: 154, sections: [PRE-CHECK KNOWLEDGE, Operational Knowledge, Business Context, Anti-Patterns, Safeguards, Routines, Custom Skills, Refinement Notes]
- **manifest.yaml**: PRESENT, valid: NO (missing description field), version: "2.0.0", connectors declared: [nmi, hyperswitch, base44, slack], skills: [nmi-connector, base44-connector], functions: [charge-customer, refund-customer, vault-health-check, subscription-manage, decline-recovery], workflows: [payment-reminders, nmi-slack-reconciliation]
- **patterns.md**: MISSING
- **custom-knowledge.md**: MISSING
- **telemetry.md**: MISSING
- **examples/**: MISSING
- **VALIDATION ERROR**: manifest.yaml missing required `description` field

### 3. customer-support/
- **playbook-support.md**: PRESENT, lines: 145, sections: [PRE-CHECK KNOWLEDGE, Operational Knowledge, Business Context, Anti-Patterns, Safeguards, Routines, Custom Skills, Refinement Notes]
- **manifest.yaml**: PRESENT, valid: NO (missing description field), version: "2.0.0", connectors declared: [base44, slack, vapi], skills: [base44-connector, vapi-connector], functions: [customer-360, create-ticket, triage-ticket, resolve-ticket], workflows: [support-escalation]
- **patterns.md**: MISSING
- **custom-knowledge.md**: MISSING
- **telemetry.md**: MISSING
- **examples/**: MISSING
- **VALIDATION ERROR**: manifest.yaml missing required `description` field
- **NOTE**: playbook name in manifest is "support" but folder is "customer-support"

### 4. deploy/
- **playbook-deploy.md**: PRESENT, lines: 122, sections: [PRE-CHECK KNOWLEDGE, Operational Knowledge, Anti-Patterns, Safeguards, Routines, Custom Skills, Refinement Notes]
- **manifest.yaml**: PRESENT, valid: YES, version: "1.0.0", connectors declared: [github, vercel, slack], skills: [vercel-discipline], functions: [ship-feature, create-pr, rollback, diagnose-stale], workflows: [deploy-pipeline]
- **patterns.md**: MISSING
- **custom-knowledge.md**: MISSING
- **telemetry.md**: MISSING
- **examples/**: MISSING

### 5. disputes/
- **playbook-disputes.md**: PRESENT, lines: 115, sections: [PRE-CHECK KNOWLEDGE, Operational Knowledge, Business Context, Anti-Patterns, Safeguards, Routines, Custom Skills, Refinement Notes]
- **manifest.yaml**: PRESENT, valid: NO (missing description field), version: "2.0.0", connectors declared: [forth, base44, slack, affy], skills: [forth-connector], functions: [start-dispute, track-dispute, draft-letter, fcra-compliance-check], workflows: [dispute-round-tracker]
- **patterns.md**: MISSING
- **custom-knowledge.md**: MISSING
- **telemetry.md**: MISSING
- **examples/**: MISSING
- **VALIDATION ERROR**: manifest.yaml missing required `description` field

### 6. engineering/
- **playbook-engineering.md**: PRESENT, lines: 181, sections: [PRE-CHECK KNOWLEDGE, Operational Knowledge, Business Context, Anti-Patterns, Safeguards, Custom Skills, Connector: cat-facts, Routines, Refinement Notes]
- **manifest.yaml**: PRESENT, valid: YES, version: "1.0.0", connectors declared: [github, vercel, base44], skills: [ai-agent-sdk], functions: [code-review, refactor, debug, feature-build], workflows: [] (empty)
- **patterns.md**: MISSING
- **custom-knowledge.md**: MISSING
- **telemetry.md**: MISSING
- **examples/**: MISSING
- **NOTE**: Empty workflows array — intentional (code tasks are ad-hoc)

### 7. hr/
- **playbook-hr.md**: PRESENT, lines: 121, sections: [PRE-CHECK KNOWLEDGE, Operational Knowledge, Business Context, Anti-Patterns, Safeguards, Routines, Custom Skills, Refinement Notes]
- **manifest.yaml**: PRESENT, valid: YES, version: "1.0.0", connectors declared: [slack, linear], skills: [] (empty), functions: [team-status, onboarding, compliance-training], workflows: [team-status-check]
- **patterns.md**: MISSING
- **custom-knowledge.md**: MISSING
- **telemetry.md**: MISSING
- **examples/**: MISSING

### 8. marketing/
- **playbook-marketing.md**: PRESENT, lines: 142, sections: [PRE-CHECK KNOWLEDGE, Operational Knowledge, Business Context, Anti-Patterns, Safeguards, Routines, Custom Skills, Refinement Notes]
- **manifest.yaml**: PRESENT, valid: YES, version: "1.0.0", connectors declared: [ghl, slack, base44], skills: [] (empty), functions: [campaign-manage, lead-nurture, blast-send, dnc-check], workflows: [campaign-scheduler]
- **patterns.md**: MISSING
- **custom-knowledge.md**: MISSING
- **telemetry.md**: MISSING
- **examples/**: MISSING

### 9. other/
- **playbook-other.md**: PRESENT, lines: 79, sections: [Purpose, When This Playbook Applies, Fallback Intent Keywords, Orphan Connectors, Routing Logic, Sub-Folder Structure, Safeguards, Anti-Patterns]
- **manifest.yaml**: PRESENT, valid: YES, version: "1.0.0", connectors declared: [cat-facts, affy], skills: [] (empty), functions: [] (empty), workflows: [] (empty)
- **patterns.md**: MISSING
- **custom-knowledge.md**: MISSING
- **telemetry.md**: MISSING
- **examples/**: MISSING
- **sub-folders**: connectors/ (empty), functions/ (empty), skills/ (empty), workflows/ (empty) — ready for orphan capture
- **NOTE**: Organization is "shared" not "newleaf-financial" — intentional for orphan catcher

### 10. planning/
- **playbook-planning.md**: PRESENT, lines: 295, sections: [PRE-CHECK KNOWLEDGE, Operational Knowledge, Business Context, Anti-Patterns, Safeguards, Routines, Custom Skills, Workflows, Refinement Notes]
- **manifest.yaml**: PRESENT, valid: NO (missing description field), version: "2.0.0", connectors declared: [github, base44, wiki, slack, neptune], skills: [deep-research, draft-prd, draft-trd, draft-impl-plan, gap-analysis, architecture-diagrammer, cardinal-rules-extract, source-synthesis, mission-dispatcher, workflow-designer, save-to-cortex], functions: [write-prd, draft-trd, create-impl-plan, deep-research, gap-analysis, plan-mode, mission-dispatch, architecture-diagram], workflows: [deep-research, mission-dispatch, gap-analysis, plan-mode-propose, implementation-plan, master-prd, tech-design-doc]
- **patterns.md**: MISSING
- **custom-knowledge.md**: MISSING
- **telemetry.md**: MISSING
- **examples/**: MISSING
- **VALIDATION ERROR**: manifest.yaml missing required `description` field
- **NOTE**: Largest playbook by far (295 lines) — primary user domain. Most complex dependency graph.

### 11. reporting/
- **playbook-reporting.md**: PRESENT, lines: 159, sections: [PRE-CHECK KNOWLEDGE, Operational Knowledge, Business Context, Anti-Patterns, Safeguards, Routines, Custom Skills, Refinement Notes]
- **manifest.yaml**: PRESENT, valid: YES, version: "1.0.0", connectors declared: [base44, slack], skills: [spreadsheet-creator], functions: [reporting-hub-query, metrics-aggregate, morning-pulse], workflows: [morning-pulse-report]
- **patterns.md**: MISSING
- **custom-knowledge.md**: MISSING
- **telemetry.md**: MISSING
- **examples/**: MISSING

### 12. sales/
- **playbook-sales.md**: PRESENT, lines: 55, sections: [Domain Scope, Intent Routing, Connectors, Safeguards, Anti-Patterns]
- **manifest.yaml**: PRESENT, valid: YES, version: "1.0.0", connectors declared: [ghl, base44, slack], skills: [] (empty), functions: [pipeline-manage, lead-qualify, enrollment-track], workflows: [sales-pipeline-monitor]
- **patterns.md**: MISSING
- **custom-knowledge.md**: MISSING
- **telemetry.md**: MISSING
- **examples/**: MISSING
- **NOTE**: Minimal playbook (55 lines) — uses older section format (Domain Scope vs PRE-CHECK KNOWLEDGE)

### 13. vercel-discipline/
- **playbook-vercel-discipline.md**: PRESENT, lines: 153, sections: [PRE-CHECK KNOWLEDGE, Operational Knowledge, Business Context, Anti-Patterns, Safeguards, Routines, Custom Skills, Refinement Notes]
- **manifest.yaml**: PRESENT, valid: YES, version: "1.0.0", connectors declared: [vercel, github], skills: [] (empty), functions: [vercel-deploy, build-status, env-audit], workflows: [vercel-deploy-check]
- **patterns.md**: MISSING
- **custom-knowledge.md**: MISSING
- **telemetry.md**: MISSING
- **examples/**: MISSING

### 14. video-generation/
- **playbook-video-generation.md**: PRESENT, lines: 52, sections: [Domain Scope, Intent Routing, Connectors, Safeguards, Anti-Patterns]
- **manifest.yaml**: PRESENT, valid: YES, version: "1.0.0", connectors declared: [neptune], skills: [ai-agent-sdk], functions: [video-generate, video-edit, script-to-video], workflows: [video-generation-pipeline]
- **patterns.md**: MISSING
- **custom-knowledge.md**: MISSING
- **telemetry.md**: MISSING
- **examples/**: MISSING
- **NOTE**: Minimal playbook (52 lines) — uses older section format

### 15. vps-ops/
- **playbook-vps-ops.md**: PRESENT, lines: 158, sections: [PRE-CHECK KNOWLEDGE, Operational Knowledge, Business Context, Anti-Patterns, Safeguards, Routines, Custom Skills, Refinement Notes]
- **manifest.yaml**: PRESENT, valid: YES, version: "1.0.0", connectors declared: [neptune], skills: [] (empty), functions: [vps-health-check, incident-response, log-inspect, ssl-check], workflows: [vps-health-monitor]
- **patterns.md**: MISSING
- **custom-knowledge.md**: MISSING
- **telemetry.md**: MISSING
- **examples/**: MISSING

---

## Cross-Reference: Connector Usage

| Connector | Used By Playbooks |
|-----------|-------------------|
| slack | agent-orchestration, billing, customer-support, deploy, disputes, hr, marketing, planning, reporting, sales |
| base44 | billing, customer-support, disputes, engineering, marketing, planning, reporting, sales |
| neptune | agent-orchestration, planning, video-generation, vps-ops |
| github | deploy, engineering, planning, vercel-discipline |
| vercel | deploy, engineering, vercel-discipline |
| nmi | billing |
| hyperswitch | billing |
| ghl | marketing, sales |
| forth | disputes |
| affy | disputes, other |
| vapi | customer-support |
| linear | hr |
| cat-facts | other |
| wiki | planning |

## Cross-Reference: Skill Usage

| Skill | Used By Playbooks |
|-------|-------------------|
| ai-agent-sdk | agent-orchestration, engineering, video-generation |
| base44-connector | billing, customer-support |
| nmi-connector | billing |
| forth-connector | disputes |
| vapi-connector | customer-support |
| vercel-discipline | deploy |
| spreadsheet-creator | reporting |
| deep-research | planning |
| planning-research-suite (11 skills) | planning |

---

## Issues Found

### Critical (blocking)
1. **4 manifests missing `description` field**: billing, customer-support, disputes, planning — add a description field to each manifest.yaml
2. **0/15 folders have patterns.md**: Every playbook should have an always-check + anti-patterns quick reference
3. **0/15 folders have custom-knowledge.md**: Business-specific knowledge is embedded in playbook files but should be extractable for non-playbook use cases

### Warnings
4. **customer-support playbook name mismatch**: Folder is "customer-support" but manifest playbook name is "support"
5. **sales and video-generation use older section format**: Missing PRE-CHECK KNOWLEDGE section — should be updated to match canonical format
6. **engineering has empty workflows array**: Intentional but should be documented as explicit design choice
7. **planning dependency graph is largest**: 11 skills + 8 functions + 7 workflows — needs sub-playbook extraction analysis
8. **other folder sub-folders are empty**: connectors/, functions/, skills/, workflows/ exist but contain no orphan configs yet

---

## Recommendations
1. Add `description` to billing, customer-support, disputes, and planning manifests
2. Create `patterns.md` for all 15 folders (Task 1D covers billing, customer-support, disputes)
3. Create `custom-knowledge.md` for top 3 P0 playbooks (billing, customer-support, disputes) — Task 1D
4. Normalize playbook name in customer-support manifest from "support" to "customer-support"
5. Upgrade sales and video-generation to canonical U7.4 section format
6. Review planning playbook for potential sub-playbook decomposition
7. Populate other/ sub-folders with orphan connector/skill/function/workflow configs

---

*End of PLAYBOOK-AUDIT.md — Phase 24 Stream 1*

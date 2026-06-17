---
name: playbook-refiner
description: Audit agent tool-call logs and propose updates to connector PLAYBOOK.md files. Use when the user wants to refine, improve, audit, or update connector playbooks based on actual usage patterns. Also use when the user mentions failing tool calls, recurring errors, or agent mistakes.
version: 1.0.0
type: "skill"
---

# Playbook Refiner — Automated Playbook Improvement (Shared)

Audits agent tool-call logs against existing PLAYBOOK.md files and proposes diffs that capture newly observed patterns, recurring failures, and missing safeguards.

## When to Run

- Weekly cadence, automatic
- After any incident where an agent took an action it shouldn't have
- Whenever a new connector is added (to seed initial Refinement Notes)
- When a user reports that an agent keeps making the same mistake

## Technique

1. **Ingest**: Collect logs from all agent sessions
2. **Detect**: Run 6 detectors against session data
3. **Propose**: Generate playbook diff proposals with evidence
4. **Distill**: AI-reason over proposals to write specific safeguards

## Detectors

| Detector | Description |
|----------|-------------|
| `recurring_errors` | Same error across 3+ sessions |
| `velocity_anomalies` | Tool calls spike/drop beyond 2σ |
| `user_corrections` | User manually corrects agent output |
| `cross_domain_bleed` | Agent uses tools from wrong domain |
| `domain_emergence` | New frequently-used pattern not in playbook |
| `new_surface_ids` | New API endpoints or entities discovered |

## Output

Each refinement produces:
1. **Diff proposal** — Specific line additions/changes to PLAYBOOK.md
2. **Evidence** — Links to session logs showing the pattern
3. **Confidence** — HIGH/MEDIUM/LOW based on frequency and clarity
4. **Risk** — What breaks if we DON'T add this safeguard

## Safety

- Human-in-the-loop by default — never auto-edits playbooks
- Writes proposed diffs to disk for review
- Opens PR (or prints diff) for manual approval
- Cross-references existing playbook rules to avoid conflicts

## Shared Across Agents

This skill is shared across both Chat (neptune-chat) and V2 (neptune-v2) agents.
Both agents load it from `shared-skills/playbook-refiner/SKILL.md`.

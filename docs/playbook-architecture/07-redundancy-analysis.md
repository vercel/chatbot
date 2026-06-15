---
title: "07 — Redundancy Analysis"
version: "1.0.0"
last_updated: "2026-06-15"
owner: "playbook-skills meta-skill"
status: ACTIVE
kb_index: 7
redundancies_found: 5
severity: "low"
---

# 07 — Redundancy Analysis

Systematic analysis of duplicated or overlapping functionality.

## Redundancies Identified

### R1: PRD Writing (LOW SEVERITY)
- **Location A:** `playbook-planning.md` — "Write a PRD" intent (#26)
- **Location B:** `playbook-engineering.md` — "Write a PRD" intent (#35)
- **Resolution:** RESOLVED — Planning uses full 12-section PRD template; Engineering uses lightweight PRD. Different audiences.
- **Action:** Keep both, add cross-reference linking.

### R2: Deploy/Shipping (LOW SEVERITY)
- **Location A:** `playbook-deploy.md` — "Ship a feature" intent
- **Location B:** `playbook-vercel-discipline.md` — "Deploy to Vercel" intent
- **Resolution:** RESOLVED — deploy.md handles PR+merge flow; vercel-discipline.md handles Vercel-specific config/security.
- **Action:** Keep both, clarify boundary in playbook descriptions.

### R3: Model Selection (LOW SEVERITY)
- **Location A:** `lib/ai/model-router.ts` — Task-type-based model routing
- **Location B:** `lib/ai/playbook-model-router.ts` — Playbook-frontmatter-based model routing
- **Resolution:** RESOLVED — model-router handles general routing; playbook-model-router adds playbook-specific overrides. Complementary.
- **Action:** Document in KB, add import cross-reference.

### R4: Research/Investigation (LOW SEVERITY)
- **Location A:** `playbook-planning.md` — "Deep research" intent (#29)
- **Location B:** `playbook-engineering.md` — "Debug an issue" intent (#37)
- **Resolution:** RESOLVED — Planning research is exploratory (web, docs); Engineering debug is diagnostic (code, logs). Different tools.
- **Action:** Keep both with clear trigger differentiation.

### R5: Reporting/Metrics (LOW SEVERITY)
- **Location A:** `playbook-reporting.md` — Dedicated reporting playbook
- **Location B:** `playbook-marketing.md` — "Marketing analytics" intent (#61)
- **Resolution:** RESOLVED — Reporting is operational/agent metrics; Marketing analytics is campaign/lead metrics. Different data sources.
- **Action:** Cross-link, ensure no data source duplication.

## Summary

| Metric | Value |
|--------|-------|
| Total redundancies found | 5 |
| HIGH severity | 0 |
| MEDIUM severity | 0 |
| LOW severity | 5 |
| All resolved | ✅ Yes |
| Requires code change | 0 |

**Verdict:** The system is well-factored. All identified overlaps are complementary (different scope, different tools, different audiences) rather than true duplicates. No remediation needed.

---

*Phase 21 V3 — Fractal Library + Router-as-Map*

---
name: Planning & Research Playbook
description: PRD generation, technical specification, gap analysis, roadmap planning, and architecture decision workflows.
domain: planning
connectors: [github, mcp-hub, wiki]
version: "1.0"
updated: 2026-06-22
---

# Planning & Research Playbook

## Purpose
Generate PRDs, technical specifications, gap analyses, roadmaps, and architecture decisions for Neptune ecosystem projects.

## Safeguards
- PRDs must include success criteria and acceptance tests
- Architecture decisions require ADR format
- Gap analysis requires codebase evidence, not assumptions
- Roadmaps must include phase dependencies

## Routines

### Routine: PRD Generation
1. Gather requirements (user stories, constraints, success criteria)
2. Research existing implementations (codebase search, connector docs)
3. Define scope and out-of-scope items
4. Write PRD with phases, deliverables, acceptance criteria
5. Review with stakeholders
6. Publish to docs/prd/

### Routine: Gap Analysis
1. Define target state (what should exist)
2. Map current state (what exists in codebase)
3. Identify gaps with severity classification
4. Prioritize: critical → high → medium → low
5. Estimate effort for each gap
6. Generate GAP-ANALYSIS.md

### Routine: Architecture Decision
1. Define problem and constraints
2. Research alternatives (2+ approaches)
3. Evaluate trade-offs (performance, complexity, maintainability)
4. Select recommendation with rationale
5. Write ADR in docs/adr/
6. Share for review

### Routine: Roadmap Planning
1. Collect backlog items and PRDs
2. Group into milestones
3. Map dependencies between milestones
4. Estimate timeline per milestone
5. Generate ROADMAP.md with phase breakdown
6. Review and commit

## Workflows
- **prd-generate**: Full PRD generation from requirements
- **gap-analysis**: Codebase gap analysis with evidence
- **roadmap-create**: Structured roadmap from backlog

## Anti-Patterns
- Do NOT write PRDs without codebase evidence
- Do NOT skip success criteria in PRDs
- Do NOT plan without understanding dependencies

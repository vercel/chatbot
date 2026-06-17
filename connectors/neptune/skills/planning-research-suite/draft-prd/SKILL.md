---
name: draft-prd
version: 1.0.0
domain: planning-research
connector: neptune
scope: planning-research-suite
priority: P0
intent_tags:
  - write prd
  - create prd
  - product requirement
  - spec out
  - document requirements
  - feature spec
  - requirement doc
associated_skills:
  - deep-research
  - draft-trd
  - architecture-diagrammer
  - cardinal-rules-extract
  - save-to-cortex
headline: |
  12-section PRD template with research-backed content generation.
  Produces production-grade Product Requirements Documents with
  success criteria, risk assessment, and phased delivery plan.
type: "skill"
---

# Draft PRD — 12-Section Product Requirements Document

## Core Intent

Generate a complete, research-backed Product Requirements Document following
a strict 12-section template. Ensures every PRD is consistent, complete,
and aligned with cardinal rules before being persisted to jarvis/prd/.

## 12-Section Template

| # | Section | Description |
|---|---------|-------------|
| 1 | Executive Summary | 2-3 paragraph overview of the product/feature, its purpose, and expected impact |
| 2 | Problem Statement | Clear articulation of the problem being solved, with user pain points |
| 3 | Scope & Boundaries | What's in scope, what's explicitly out of scope, and why |
| 4 | User Personas & Stories | Primary and secondary user personas with key user stories |
| 5 | Functional Requirements | Detailed, numbered functional requirements (FR-001, FR-002, ...) |
| 6 | Non-Functional Requirements | Performance, security, reliability, accessibility requirements |
| 7 | Architecture Overview | High-level architecture with Mermaid C4 context diagram |
| 8 | Data Model | Key entities, relationships, and data flow |
| 9 | API Requirements | API endpoints, request/response contracts, authentication model |
| 10 | Success Criteria | Measurable, testable criteria for "done" (e.g., "95th percentile latency < 200ms") |
| 11 | Risks & Mitigations | Identified risks with probability, impact, and mitigation strategies |
| 12 | Timeline & Phases | Phased delivery plan with milestones and dependencies |

## Action Catalog

### Content Generation (6 actions)

| # | Action | Description |
|---|--------|-------------|
| 1 | `prd.generate_all` | Generate complete 12-section PRD from topic + research |
| 2 | `prd.generate_section` | Generate a single section by name |
| 3 | `prd.expand_requirements` | Expand high-level requirements into detailed FR-NNN format |
| 4 | `prd.generate_user_stories` | Generate user stories from personas |
| 5 | `prd.estimate_phases` | Generate phased timeline with milestones |
| 6 | `prd.assess_risks` | Generate risk matrix with mitigations |

### Validation (3 actions)

| 7 | `prd.validate` | Check all 12 sections present and non-empty |
| 8 | `prd.check_cardinals` | Validate against extracted cardinal rules |
| 9 | `prd.cross_reference` | Check for conflicts with existing PRDs in cortex |

### Output (2 actions)

| 10 | `prd.format` | Format as markdown with YAML frontmatter |
| 11 | `prd.save` | Save to jarvis/prd/ via save-to-cortex |

## Procedure

1. Load the deep-research skill and gather domain knowledge
2. Load the cardinal-rules-extract skill and pull applicable rules
3. Search cortex for existing PRDs on the same topic (avoid duplication)
4. Generate Section 1-3 (Executive Summary, Problem, Scope) as foundation
5. Generate Section 4-6 (Personas, FRs, NFRs) — the core requirements
6. Generate Section 7-9 (Architecture, Data, API) — technical foundation
7. Generate Section 10-12 (Success, Risks, Timeline) — delivery plan
8. Run prd.validate to ensure completeness
9. Run prd.check_cardinals to ensure no LOCKED rule violations
10. Format with YAML frontmatter (title, version, date, status, author)
11. Save to jarvis/prd/{title}-{date}.md via save-to-cortex
12. Annotate completion via annotation collector

## Anti-Patterns

- DON'T skip sections — all 12 sections are mandatory for completeness
- DON'T write a PRD without research — always run deep-research first
- DON'T create duplicate PRDs — check cortex for existing documents
- DON'T ignore cardinal rules — they are LOCKED constraints, not suggestions
- DON'T write vague success criteria — they must be measurable and testable
- DON'T save incomplete PRDs — validate before saving

## Related Workflows

- `playbooks/planning-research/workflows/master-prd.yaml` — full PRD pipeline

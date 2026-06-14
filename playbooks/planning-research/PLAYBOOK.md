---
playbook: planning-research
version: "2.0.0"
domain: planning-research
priority: P0
model_routing:
  default: "anthropic/claude-sonnet-4-6"
  reasoning_heavy: "anthropic/claude-opus-4-6"
  fast_iteration: "deepseek/deepseek-v4-flash"
  long_context: "google/gemini-2-pro"
  json_output: "deepseek/deepseek-v4-pro"
---

# Planning & Research — Master Playbook

> **Version:** 2.0.0 | **Date:** 2026-06-13 | **Status:** ACTIVE
> **Priority:** P0 (primary user-facing domain)
> **Architecture:** V5 Domain-Driven Skill Architecture
> **Playbook ID:** planning-research

---

## Executive Summary

The Planning & Research domain is the primary user-facing workflow in Neptune Chat. It handles strategic planning, technical research, PRD authoring, TRD authoring, implementation planning, gap analysis, plan-mode proposals, and mission dispatch. This is the first domain checked for any intent involving "plan," "research," "write a PRD," "design," "architecture," or "gap analysis."

## Operational Context

### Primary Use Case
Planning IS the core user workflow. Every conversation touches planning + research + PRD + TRD + impl-plan flow. Users arrive to plan, research, and produce structured planning documents that feed into engineering execution, agent orchestration, and deploy workflows.

### Domain Scope
Strategic planning, technical research, PRD authoring, TRD authoring, implementation planning, gap analysis, plan-mode approval, mission dispatch, parallel research synthesis, roadmap generation, architecture decision records, and spike explorations.

### Toolbox
The planning-research-suite provides 11 specialized skills for drafting PRDs, writing technical design documents, synthesizing research across up to 5 parallel sources, detecting gaps in existing artifacts, dispatching missions from PRDs, creating implementation plans, and managing the plan-mode proposal lifecycle.

### Workflows
Seven YAML workflow stubs define the execution order for common planning tasks: deep-research (multi-source with 30s-per-source timeout), gap-analysis (compare existing PRDs to desired state), implementation-plan (step-by-step breakdown from PRD), master-prd (full 12-section PRD template), mission-dispatch (PRD → sub-mission decomposition), plan-mode-propose (multi-phase task approval), and tech-design-doc (TRD architecture template).

### Fifteen Routines
The routines.json file maps trigger keywords to deterministic step sequences. Key routines include: draft-prd (12-section template), draft-trd (architecture decision format), gap-analysis (compare current to desired state), deep-research (parallel multi-source, 30s cap), implementation-plan (PRD → task breakdown), plan-mode-detect (≥3 phase auto-detection), parallel-synthesize (confidence-weighted merge), cardinal-rules-extract (LOCKED constraints from KG), mission-dispatch (decompose PRD into sub-missions), spike-exploration (timeboxed investigation), roadmap-generate (phase-based timeline), adr-author (Architecture Decision Record), context-collect (gather existing artifacts), findings-report (structured output from analysis), and dispatch-verify (check mission completeness).

## Standard Operating Procedure

### Router Match
1. Check user intent keywords against the PLAYBOOK-ROUTER map
2. If intent matches "plan," "research," "write PRD," "design," "architecture," "gap analysis," "roadmap," "ADR," "mission," or "spike," route to planning-research
3. Load this playbook via `load_skill("planning-research")`

### Pre-Execution Checklist
1. **Query KG first** — check `knowledge://planning/cardinal-rules` and `knowledge://planning/research-patterns` for existing constraints and recent lessons
2. **Search cortex** — look for existing PRDs, TRDs, or plans on the same topic before creating new ones
3. **Extract cardinal rules** — run cardinal-rules-extract to get LOCKED constraints that apply
4. **Check for plan-mode trigger** — if task has ≥3 phases, MUST enter plan-mode and get user approval before execution

### Routine Execution
1. Match user intent to the correct routine in routines.json
2. Execute steps in deterministic order
3. Respect [PARALLEL] markers for concurrent steps (e.g., multi-source research)
4. Apply 30s timeout per parallel research source
5. Use confidence-weighted synthesis for merging multiple research sources

### Post-Execution
1. **Persist artifacts** — all plans go to `jarvis/prd/`, all missions go to `jarvis/cortex/missions/`
2. **Annotate outcome** — record duration, errors, learnings via the annotation collector
3. **Update KG** — add new patterns and lessons learned to the knowledge graph

## Anti-Patterns (LOCKED)

- **NEVER improvise PRD/TRD structure** — use the 12-section template from the draft-prd skill
- **NEVER research from a single source** — parallel multi-source (minimum 2) is the default
- **NEVER execute multi-phase plans without plan-mode approval** — tasks with ≥3 phases MUST enter plan mode
- **NEVER lose plans** — ALWAYS persist to `jarvis/prd/` after creation
- **NEVER skip annotation** — every planning execution must be recorded
- **NEVER duplicate existing PRDs** — check cortex before creating new ones
- **NEVER bypass cardinal rules** — extract and apply cardinal rules BEFORE any plan execution
- **NEVER run deep research without timeout protection** — 30s per-source maximum
- **NEVER merge sources without confidence weighting** — synthesize() must rank by confidence + recency + relevance
- **NEVER skip the router** — always load this playbook via the PLAYBOOK-ROUTER intent match

## Safeguards

Before any planning execution:
1. **Check cortex first** — search for existing PRDs, TRDs, or plans on the same topic using fs_search
2. **Extract cardinal rules** — run cardinal-rules-extract to get LOCKED constraints from the KG
3. **Validate scope** — confirm the task scope matches the user's actual intent
4. **Plan-mode gate** — if ≥3 phases are detected, present a plan-mode proposal for user approval before executing
5. **Timeout protection** — all research calls must have 30s timeout wrappers
6. **Artifact persistence** — no plan is complete until it has been written to the jarvis filesystem

## Integration Points

### Knowledge Graph
- Query `knowledge://planning/cardinal-rules` for LOCKED constraints
- Query `knowledge://planning/research-patterns` for recent patterns
- Add new lessons learned via `knowledge://planning/lessons/{session-id}`
- Confidence=1.0 cardinal rules get TOP PRIORITY

### Cortex File System
- Read existing plans: `jarvis/prd/*.md`
- Read mission history: `jarvis/cortex/missions/*.md`
- Write new PRDs: `jarvis/prd/{topic}-prd-{date}.md`
- Write new missions: `jarvis/cortex/missions/{mission-name}-{date}.md`

### Annotation Loop
- Every planning execution records: outcome (success/failure/partial), duration in ms, errors encountered, cardinal rules applied, and learnings for KG extraction

## Research Pipeline

### Parallel Multi-Source Architecture
The deep-research routine fans out to up to 5 independent sources simultaneously using [PARALLEL] markers. Each source has a 30-second timeout wrapper. Results are merged via confidence-weighted synthesis that ranks findings by: source authority (primary docs > secondary blogs), recency (newer > older), specificity (exact match > tangential), and corroboration (found in 2+ sources > single source).

### Synthesis Algorithm
1. Collect all source outputs with metadata (source URL, timestamp, confidence score)
2. Group claims by topic cluster using keyword overlap detection
3. For each cluster, select the highest-confidence claim as the primary finding
4. Corroborating sources listed as supporting evidence
5. Contradictory findings flagged with both perspectives preserved
6. Gaps (questions raised by the user but not addressed by any source) listed separately

### Research Output Format
Every deep-research execution produces:
- **Summary** — 3-5 sentence synthesis of key findings
- **Findings** — bulleted list with source citations
- **Confidence scores** — per-finding confidence (0.0–1.0)
- **Source manifest** — all sources consulted with URLs and timestamps
- **Gaps** — questions not answered by the research
- **Recommendations** — suggested next actions based on findings

## Interaction Patterns

### Plan-Mode Protocol
When a task with ≥3 phases is detected:
1. Agent enters plan-mode and writes a proposal to the plan file
2. User reviews and approves the plan before any phase executes
3. Each phase completion updates the plan file with status
4. Plan-mode exit requires explicit user approval or all phases complete

### Mission Dispatch Protocol
When a PRD specifies sub-missions:
1. Decompose the PRD into discrete, independently-executable missions
2. Each mission gets a unique ID and a markdown file in `jarvis/cortex/missions/`
3. Missions link back to the parent PRD for provenance
4. Mission completion status tracked in the PRD's implementation plan section

### Spike Exploration Protocol
For timeboxed investigations:
1. Define a clear question or hypothesis to explore
2. Set a hard time limit (default: 15 minutes)
3. Explore the codebase, databases, and connectors to answer the question
4. Produce a concise findings report within the time limit
5. If more time is needed, propose a follow-up spike or full research session

## Metrics & Health

- **Research sources per query:** minimum 2, target 5
- **PRD completeness:** all 12 sections present
- **Plan-mode detection accuracy:** ≥3 phases → always detected
- **Annotation coverage:** 100% of executions recorded
- **Artifact persistence rate:** 100% of completed plans saved to jarvis FS
- **Cardinal rule compliance:** 0 violations of LOCKED rules
- **Synthesis confidence threshold:** findings below 0.4 confidence are flagged as low-confidence
- **Source freshness:** sources older than 90 days are flagged for the user
- **Mission completion rate:** percentage of dispatched missions that reach DONE status

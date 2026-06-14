# Planning & Research Domain Playbook

> **Model Routing:** default: `anthropic/claude-sonnet-4-6` | reasoning_heavy: `anthropic/claude-opus-4-5` | fast_iteration: `deepseek/deepseek-v4-pro` | cheap: `deepseek/deepseek-v3.2`


## 🧠 PRE-CHECK KNOWLEDGE (U7.4)

Before executing any routine in this domain, the agent MUST query the Knowledge Graph:

- `knowledge://planning/cardinal-rules`
- `knowledge://planning/research-patterns`

If the user query mentions a specific entity (customer, transaction, deploy, connector), also query that entity for context.

**Cardinal rules from the KG get TOP PRIORITY (confidence=1.0).**
If the KG returns conflicting information with this playbook, NOTE the conflict but FOLLOW the playbook — the U4.1 self-healing loop will resolve.
> **Version:** 1.0.0 | **Date:** 2026-06-13 | **Status:** ACTIVE
> **Priority:** P0 (primary user-facing domain)
> **Architecture:** V5 Domain-Driven Skill Architecture
> **Mission:** U5 Planning & Research Domain — closes 5 gaps from Neptune Chat runtime analysis

---

## Operational Knowledge

- **Primary use case:** Planning IS the core user workflow. Every conversation touches planning + research + PRD + TRD + impl-plan flow.
- **Domain scope:** Strategic planning, technical research, PRD authoring, TRD authoring, implementation planning, gap analysis, plan-mode approval, mission dispatch.
- **Toolbox:** 11 planning-research-suite skills under `connectors/neptune/skills/planning-research-suite/`.
- **Workflows:** 7 YAML workflow stubs under `playbooks/planning-research/workflows/`.
- **Routines:** 15 trigger-keyword → steps sequences in `routines.json`.
- **Artifact storage:** All plans persist to `jarvis/prd/`. All missions persist to `jarvis/cortex/missions/`.
- **Research engine:** Parallel multi-source (5 sources) with 30s timeout synth. Default mode: PARALLEL.
- **Plan mode:** Auto-detected for any task with ≥3 phases. User must approve proposal before execution.
- **Annotation:** All planning executions record outcome + learnings via annotation collector.

## Business Context

- Planning is THE primary use case — the user arrives to plan, research, and produce structured documents.
- Every conversation is planning+research+PRD+TRD+impl-plan+research by default.
- The planning-research domain is the FIRST domain checked when user intent involves "plan", "research", "write a PRD", "design", "architecture", "gap analysis".
- Plans feed into engineering execution, agent orchestration, and deploy workflows.
- Cardinal rules from save_memory and cortex are extracted and applied to every plan.

## Anti-Patterns (DO NOT DO)

- **DON'T improvise PRD/TRD structure** — use the 12-section template from draft-prd skill
- **DON'T research from a single source** — parallel multi-source (min 2) is the default
- **DON'T execute multi-phase plans without plan-mode approval** — tasks with ≥3 phases MUST enter plan mode
- **DON'T lose plans** — ALWAYS persist to jarvis/prd/ after creation
- **DON'T skip annotation** — every planning execution must be recorded
- **DON'T duplicate existing PRDs** — check cortex before creating new ones
- **DON'T bypass cardinal rules** — extract and apply cardinal rules BEFORE any plan execution
- **DON'T run deep research without timeout protection** — 30s per-source max
- **DON'T merge sources without confidence weighting** — synthesize() must rank by confidence + recency + relevance
- **DON'T skip the router** — always load this playbook via the PLAYBOOK-ROUTER intent match

## Safeguards

Before any planning execution:

1. **Check cortex first** — search for existing PRDs, TRDs, or plans on the same topic
2. **Extract cardinal rules** — run cardinal-rules-extract to get LOCKED constraints
3. **Validate scope** — ensure the plan fits within system capabilities (7 tools, 13 connectors, 369 actions)
4. **Set time budget** — every plan phase gets an explicit turn budget
5. **Check plan-mode eligibility** — if phases ≥ 3, route through plan-mode-propose workflow
6. **Verify source confidence** — for research outputs, confidence score must be ≥ 0.4
7. **Stage API keys** — if research requires external APIs, check/request keys via Vercel REST API

Before mission dispatch:

1. **Validate YAML workflow** — all steps must have defined actions and inputs
2. **Check dependency graph** — ensure no circular dependencies between steps
3. **Set success criteria** — every mission must have measurable completion conditions
4. **Assign annotation tracking** — mission ID must be traceable through the annotation loop

## Routines

### Routine: 'Write PRD'
Trigger words: 'write prd', 'create prd', 'product requirement', 'spec out', 'document requirements', 'prd for'

Mandatory steps:
1. Research existing artifacts: search cortex + wiki for related PRDs [PARALLEL]
2. Extract cardinal rules that apply to this domain
3. Load the draft-prd skill template (12 sections)
4. Conduct any necessary domain research via deep-research [PARALLEL if needed]
5. Draft the PRD following the 12-section template
6. Architecture-diagrammer: generate Mermaid diagrams if applicable
7. Save to jarvis/prd/ via save-to-cortex
8. Annotate outcome + word count + sections completed

### Routine: 'Draft Technical Design Document'
Trigger words: 'draft trd', 'write trd', 'technical design', 'architecture doc', 'design document', 'system design'

Mandatory steps:
1. Load the PRD this TRD implements (must exist first)
2. Extract cardinal rules for technical design
3. Load the draft-trd skill (Mermaid diagrams + API contracts)
4. Research existing patterns via deep-research [PARALLEL]
5. Map component relationships with Mermaid architecture diagrams
6. Define API contracts (endpoints, request/response schemas)
7. Define data models and database schema changes
8. Save to jarvis/prd/ via save-to-cortex
9. Annotate outcome

### Routine: 'Create Implementation Plan'
Trigger words: 'implementation plan', 'impl plan', 'build plan', 'execution plan', 'sprint plan', 'phase plan'

Mandatory steps:
1. Load PRD + TRD this plan implements
2. Extract cardinal rules + existing patterns
3. Load the draft-impl-plan skill (phases + budgets + dependency graph)
4. Break into phases with explicit turn budgets
5. Define dependency graph between phases
6. Set success criteria per phase
7. If phases ≥ 3: ENTER PLAN MODE (requires user approval)
8. Save to jarvis/prd/ via save-to-cortex
9. Annotate outcome

### Routine: 'Deep Research'
Trigger words: 'research', 'investigate', 'explore', 'compare', 'what is the state of', 'deep dive', 'learn about'

Mandatory steps:
1. Identify research question and scope
2. Fire parallel research engine (5 sources: tavilySearch, exaSearch, githubCodeSearch, webSearch, smitheryMcpSearch) [PARALLEL]
3. 30s per-source timeout, gracefully skip failed sources
4. Synthesize results: rank by confidence + recency + relevance
5. Produce structured output: {findings, sources, confidence, recommendations}
6. Cross-reference with cortex for existing knowledge
7. Save findings to jarvis/cortex/ if reusable
8. Annotate outcome + source count + confidence score

### Routine: 'Gap Analysis'
Trigger words: 'gap analysis', 'gap', 'what is missing', 'audit', 'compare current vs target', 'delta'

Mandatory steps:
1. Define current state (from cortex, codebase, or user input)
2. Define target state (from PRD, requirements, or user input)
3. Load the gap-analysis skill
4. Run systematic diff: features, capabilities, patterns, domains
5. Classify gaps: critical / high / medium / low
6. Generate remediation plan with effort estimates
7. Save to jarvis/prd/ via save-to-cortex
8. Annotate outcome + gap count + critical gaps

### Routine: 'Plan Mode (Multi-Phase Gate)'
Trigger words: 'plan mode', 'approve plan', 'review plan', 'multi-phase', 'complex task'

Mandatory steps:
1. Detect task has ≥3 phases (auto-detected or user-specified)
2. Load the plan-mode-propose workflow
3. Render plan-mode-proposal component in chat (Card + Approve/Modify/Cancel)
4. WAIT for user approval — do not proceed without explicit approval
5. On Approve: execute approved phases in order
6. On Modify: apply user modifications and re-propose
7. On Cancel: halt execution, document reason
8. Annotate outcome + approval status + phases executed

### Routine: 'Mission Dispatch'
Trigger words: 'dispatch mission', 'create mission', 'start mission', 'launch task', 'mission'

Mandatory steps:
1. Define mission scope, objectives, and success criteria
2. Load the mission-dispatcher skill
3. Generate cortex mission file (YAML format)
4. Create hybridDispatch wrapper for execution
5. Save mission file to jarvis/cortex/missions/
6. Dispatch via agent-orchestration domain if needed
7. Track mission progress via annotation loop
8. Annotate outcome + mission ID + dispatch status

### Routine: 'Architecture Diagram'
Trigger words: 'diagram', 'architecture diagram', 'flowchart', 'sequence diagram', 'mermaid', 'visualize'

Mandatory steps:
1. Identify the system or flow to diagram
2. Load the architecture-diagrammer skill
3. Determine appropriate diagram type (flowchart, sequence, class, ER, C4)
4. Generate Mermaid syntax from structural analysis
5. Validate diagram completeness (all nodes connected, all actors represented)
6. Embed in PRD/TRD if applicable
7. Annotate outcome + diagram type + node count

### Routine: 'Extract Cardinal Rules'
Trigger words: 'cardinal rules', 'locked rules', 'constraints', 'rules to follow', 'what rules apply'

Mandatory steps:
1. Load the cardinal-rules-extract skill
2. Pull rules from save_memory + cortex sources [PARALLEL]
3. Categorize by domain: billing, deploy, security, engineering, general
4. De-duplicate and rank by priority (P0 > P1 > P2)
5. Return structured list with rule IDs + source citations
6. Apply to the current planning context
7. Annotate outcome + rule count + domains covered

### Routine: 'Synthesize Sources'
Trigger words: 'synthesize', 'combine', 'merge', 'consolidate', 'summary of', 'bring together'

Mandatory steps:
1. Collect input sources (research outputs, PRDs, cortex entries)
2. Load the source-synthesis skill
3. Weight each source by confidence + recency + relevance
4. Merge overlapping findings, resolve contradictions
5. Generate unified synthesis with confidence-weighted recommendations
6. Save to jarvis/cortex/ if reusable
7. Annotate outcome + source count + synthesis length

### Routine: 'Design Workflow'
Trigger words: 'design workflow', 'create workflow', 'new workflow', 'workflow for', 'build workflow'

Mandatory steps:
1. Define workflow purpose and trigger conditions
2. Load the workflow-designer skill
3. Scaffold YAML structure: name, trigger, steps with [PARALLEL] markers
4. Define each step's action, input, description, and dependencies
5. Validate no circular dependencies
6. Save workflow YAML to playbooks/<domain>/workflows/
7. Link to routines.json if applicable
8. Annotate outcome + step count + domain

### Routine: 'Save to Cortex'
Trigger words: 'save this', 'persist', 'store', 'archive', 'keep this', 'remember this'

Mandatory steps:
1. Identify content type: PRD, TRD, research, plan, or general
2. Load the save-to-cortex skill
3. Determine target path: jarvis/prd/ for PRDs/TRDs/plans, jarvis/cortex/ for research/missions
4. Format with YAML frontmatter (title, date, version, status)
5. Write via VPS FS bridge
6. Verify write succeeded
7. Annotate outcome + path + file size

### Routine: 'Plan Review'
Trigger words: 'review plan', 'check plan', 'validate plan', 'plan quality', 'is this plan good'

Mandatory steps:
1. Load the plan to review from jarvis/prd/
2. Extract cardinal rules for plan validation
3. Check: completeness (all sections), consistency (no contradictions), feasibility (within constraints)
4. Cross-reference against existing PRDs for conflicts
5. Generate review report with findings + recommendations
6. Propose modifications if issues found
7. Annotate outcome + issues found + recommendations

### Routine: 'Full Planning Pipeline'
Trigger words: 'full plan', 'end to end plan', 'complete plan', 'plan everything', 'master plan'

Mandatory steps:
1. Research domain thoroughly via deep-research (5 parallel sources)
2. Draft PRD using draft-prd skill [depends on step 1]
3. Draft TRD using draft-trd skill [depends on step 2]
4. Create implementation plan using draft-impl-plan skill [depends on step 3]
5. Enter plan mode for approval (since phases ≥ 3)
6. On approval, dispatch mission phases
7. Save all artifacts to jarvis/prd/ [PARALLEL with step 6]
8. Full annotation of pipeline outcome + total artifacts + total duration

---

## Custom Skills (under connectors/neptune/skills/planning-research-suite/)

| Skill | File | Used For |
|-------|------|----------|
| `deep-research` | `deep-research/SKILL.md` | Parallel multi-source research with synthesis |
| `draft-prd` | `draft-prd/SKILL.md` | 12-section PRD template with success criteria |
| `draft-trd` | `draft-trd/SKILL.md` | Mermaid diagrams + API contracts + data models |
| `draft-impl-plan` | `draft-impl-plan/SKILL.md` | Phased plan with budgets + dependency graph |
| `gap-analysis` | `gap-analysis/SKILL.md` | Current vs target state diff with remediation |
| `cardinal-rules-extract` | `cardinal-rules-extract/SKILL.md` | Extract LOCKED rules from memory + cortex |
| `source-synthesis` | `source-synthesis/SKILL.md` | Weighted merge of multiple research sources |
| `workflow-designer` | `workflow-designer/SKILL.md` | YAML scaffolding for new workflow definitions |
| `mission-dispatcher` | `mission-dispatcher/SKILL.md` | Cortex file + hybridDispatch wrapper |
| `architecture-diagrammer` | `architecture-diagrammer/SKILL.md` | Mermaid diagram generation from structure |
| `save-to-cortex` | `save-to-cortex/SKILL.md` | Persist artifacts to jarvis/prd or jarvis/cortex |

## Workflows (under playbooks/planning-research/workflows/)

| Workflow | File | Purpose |
|----------|------|---------|
| Master PRD | `master-prd.yaml` | Full PRD pipeline: research → template → review → save |
| Tech Design Doc | `tech-design-doc.yaml` | TRD pipeline: PRD load → diagrams → API contracts → save |
| Implementation Plan | `implementation-plan.yaml` | Phase breakdown + dependency graph + budgets |
| Deep Research | `deep-research.yaml` | 5-source parallel → synthesize → save |
| Gap Analysis | `gap-analysis.yaml` | Current/target diff → classify → remediation plan |
| Mission Dispatch | `mission-dispatch.yaml` | Scope → YAML mission file → hybridDispatch → track |
| Plan Mode Propose | `plan-mode-propose.yaml` | Detect phases → propose → approve/modify/cancel |

---

## Refinement Notes

- 2026-06-13: Initial creation as U5 Phase 5.2. Created to fill the critical planning-research domain gap.
- 2026-06-13: Parallel multi-source research is the DEFAULT — never single-source.
- 2026-06-13: Plan mode required for tasks with ≥3 phases — auto-detected in chat workflow.
- 2026-06-13: All 11 skills follow Anthropic SKILL.md spec with YAML frontmatter.
- 2026-06-13: 7 workflows + 15 routines cover the full planning lifecycle.

---
name: workflow-designer
version: 1.0.0
domain: planning-research
connector: neptune
scope: planning-research-suite
priority: P2
intent_tags:
  - design workflow
  - create workflow
  - new workflow
  - workflow for
  - build workflow
  - define workflow
associated_skills:
  - mission-dispatcher
  - save-to-cortex
headline: |
  YAML scaffolding tool for creating new workflow definitions.
  Generates structured YAML files with phases, steps, dependencies,
  parallel markers, and success criteria for any domain.
type: "skill"
---

# Workflow Designer — YAML Scaffolding

## Core Intent

Generate well-structured YAML workflow definition files following the
canonical workflow format (used by mission-dispatcher and plan-mode).
Creates workflows with proper phase structure, step definitions,
dependency chains, parallel execution groups, and success criteria.

## Workflow YAML Canonical Format

```yaml
name: workflow-name
version: "1.0.0"
domain: target-domain
trigger_keywords: [list, of, triggers]
phases:
  - id: phase_id
    name: Human-readable phase name
    parallel: true/false
    depends_on: [phase_ids]
    condition: "optional condition expression"
    steps:
      - id: step_id
        action: action_name
        input: {key: value}
        description: What this step does
        timeout_ms: 30000
        graceful_fail: true
        depends_on: [step_ids]
        condition: "optional condition"
success_criteria: [list, of, measurable, outcomes]
budget:
  estimated_turns: 200
  max_duration_seconds: 180
output_schema: {optional schema definition}
```

## Action Catalog

### Scaffolding (4 actions)

| # | Action | Description |
|---|--------|-------------|
| 1 | `workflow.scaffold` | Generate blank workflow YAML template |
| 2 | `workflow.add_phase` | Add a new phase with steps |
| 3 | `workflow.add_step` | Add a step to an existing phase |
| 4 | `workflow.link_dependency` | Add dependency between phases or steps |

### Validation (3 actions)

| 5 | `workflow.validate` | Validate YAML structure and completeness |
| 6 | `workflow.check_cycles` | Detect circular dependencies |
| 7 | `workflow.check_completeness` | Verify all phases have steps, all deps resolved |

### Output (2 actions)

| 8 | `workflow.generate` | Generate complete YAML file |
| 9 | `workflow.save` | Save to playbooks/<domain>/workflows/ |

## Procedure

1. Define workflow purpose: what problem does it solve?
2. Define trigger keywords: what user intents trigger this workflow?
3. Scaffold blank template using `workflow.scaffold`
4. Add phases: break the workflow into coherent execution stages
5. Add steps to each phase: action, input, description, timeout
6. Add dependencies: which phases/blocks depend on others?
7. Add parallel groups: mark phases/steps that can run concurrently
8. Add conditions: optional conditions that gate phase/step execution
9. Define success criteria: measurable outcomes
10. Set budget: estimated turns and max duration
11. Validate: check structure, cycles, completeness
12. Save to playbooks/<domain>/workflows/<name>.yaml

## Best Practices

- **Name conventions**: lowercase, hyphens, descriptive (e.g., "customer-onboarding")
- **Phase granularity**: 3-7 phases is ideal; more than 10 is too granular
- **Step granularity**: 3-10 steps per phase
- **Dependencies**: always create a DAG (directed acyclic graph)
- **Parallel markers**: aggressively identify parallelizable work
- **Timeouts**: always set per-step timeouts; never rely on infinite waits
- **Conditions**: use conditions to make workflows flexible, not rigid
- **Success criteria**: must be measurable, testable, and unambiguous

## Anti-Patterns

- DON'T create workflows without trigger keywords — they'll never be invoked
- DON'T create circular dependencies — the graph must be acyclic
- DON'T leave steps without descriptions — future agents need context
- DON'T set unrealistic budgets — be honest about expected effort
- DON'T skip validation — a broken workflow wastes agent time

## Example: Simple Research Workflow

```yaml
name: quick-research-check
version: "1.0.0"
domain: planning-research
trigger_keywords: [quick check, fast lookup, brief research]
phases:
  - id: gather
    name: Gather Information
    parallel: true
    steps:
      - id: search_web
        action: web_search
        input: {query: "{query}", max_results: 5}
        description: Quick web search
        timeout_ms: 15000
      - id: check_cortex
        action: search_cortex
        input: {query: "{query}", limit: 3}
        description: Check existing knowledge
        timeout_ms: 10000
  - id: output
    name: Format Output
    depends_on: [gather]
    steps:
      - id: format
        action: format_quick_summary
        input: {web: "{search_web}", cortex: "{check_cortex}"}
        description: Combine results
success_criteria:
  - At least 1 source returned results
budget:
  estimated_turns: 30
  max_duration_seconds: 30
```

## Related Skills

- `mission-dispatcher` — dispatches workflows for execution
- `save-to-cortex` — persists generated workflows

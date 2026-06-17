---
name: mission-dispatcher
version: 1.0.0
domain: planning-research
connector: neptune
scope: planning-research-suite
priority: P1
intent_tags:
  - dispatch mission
  - create mission
  - start mission
  - launch task
  - mission
  - deploy mission
associated_skills:
  - draft-impl-plan
  - workflow-designer
  - save-to-cortex
associated_domains:
  - agent-orchestration
headline: |
  Mission dispatch engine: generates YAML mission files, creates hybridDispatch
  wrappers, saves to jarvis/cortex/missions/, and routes to agent-orchestration
  for execution if needed.
type: "skill"
access: internal
---

# Mission Dispatcher — Execute Planned Work

## Core Intent

Take a planned set of phases/steps (from draft-impl-plan or similar) and
dispatch them as an executable mission. Generates a structured YAML mission
file, wraps it in a hybridDispatch interface, persists to cortex, and
optionally routes to the agent-orchestration domain for distributed execution.

## Mission YAML Structure

```yaml
mission:
  id: mission_{timestamp}_{hash}
  name: Human-readable mission name
  status: pending
  priority: P0
  created: ISO timestamp
  estimated_turns: 500
  phases:
    - id: phase_1
      name: Phase name
      steps:
        - id: step_1
          action: action.name
          input: {params}
          description: What to do
          depends_on: []
      depends_on: []
  success_criteria: []
  tracking:
    annotation_id: null
    started_at: null
    completed_at: null
```

## Action Catalog

### Mission Creation (4 actions)

| # | Action | Description |
|---|--------|-------------|
| 1 | `mission.create` | Create a new mission from phase/steps definition |
| 2 | `mission.from_plan` | Create mission from implementation plan |
| 3 | `mission.from_workflow` | Create mission from workflow YAML |
| 4 | `mission.from_routine` | Create mission from routines.json entry |

### Dispatch (3 actions)

| 5 | `mission.dispatch_local` | Execute mission in current session |
| 6 | `mission.dispatch_hybrid` | Execute via hybridDispatch (supports paused/resumed) |
| 7 | `mission.dispatch_agent` | Route to agent-orchestration domain |

### Tracking (3 actions)

| 8 | `mission.status` | Check mission execution status |
| 9 | `mission.progress` | Get progress (completed/total steps) |
| 10 | `mission.cancel` | Cancel a running mission |

## Procedure

1. Receive plan with phases and steps (from draft-impl-plan, workflow, or direct input)
2. Generate unique mission ID: mission_{timestamp}_{hash}
3. Scaffold mission YAML structure with all phases and steps
4. Add dependency tracking: each step's `depends_on` is populated
5. Add success criteria from the plan
6. Set priority based on plan/domain (P0/P1/P2)
7. Save mission file to jarvis/cortex/missions/{name}-{date}.yaml
8. Determine dispatch mode: local (current session), hybrid (durable), or agent (distributed)
9. Execute dispatch
10. Register mission tracking in annotation loop
11. Optionally notify #jarvis-admin via Slack
12. Return mission ID for tracking

## Dispatch Modes

| Mode | Use Case | Characteristics |
|------|----------|----------------|
| `local` | Simple missions, < 200 turns | Runs in current agent session |
| `hybrid` | Medium missions, 200-800 turns | Durable, supports pause/resume, survives restarts |
| `agent` | Complex missions, 800+ turns | Routes to agent-orchestration for distributed execution |

## Dispatch Decision Matrix

```
Phase count <= 3 AND total budget < 200? → local
Phase count > 3 OR total budget >= 200? → hybrid
Total budget >= 800? → agent (distributed)
```

## Output Structure

```typescript
interface MissionDispatchOutput {
  mission_id: string;
  mission_name: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  dispatch_mode: "local" | "hybrid" | "agent";
  phases: Array<{
    id: string;
    name: string;
    step_count: number;
    status: string;
  }>;
  total_steps: number;
  estimated_turns: number;
  priority: string;
  file_path: string;
  tracking_id: string;
  dispatched_at: string;
}
```

## Anti-Patterns

- DON'T dispatch without a plan — missions need defined phases and steps
- DON'T dispatch to wrong mode — use the decision matrix
- DON'T skip saving the mission file — missions must be durable
- DON'T forget to register tracking — lost missions are invisible
- DON'T dispatch without success criteria — you can't measure success otherwise

## Related Skills

- `draft-impl-plan` — provides the phase/step structure
- `workflow-designer` — creates workflow YAMLs that missions execute
- `save-to-cortex` — persists mission files

## Related Domains

- `agent-orchestration` — distributed execution of large missions

---
playbook: HR
version: 1.0.0
domain: HR
scope: domain
model_routing:
  default: "deepseek/deepseek-v3.2"
  reasoning_heavy: "anthropic/claude-sonnet-4-6"
  fast_iteration: "deepseek/deepseek-v4-flash"
  cheap: "deepseek/deepseek-v3.2"
auto_load: false
headline: Team management, onboarding, compliance and personnel operations
priority: P2
scope_connectors:
  - slack-connector
  - base44-connector
triggers:
  - HR
  - onboarding
  - offboarding
  - employee
  - team
  - personnel
  - compliance training
workflows: []
description: "HR ops SOP — team management, employee onboarding/offboarding, compliance tracking. Routes to Slack and Base44 connectors."
intent_tags:
  - HR
  - team
  - personnel
  - onboarding
  - compliance
  - training
associated_connectors:
  - slack
  - wiki
associated_skills:
  - capabilities/research
associated_functions: []
routines_count: 2
type: "playbook"
---

# HR Domain Playbook


## 🧠 PRE-CHECK KNOWLEDGE (U7.4)

Before executing any routine in this domain, the agent MUST query the Knowledge Graph:

- `knowledge://hr/cardinal-rules`

If the user query mentions a specific entity (customer, transaction, deploy, connector), also query that entity for context.

**Cardinal rules from the KG get TOP PRIORITY (confidence=1.0).**
If the KG returns conflicting information with this playbook, NOTE the conflict but FOLLOW the playbook — the U4.1 self-healing loop will resolve.
## Operational Knowledge
- **Team Members:** Abhi (owner/operator), Jerry (key agent), Jennifer (billing-ops)
- **Agent Team:** Jarvis (primary orchestrator), Neptune Chat (frontend), Neptune V2 (code agent)
- **Slack Channels:** #jarvis-admin (internal ops), NEVER #newleaf-admin (cardinal 6a276f8c)
- **Repository:** All code in abhiswami2121/newleaf-financial GitHub org
- **Commit Identity:** abhiswami2121@gmail.com for all operations

## Business Context
- HR is a support domain — personnel records are not in Base44
- Team communication via Slack #jarvis-admin
- Agent capability documentation in CLAUDE.md and AGENTS.md
- Training done via playbook loading and skill execution
- Compliance tracking manual per NewLeaf policies

## Anti-Patterns (DO NOT DO)
- DON'T share personnel information in public channels
- DON'T post to #newleaf-admin — #jarvis-admin only
- DON'T assign tasks without checking agent workload
- DON'T skip onboarding playbook for new team members
- DON'T bypass approval chains for sensitive operations

## Safeguards
1. Personnel data stays in private channels
2. Agent task assignments tracked via jarvisTaskManager
3. Training completion verified through skill execution records
4. Role changes require owner approval (Abhi)
5. All team communications logged for audit

## Routines

### Routine: 'Agent Task Assignment'
Trigger words: 'assign task', 'delegate', 'who should handle',
              'task to', 'assign to agent'

Mandatory steps:
1. Classify task domain (billing, support, disputes, engineering, etc.)
2. Check agent availability: query jarvisTaskManager for active tasks
3. Match agent capability to task domain
4. Create task via jarvisTaskManager with priority + deadline
5. Notify agent via appropriate channel
6. Log assignment to activity feed

### Routine: 'Team Status Check'
Trigger words: 'team status', 'who is working on', 'agent workload',
              'team capacity', 'what are agents doing'

Mandatory steps:
1. Query jarvisTaskManager for all active tasks
2. Group by agent and status
3. Check for overloaded agents (>5 active tasks)
4. Check for stale tasks (>7 days without update)
5. Report team dashboard with capacity indicators
6. Suggest rebalancing if needed

## Custom Skills (under connectors/neptune)

### Functions
| Function | Path | Used For |
|----------|------|----------|
| `annotation-collector` | `connectors/neptune/functions/annotation-collector.ts` | Capture team/personnel operation outcomes for learning |
| `usage-telemetry` | `connectors/neptune/functions/usage-telemetry.ts` | Track HR function usage patterns |

## Refinement Notes
- 2026-06-11: Skeleton created during NEPTUNE-CLEAR-STRUCTURE CS1 migration.
- 2026-06-12: U2.4 enriched with routines and operational knowledge.
- 2026-06-12: Phase 8 — annotation-collector captures personnel operation outcomes for continuous refinement.

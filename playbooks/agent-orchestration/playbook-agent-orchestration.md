---
playbook: agent-orchestration
version: 1.0.0
domain: agent-orchestration
scope: domain
auto_load: true
headline: Agent routing, dispatch, multi-agent coordination and task delegation playbook
priority: P1
intent_tags:
  - orchestrate
  - dispatch
  - multi-agent
  - handoff
  - spawn
  - agent routing
associated_connectors:
  - base44
  - github
  - vercel
  - wiki
associated_skills:
  - capabilities/playbook-refiner
  - capabilities/code-review
  - connectors/github
  - connectors/vercel
associated_functions:
  - jarvis_task_create
  - jarvis_task_get_my_tasks
  - jarvis_task_complete
routines_count: 3
---

# Agent Orchestration Domain Playbook

## Operational Knowledge
- **Agent Team:** Jarvis (primary orchestrator), Neptune Chat (frontend agent), Neptune V2 (code agent)
- **Task Lifecycle:** classify intent → hydrate playbook → execute skill → self-heal
- **Handoff Protocol:** spawn_v2 for complex code tasks, self_code for small fixes (≤50 lines, ≤3 files)
- **Decision Defaults (LOCKED):** NO VPS Python edits, NO pm2 reloads, Vercel REST API only, commit author abhiswami2121@gmail.com
- **Dispatch Rules:** billing-flow(P0) > credit-disputes(P0) > customer-enrollment(P0) > compliance-audit(P0) > support-triage(P1) > agent-payments(P1) > reporting(P1) > customer-comms(P1) > lead-flow(P2) > mcp-edits(P2)

## Business Context
- **Orchestrator:** Jarvis routes intents to 10 domains per V5 Domain-Driven Architecture
- **Parallel Agent Dispatch:** base44 (65 actions), slack (27), nmi (41), hyperswitch (22), vapi (16) can fire concurrently
- **Session Safety:** NEVER cancel other agent sessions (cardinal 6a29d171)
- **Handoff Cadence:** Chat handles quick UI/copy fixes; V2 handles multi-file builds; Jarvis handles billing/ops
- **Workflow DevKit:** Self-healing cron at 02:57 UTC daily refines playbooks per real-world outcomes

## Anti-Patterns (DO NOT DO)
- DON'T dispatch to V2 for tasks under 50 lines or 3 files — use self_code
- DON'T dispatch to Chat for heavy code generation — use spawn_v2
- DON'T run two agents on the same git branch simultaneously
- DON'T skip verify step after V2 handoff — poll deployment status
- DON'T assume agent capabilities — check SKILL.md before dispatch
- DON'T cancel another agent's active session (cardinal 6a29d171)
- DON'T dispatch billing operations without loading billing playbook first
- DON'T handoff without passing customer context + operational playbook

## Safeguards
1. Before dispatch: classify intent to correct domain (check keyword → playbook mapping)
2. Before handoff to V2: verify task complexity (files >3 OR lines >50 OR new project)
3. Before self_code: verify changes are small and safe (files ≤3, lines ≤50)
4. After V2 dispatch: poll deployment status every 30s until READY or ERROR (max 8 min)
5. After self_code: run pnpm typecheck + pnpm build before pushing
6. If agent fails: log failure, attempt self-heal per playbook refinement rules
7. If V2 unreachable: retry once after 60s, surface graceful error to user
8. Never leave uncommitted changes on main branch

## Routines

### Routine: 'Dispatch Code Task'
Trigger words: 'build', 'create', 'add feature', 'implement', 'code this',
              'make a page', 'fix bug in codebase', 'refactor'

Mandatory steps:
1. Classify task: small (≤50 lines, ≤3 files) → self_code; large → spawn_v2
2. If self_code: load deploy playbook safeguards, verify branch is clean
3. If spawn_v2: prepare handoff payload (repo, task, relevant connectors, expected files)
4. Execute dispatch (self_code or spawn_v2)
5. After completion: verify build passes, deployment state is READY
6. Smoke test the affected URLs
7. If failure: read logs, attempt fix, re-dispatch
8. Post completion summary to #jarvis-admin

### Routine: 'Orchestrate Customer Operation'
Trigger words: 'look up customer', 'check customer', 'resolve customer',
              'handle customer', 'process customer'

Mandatory steps:
1. Load customer-support playbook (Customer 360 routine)
2. Identify required connectors (base44 + slack + nmi + ghl + vapi — all PARALLEL)
3. Dispatch parallel queries to all relevant connectors
4. Aggregate results into single Customer 360 card
5. If billing issue detected: load billing playbook
6. If dispute issue detected: load disputes playbook
7. Present unified findings with suggested actions

### Routine: 'Self-Heal After Agent Failure'
Trigger words: 'agent failed', 'dispatch error', 'handoff failed',
              'agent timeout', 'retry handoff'

Mandatory steps:
1. Identify failed agent and error type (timeout, build error, deploy error, internal)
2. If timeout: retry once with extended timeout
3. If build error: read build logs, identify root cause, fix and re-dispatch
4. If deploy error: read Vercel function logs, diagnose, apply fix
5. If agent unreachable: wait 60s, retry, if still fail → fallback to alternative agent
6. Log failure + recovery to rolling context
7. Update playbook refinement notes with learned pattern

## Refinement Notes
- 2026-06-11: V5 Domain-Driven Architecture established 10-domain routing with 4-step agent flow.
- 2026-06-11: U2.3 landed 169 total actions across 5 comprehensive connector packs.
- 2026-06-12: U2.4 adds relational graph connecting playbooks, connectors, skills, and functions.

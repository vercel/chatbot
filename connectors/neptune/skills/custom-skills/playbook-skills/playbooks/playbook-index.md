# Playbook Index

Auto-generated master index of all domain playbooks (U2.4 — Relational Graph + 4 Libraries).

**Last generated:** 2026-06-12 · **Total playbooks:** 11 · **Total routines:** 28

## Playbooks by Priority

### P0 (Critical)
| Domain | Path | Routines | Connectors | Description |
|--------|------|----------|------------|-------------|
| Billing | playbooks/billing/ | 4 | nmi, hyperswitch, base44, slack, ghl | Payment processing, refunds, CoF health audits, NMI/Hyperswitch billing flow |
| Customer Support | playbooks/customer-support/ | 2 | base44, slack, ghl, vapi, linear, nmi, hyperswitch | Customer 360, ticket triage, escalations, communications |
| Disputes | playbooks/disputes/ | 2 | forth, base44, slack | Credit disputes, FCRA letters, dispute rounds, evidence submission |

### P1 (High)
| Domain | Path | Routines | Connectors | Description |
|--------|------|----------|------------|-------------|
| Agent Orchestration | playbooks/agent-orchestration/ | 3 | base44, github, vercel, slack | Agent routing, dispatch, multi-agent coordination, task delegation |
| Deploy (Vercel + GitHub) | playbooks/deploy-vercel-github/ | 2 | github, vercel, slack | Vercel deployments, GitHub PR workflows, CI/CD automation |
| Engineering | playbooks/engineering/ | 3 | github, vercel, wiki | Code review, refactoring, PRDs, architecture decisions |
| Reporting | playbooks/reporting/ | 3 | base44, slack, wiki | Operational dashboards, morning pulse, analytics queries |
| Vercel Discipline | playbooks/vercel-discipline/ | 3 | vercel, github | Vercel deployment standards, security patterns, framework discipline |
| VPS Ops | playbooks/vps-ops/ | 3 | base44, slack | VPS management, pm2, nginx, Cloudflare, system health |

### P2 (Standard)
| Domain | Path | Routines | Connectors | Description |
|--------|------|----------|------------|-------------|
| HR | playbooks/HR/ | 2 | slack, wiki, base44 | Team management, onboarding, compliance, personnel |
| Marketing | playbooks/marketing/ | 2 | ghl, slack, vapi, base44 | Campaigns, lead nurture, content strategy |

## Root Playbook

| Domain | Path | Auto-Load | Description |
|--------|------|-----------|-------------|
| Root | playbooks/playbook-newleaf.md | Yes | NewLeaf Financial operations root — routes intents to domain playbooks |

## How to Use

Load a playbook via `load_skill`:
```
playbooks/billing          — Payment processing, refunds, CoF health audits
playbooks/disputes         — Credit disputes, FCRA letters, evidence submission
playbooks/customer-support — Customer 360, ticket triage, escalations
playbooks/agent-orchestration — Agent dispatch, multi-agent coordination
playbooks/deploy-vercel-github — Deploy, ship features, diagnose stale UI
playbooks/engineering      — Code review, architecture, PRDs
playbooks/reporting        — Morning pulse, metrics, sync health
playbooks/vercel-discipline — Vercel standards, env audit, rollback
playbooks/vps-ops          — VPS health, deploy changes, incident response
playbooks/HR               — Team tasks, agent assignments, status checks
playbooks/marketing        — Campaigns, lead flow, email blasts
```

## Routine Quick Reference

| Trigger Words | Routine | Playbook |
|--------------|---------|----------|
| refund, return money | Refund Customer | billing |
| decline, failed payment | Recover Decline | billing |
| pause, suspend | Pause Subscription | billing |
| new card, update payment | Update Card | billing |
| look up, who is, check on | Customer 360 Lookup | customer-support |
| fix ticket, resolve ticket | Resolve Support Ticket | customer-support |
| dispute, challenge, remove from credit | Start Dispute Round | disputes |
| dispute status, credit bureau response | Track Dispute Response | disputes |
| ship, deploy, land, merge, release | Ship a Feature | deploy-vercel-github |
| live UI doesn't match commits | Diagnose Stale UI | deploy-vercel-github |
| build, create, implement, code this | Dispatch Code Task | agent-orchestration |
| agent failed, dispatch error | Self-Heal After Agent Failure | agent-orchestration |
| review, code review, audit | Code Review | engineering |
| should we, which approach, architecture | Architectural Decision | engineering |
| write PRD, spec out, plan feature | Create PRD | engineering |
| morning pulse, daily report | Morning Pulse Report | reporting |
| how many customers, MRR | Customer Metrics Query | reporting |
| sync health, data freshness | Sync Health Audit | reporting |
| check deploy, is it live | Verify Deployment | vercel-discipline |
| rollback, revert deploy | Rollback Deployment | vercel-discipline |
| VPS health, server status | VPS Health Check | vps-ops |
| VPS down, server crashed | VPS Incident Response | vps-ops |
| assign task, delegate | Agent Task Assignment | HR |
| send campaign, email blast | Create Email Campaign | marketing |
| lead report, conversion | Lead Flow Analysis | marketing |

## Architecture

This index is part of the U2.4 Relational Graph (4-Dimensional Bidirectional DAG):
- **PLAYBOOKS** (intent layer): 11 domain playbooks with YAML frontmatter + structured routines
- **CONNECTORS** (capability layer): 13 API connectors with SKILL.md + client.ts
- **SKILLS** (internal capability clusters): 28 skills (13 connectors, 10 functions, 5 capabilities)
- **FUNCTIONS** (atomic execution registry): 169+ callable actions across all connectors

Each entity has a GRAPH-TAG.json with bidirectional links to all related entities.
See also: `playbooks/*/GRAPH-TAG.json`, `connectors/*/GRAPH-TAG.json`, `skills/*/GRAPH-TAG.json`

## Cross-Agent Shared Skills (U2.6)

Shared skills accessible from both neptune-chat AND neptune-v2 agents:

| Skill | Path | Description |
|-------|------|-------------|
| Skill Author | shared-skills/skill-author/SKILL.md | Autonomous skill creation — wrap APIs, create connectors, update playbooks |
| Deploy Discipline | shared-skills/deploy-discipline/SKILL.md | Canonical Vercel deploy patterns, pre-deploy checks, rollback |
| Code Review | shared-skills/code-review/SKILL.md | Cross-agent code review engine for PRs, diffs, commits |
| Playbook Refiner | shared-skills/playbook-refiner/SKILL.md | Audit agent logs, propose playbook improvements, close feedback loop |

API endpoint: `/api/shared-skills` returns inventory on both agents.
Both agents load shared-skills/ on startup. V2 also has 13 built-in skills from open-agents.
U2 Sprint complete: 11/11 phases. 169 actions, 15 connectors, 5/5 E2E tests. Next: U2.7 Knowledge Graph.

## Legacy Path

Previously these lived at `organizations/newleaf-financial/<domain>/`.
The `load_skill` tool still supports legacy paths as a fallback.

# Phases 38-43: Next Phase PRD Compendium — June 17, 2026

**Status:** PLANNED — Phase roadmap post-Eve alignment
**Budget:** All phases combined ~50,000t over 12 weeks
**Prerequisites:** Eve Pattern Adoption (PRD v1.0) complete

---

## PHASE 38: Autonomous Coding Platform (CURRENT)

**Status:** IN PROGRESS
**Budget:** 8,000t
**Timeline:** Week 1-2

### Key Deliverables
- [x] MissionRunner state machine (PROPOSED→PARSING→PLANNING→EXECUTING→DEPLOYING→VERIFYING→COMPLETE)
- [x] PRD parser (parsePrdToPlan, classifyStep, extractAcceptanceCriteria)
- [x] Mission draft + VPS enhance API (/api/missions/draft, /api/missions/[id]/enhance)
- [x] Plan review UI (/missions/[id]/plan-review — side-by-side comparison, AC checklist, approve/modify/reject)
- [x] OTel tracing wrapper (session/stream/step/tool/model/sandbox spans)
- [x] Vercel Connect OAuth connections (github, linear, nmi)
- [x] Sandbox adapter pattern (E2B/Vercel/Local backends)
- [x] Observability dashboard enhancements (missions, V2 sessions)
- [ ] V2 autonomous handoff: parse PRD → dispatch to V2 → watch → deploy → Slack land
- [ ] Slack landing auto-post with deploy URL + commit SHA + stats

### Eve Alignment
- ToolLoopAgent from ai@6.0.116 already in use
- defineAgent pattern in lib/v2/agent.ts
- defineSandbox pattern in lib/sandbox/adapter.ts
- Connections/ + Vercel Connect OAuth
- Schedules/ directory with V2 health, drift detection, KG reindex

---

## PHASE 39: V2 Enterprise Expansion

**Status:** PLANNED
**Budget:** 12,000t
**Timeline:** Week 3-5

### Overview
Expand Neptune V2 from a coding agent into a full enterprise platform agent. Add multi-tenant support, enterprise connectors, and team-aware workflows.

### Key Deliverables
1. **Multi-tenant V2 Sessions** — Isolated sandboxes per org, per team
2. **Enterprise Connectors** — Jira, Salesforce, ServiceNow, SAP
3. **Team-Aware Workflows** — V2 understands team structure, assigns tasks, tracks progress
4. **V2 Audit Trail** — Every V2 action logged to library_mission_event
5. **V2 API Rate Limiting** — Per-org, per-user rate limiting
6. **V2 Model Selection** — Auto-select best model per task (DeepSeek/Claude/GPT)
7. **V2 Cost Tracking** — Per-org, per-project cost accounting

### Eve Alignment
- Channels/ for enterprise connectors (Jira, Salesforce)
- Approval policies for sensitive operations
- Evals for V2 response quality

### Acceptance Criteria
- AC-39-1: Multi-org sandbox isolation (no cross-org data leak)
- AC-39-2: 3+ enterprise connectors functional
- AC-39-3: V2 audit trail complete (every action logged)
- AC-39-4: Cost tracking accurate to $0.01
- AC-39-5: Model selection improves cost/latency by 20%

---

## PHASE 40: Production Hardening

**Status:** PLANNED
**Budget:** 8,000t
**Timeline:** Week 5-7

### Overview
Production hardening for the entire platform. Focus on reliability, security, and observability for customer-facing operations.

### Key Deliverables
1. **Security Audit** — Penetration test all endpoints, OWASP Top 10
2. **Rate Limiting** — Global + per-endpoint rate limiting
3. **Circuit Breakers** — Fail gracefully when dependencies are down
4. **Comprehensive Error Handling** — Every API returns structured errors
5. **Performance Profiling** — Identify and fix bottlenecks
6. **Load Testing** — Simulate 100 concurrent agents
7. **Disaster Recovery** — Backup/restore for all databases
8. **Compliance** — SOC 2 readiness, GDPR data handling

### Eve Alignment
- OTel tracing on every endpoint (not just missions)
- Evals for security and performance
- Approval policies for destructive operations

### Acceptance Criteria
- AC-40-1: Zero critical/high findings on security audit
- AC-40-2: 100 concurrent agents without degradation
- AC-40-3: All endpoints return structured errors
- AC-40-4: Recovery time < 15 minutes from backup
- AC-40-5: P99 latency < 2000ms for agent calls

---

## PHASE 41: Open Source Prep

**Status:** PLANNED
**Budget:** 10,000t
**Timeline:** Week 7-9

### Overview
Prepare Neptune for open-source release. Position as "Eve-compatible agent platform with production capabilities."

### Key Deliverables
1. **License Selection** — Apache 2.0 (matching Eve) or BUSL
2. **Repository Cleanup** — Remove proprietary keys, customer data, secrets
3. **Documentation** — README, CONTRIBUTING, CODE_OF_CONDUCT, ARCHITECTURE.md
4. **Getting Started Guide** — `npx create-neptune-agent`
5. **Example Agents** — 5 reference implementations
6. **CI/CD Pipeline** — GitHub Actions for PRs, releases
7. **Community Infrastructure** — Discord, GitHub Discussions, Issue templates
8. **Eve Compatibility Layer** — `import { defineAgent } from "neptune/eve"` shim

### Eve Alignment
- Position as "Eve + Production" — consume Eve patterns, add our 10 differentiators
- Eve compatibility shim: `defineAgent`, `defineTool`, `defineSchedule`, `defineMcpClientConnection`
- OKF/NKS alignment documentation

### Acceptance Criteria
- AC-41-1: `npx create-neptune-agent` scaffolds working agent in < 2 min
- AC-41-2: 5 example agents pass CI
- AC-41-3: Eve compatibility shim exports all 6 adopted patterns
- AC-41-4: Documentation covers architecture, domains, playbooks
- AC-41-5: Zero secrets or customer data in public repo

---

## PHASE 42: Scale

**Status:** PLANNED
**Budget:** 8,000t
**Timeline:** Week 9-11

### Overview
Scale the platform to handle enterprise workloads. Focus on multi-region, high availability, and cost optimization.

### Key Deliverables
1. **Multi-Region Deploy** — Vercel Edge + VPS in EU/US/Asia
2. **Read Replicas** — PostgreSQL read replicas for dashboard queries
3. **Caching Layer** — Redis for KG queries, playbook hydration
4. **Queue System** — Bull/BullMQ for long-running missions
5. **Cost Optimization** — Spot instances for sandboxes, model caching
6. **Auto-Scaling** — Dynamic sandbox provisioning based on load
7. **Monitoring** — Prometheus + Grafana (or Vercel Observability)

### Eve Alignment
- OTel span export to multiple collectors
- Sandbox adapter for spot/preemptible instances

### Acceptance Criteria
- AC-42-1: 1000 concurrent agents globally
- AC-42-2: P99 latency < 1000ms for dashboard queries
- AC-42-3: Cost reduced by 30% vs baseline
- AC-42-4: Zero-downtime deploys
- AC-42-5: Auto-recovery from regional failures

---

## PHASE 43: Vision — AI Computer

**Status:** PLANNED
**Budget:** 12,000t
**Timeline:** Week 11-13

### Overview
The long-term vision: Neptune as an AI computer — a persistent, memory-aware, self-improving agent that operates your business 24/7.

### Key Deliverables
1. **Persistent Agent Memory** — Cross-session, cross-domain memory with embeddings
2. **Self-Improving Skills** — Agents auto-generate and refine their own skills
3. **Auto-Healing Infrastructure** — Agents detect and fix their own issues
4. **Business Context Engine** — Understands your entire business (CRM, billing, support)
5. **Proactive Intelligence** — Agents initiate actions, not just respond
6. **Natural Language OS** — "Hey Neptune, run the monthly billing audit"
7. **Multi-Agent Collaboration** — Swarms of agents coordinate on complex tasks
8. **Learning from Humans** — Agents learn from operator corrections

### Eve Alignment
- Define our OWN patterns beyond what Eve offers
- Contribute back to Eve: knowledge graph, memory system, playbook layer
- Lead the agent ecosystem with production-proven innovations

### Acceptance Criteria
- AC-43-1: Agent memory persists across sessions (recall past decisions)
- AC-43-2: Skills auto-generate from observed usage patterns
- AC-43-3: Self-healing resolves 80% of issues without human intervention
- AC-43-4: Natural language commands execute complex workflows
- AC-43-5: 3+ agents collaborate on a single task

---

## Strategic Timeline

```
Week 1-2   Phase 38: Autonomous Coding Platform (CURRENT) ████████░░
Week 3-5   Phase 39: V2 Enterprise Expansion              ░░░░░░░░░░
Week 5-7   Phase 40: Production Hardening                 ░░░░░░░░░░
Week 7-9   Phase 41: Open Source Prep                     ░░░░░░░░░░
Week 9-11  Phase 42: Scale                                ░░░░░░░░░░
Week 11-13 Phase 43: Vision — AI Computer                 ░░░░░░░░░░
```

## Budget Summary

| Phase | Tokens | Time | Risk |
|-------|--------|------|------|
| 38 | 8,000t | 2 weeks | LOW — mostly done |
| 39 | 12,000t | 3 weeks | MEDIUM — enterprise complexity |
| 40 | 8,000t | 2 weeks | HIGH — security critical |
| 41 | 10,000t | 3 weeks | MEDIUM — cleanup + docs |
| 42 | 8,000t | 2 weeks | MEDIUM — infra complexity |
| 43 | 12,000t | 3 weeks | HIGH — ambitious scope |
| **Total** | **58,000t** | **15 weeks** | |

## Eve Alignment — The Big Picture

Our strategy remains: **AUGMENT, don't compete.**

- **Adopt** Eve's cleaner patterns (Connections, Schedules, Approvals, Evals, OTel)
- **Keep** our 10 differentiators (KG, Memory, Playbook, Twin View, Skill-Author, Self-Code, Mission Tracking, Generative UI, Twenty CRM, NKS v1.0)
- **Contribute** back when we open source: knowledge graph, memory persistence, playbook-driven architecture
- **Position** as "Eve-compatible agent platform with production capabilities"

---

*Next-phase PRDs part of EVE ALIGNMENT + VALIDATION RECOVERY MASTER mission*
*Date: 2026-06-17*
*Author: abhiswami2121@gmail.com*

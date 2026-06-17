---
title: "06 — Cross-Reference Matrix"
version: "1.0.0"
last_updated: "2026-06-15"
owner: "playbook-skills meta-skill"
status: ACTIVE
kb_index: 6
type: "spec"
---

# 06 — Cross-Reference Matrix

Who-uses-what: complete dependency map between playbooks, connectors, skills, and functions.

## Playbook → Connector Dependencies

| Playbook | NMI | Slack | GitHub | Vercel | Base44 | GHL | Linear | Forth | Wiki | Vapi | Hyperswitch | Affy | MCP Hub | Neptune |
|----------|:---:|:-----:|:------:|:------:|:------:|:---:|:------:|:-----:|:----:|:----:|:-----------:|:----:|:-------:|:-------:|
| billing | ✅ | ✅ | | | ✅ | | | | | | ✅ | | | ✅ |
| support | | ✅ | | | ✅ | | | | | ✅ | | | | ✅ |
| disputes | | ✅ | | | ✅ | | | ✅ | | | | ✅ | | ✅ |
| planning | | ✅ | ✅ | | ✅ | | ✅ | | ✅ | | | | ✅ | ✅ |
| engineering | | ✅ | ✅ | | | | | | | | | | | ✅ |
| reporting | | ✅ | | | ✅ | | | | | | | | | ✅ |
| deploy | | ✅ | ✅ | ✅ | | | | | | | | | | ✅ |
| vercel-discipline | | | | ✅ | | | | | | | | | | ✅ |
| vps-ops | | ✅ | | | | | | | | | | | | ✅ |
| agent-orch | | ✅ | ✅ | ✅ | | | | | | | ✅ | | | ✅ |
| marketing | | ✅ | | | | ✅ | | | | | | | | ✅ |
| hr | | ✅ | | | ✅ | | | | | | | | | ✅ |
| sales | | ✅ | | | | ✅ | | | | | | | | ✅ |
| video-gen | | ✅ | | ✅ | | | | | | | | | | ✅ |

## Connector → Skill Dependencies

| Connector | Associated Skills | Functions Count |
|-----------|-------------------|----------------|
| NMI | nmi-connector (connector skill) | ~15 |
| Slack | slack-connector | ~10 |
| GitHub | github-connector | ~12 |
| Vercel | vercel-connector | ~8 |
| Base44 | base44-connector | ~25 |
| GHL | ghl-connector | ~8 |
| Linear | linear-connector | ~6 |
| Forth | forth-connector | ~8 |
| Wiki | wiki-connector | ~8 |
| Vapi | vapi-connector | ~6 |
| Hyperswitch | hyperswitch-connector | ~6 |
| Affy | affy-connector | ~4 |
| MCP Hub | mcp-hub-connector | ~6 |
| Neptune | 15 skills (planning-research-suite + custom) | 25+ |

## Skill → Function Count

| Skill | Functions | Location |
|-------|-----------|----------|
| ai-agent-sdk | 4 | `native-agent-skills/ai-agent-sdk/functions/` |
| playbook-skills | 6 | `custom-skills/playbook-skills/functions/` |
| opendesign | ~4 | `custom-skills/opendesign/functions/` |
| spreadsheet-creator | ~2 | `custom-skills/spreadsheet-creator/functions/` |
| planning-research-suite | ~11 | `skills/planning-research-suite/*/SKILL.md` |

## Function → Workflow Dependencies

| Function | Used By Workflows |
|----------|-------------------|
| route-intent | intent-routing.workflow.ts |
| session-start-handler | intent-routing.workflow.ts, chat route onStart |
| session-end-handler | session-end-logger.workflow.ts, chat route onFinish |
| create-playbook | bootstrap-new-org workflow |
| update-playbook | refinement-loop cron |
| organize-knowledge-graph | swarm dispatch cataloging |

## Model → Task Type Routing

| Model | Primary Task Types | Phase |
|-------|-------------------|-------|
| `deepseek/deepseek-v4-pro` | general, tool_heavy, reasoning, analysis | Default |
| `anthropic/claude-sonnet-4-6` | planning, creative | Phase 20 |
| `moonshotai/kimi-k2.7-code` | coding | Phase 20 |
| `zai/glm-5.1` | long_context | Phase 21 V3 |
| `alibaba/qwen-3-235b` | multilingual | Phase 20 |
| `deepseek/deepseek-v4-flash` | fast_chat | Phase 20 |

---

*Phase 21 V3 — Fractal Library + Router-as-Map*

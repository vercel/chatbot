---
name: Agent Orchestration Playbook
description: Master orchestration playbook for agent dispatch, swarm coordination, V2 handoff, and VPS coding sessions.
domain: agent-orchestration
connectors: [github, vercel, e2b, mcp-hub, open-agents]
version: "1.0"
updated: 2026-06-22
---

# Agent Orchestration Playbook

## Purpose
Orchestrate multi-agent systems, dispatch coding sessions, and manage parallel agent swarms.

## Safeguards
- Never dispatch swarm without explicit user approval
- Coding agents must use sandboxed environments
- Monitor cost estimates before multi-agent dispatch
- Max 8 agents per swarm

## Routines

### Routine: Dispatch Coding Agent
1. Validate goal clarity and mode (modify_existing | new_project | investigation)
2. Check token availability (GITHUB_TOKEN, VERCEL_TOKEN)
3. Call `spawnCodingAgent` with mode + goal
4. Monitor SSE stream at /api/agent-sessions/[id]/sse
5. Report completion with PR URL and deploy URL

### Routine: Run Parallel Swarm
1. Confirm swarm type (research | coding | audit | catalog | analysis)
2. Validate agent count (2-8) and model assignments
3. Call `swarmDispatch` with agents[] and synthesizer
4. Monitor swarm progress events
5. Present synthesis results to user

### Routine: Self-Code (Small Changes)
1. Validate change is <50 lines and <3 files
2. Call `selfCode` with the exact change description
3. Review diff in chat
4. Confirm or rollback

## Workflows
- **agent-handoff**: Full V2 coding agent handoff with PR + deploy
- **swarm-audit**: Parallel audit across multiple data sources
- **self-heal**: Automatic error detection and fix dispatch

## Anti-Patterns
- Do NOT use coding agents for read-only queries
- Do NOT dispatch swarms without preset enforcement
- Do NOT bypass sandbox for production database access

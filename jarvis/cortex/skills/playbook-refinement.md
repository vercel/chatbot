---
type: "playbook"
name: "Playbook Refinement"
description: "Auto-generated description for Playbook Refinement"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Playbook Refinement Skill

## Purpose
Audits connector tool usage logs and refines PLAYBOOK.md files via AI Gateway DeepSeek calls. Runs nightly to keep operational knowledge current with actual usage patterns.

## Trigger
- Cron: nightly at 3am UTC (off-peak)
- Manual: `bun run scripts/refine-playbooks.ts --connector=slack`
- On-demand: `bun run scripts/refine-playbooks.ts --all`

## Process

### 1. Audit Phase
- Query tool usage logs from the past 24 hours (Postgres `tool_calls` table or log aggregation)
- Extract patterns:
  - Error frequency per tool (what errors are users hitting?)
  - Tool call sequences (what patterns emerge? Slack→GitHub→Vercel?)
  - Underused tools (tools with < 5 calls in 24h — investigate why)
  - Rate limit hits (which APIs are being throttled?)
  - Authentication failures (which tokens/keys need rotation?)

### 2. Analysis Phase
For each connector with significant activity:
- Send audit data to AI Gateway DeepSeek with prompt:
  ```
  You are a PLAYBOOK.md refinement engine. Given tool usage patterns
  from the past 24 hours, suggest improvements to the connector's PLAYBOOK.md.
  
  Current PLAYBOOK.md: {currentContent}
  
  Usage Data:
  - Errors encountered: {errors}
  - Common patterns: {patterns}
  - Rate limit events: {rateLimits}
  
  Provide:
  1. New anti-patterns discovered
  2. Safeguard updates needed
  3. Common workflow additions
  4. Operational knowledge corrections
  ```

### 3. Refinement Phase
- Generate diff for each PLAYBOOK.md
- Only apply changes with confidence > 0.8
- Add Refinement Notes entry: `**2026-06-XX:** Automated refinement — {changes}`
- Never modify Anti-Patterns or Safeguards sections without human review flag
- Create PR with changes for human review

### 4. Notification Phase
- Slack #jarvis-admin with summary:
  - Connectors refined: N
  - New anti-patterns: N
  - Safeguard updates: N
  - Errors detected: N
  - Link to PR

## Configuration
- AI Gateway endpoint: `DEEPSEEK_GATEWAY_URL` env var
- AI Gateway API key: `DEEPSEEK_API_KEY` env var
- Tool usage source: `POSTGRES_URL` for querying tool_calls table
- Confidence threshold: 0.8 (configurable via `MIN_CONFIDENCE`)

## Safety Rules
1. NEVER remove existing anti-patterns — only add new ones
2. NEVER modify safeguards without human review flag
3. ALWAYS version the refinement in the notes section
4. NEVER include PII or credentials in the analysis
5. ALWAYS create a PR for review, never push directly to main

## Manual Invocation
```bash
# Refine all playbooks
bun run scripts/refine-playbooks.ts --all

# Refine a specific connector
bun run scripts/refine-playbooks.ts --connector=slack

# Dry run (analysis only, no changes)
bun run scripts/refine-playbooks.ts --dry-run

# Force refinement (skip confidence threshold)
bun run scripts/refine-playbooks.ts --all --force
```

## Cron Setup
```bash
# Add to crontab
# 0 3 * * * cd /home/neptune/neptune-chat && bun run scripts/refine-playbooks.ts --all >> logs/playbook-refinement.log 2>&1
```

## Dependencies
- AI Gateway access (DeepSeek model)
- Postgres connection (for tool usage data)
- GitHub API (for PR creation)
- Slack webhook (for notifications)
- File system write access to lib/connectors/*/\nPLAYBOOK.md

## Metrics Tracked
- Refinements applied per run
- Errors detected per connector
- Confidence scores per suggestion
- PR merge rate (are humans approving AI suggestions?)
- Time since last refinement per connector

---
name: Cross-Cutting Operations Playbook
description: General operations, system health, meta-tasks, and cross-domain procedures that don't fit a single domain.
domain: other
connectors: [base44, slack, mcp-hub]
version: "1.0"
updated: 2026-06-22
---

# Cross-Cutting Operations Playbook

## Purpose
Handle general system operations, health monitoring, meta-tasks, and cross-domain procedures.

## Safeguards
- Cross-domain operations require domain lead approval
- System health changes must be logged
- Meta-tasks should not block production workflows

## Routines

### Routine: System Health Check
1. Run self-diagnostic on all connectors
2. Verify PM2 processes (17/17 online)
3. Check API health endpoints
4. Monitor error rates and latency
5. Post health report to #jarvis-admin

### Routine: Configuration Audit
1. Pull all environment variables
2. Verify required secrets present
3. Check for deprecated or unused configs
4. Validate connector credentials
5. Generate config health report

### Routine: Knowledge Base Maintenance
1. Audit cortex skills for staleness
2. Update deprecated references
3. Run KG backfill for new content
4. Verify graphQuery returns accurate results
5. Clean up orphaned nodes

### Routine: Cross-Domain Task Routing
1. Classify incoming task domain
2. Check for cross-domain dependencies
3. Route to primary domain playbook
4. Track cross-domain task completion
5. Resolve domain conflicts

## Workflows
- **self-diagnostic**: Full system health check across all connectors
- **config-audit**: Configuration and secrets audit
- **kg-maintenance**: Knowledge graph cleanup and backfill

## Anti-Patterns
- Do NOT modify production config without change log
- Do NOT resolve cross-domain conflicts unilaterally

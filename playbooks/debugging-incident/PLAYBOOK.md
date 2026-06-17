---
playbook: debugging-incident
version: "1.0.0"
domain: debugging-incident
priority: P0
model_routing:
  default: "anthropic/claude-sonnet-4-6"
  reasoning_heavy: "anthropic/claude-opus-4-6"
  coding: "deepseek/deepseek-v4-pro"
  fast_iteration: "deepseek/deepseek-v4-flash"
type: "playbook"
---

# Debugging & Incident Response — Master Playbook

> **Version:** 1.0.0 | **Date:** 2026-06-13 | **Status:** ACTIVE
> **Priority:** P0 (system reliability)
> **Architecture:** V5 Domain-Driven Skill Architecture
> **Playbook ID:** debugging-incident

---

## Executive Summary

The Debugging & Incident Response domain handles systematic debugging of production issues, incident triage, root cause analysis, and post-mortem documentation. This playbook enforces the scientific method for debugging: hypothesis formation, evidence collection, systematic elimination, root cause identification, fix application, and post-mortem learning extraction.

## Operational Context

### Primary Use Case
When any system component exhibits unexpected behavior — production errors, build failures, API regressions, data anomalies, performance degradation, integration breakage, or security incidents — this playbook is invoked. The agent applies a structured debugging methodology rather than ad-hoc investigation.

### Domain Scope
Production incident triage, error log analysis, build failure diagnosis, API regression investigation, database anomaly detection, performance profiling, integration connector debugging, deployment failure analysis, security incident response, and post-mortem documentation.

### Investigation Framework
Every debugging session follows a 7-stage scientific method: (1) Symptom Capture — collect all error messages, stack traces, logs, and reproduction steps; (2) Context Assembly — gather relevant code, configs, deployment state, and recent changes; (3) Hypothesis Formation — enumerate at least 2 potential root causes with evidence for and against each; (4) Evidence Collection — query logs, databases, metrics, and monitoring dashboards; (5) Systematic Elimination — test each hypothesis against the evidence, eliminating disproven causes; (6) Root Cause Identification — declare the root cause only when it explains ALL symptoms; (7) Fix & Verify — apply the minimal fix, verify it resolves the issue, and document the resolution.

## Standard Operating Procedure

### Stage 1: Symptom Capture
1. Collect the exact error message, stack trace, and timestamp from the user or monitoring system
2. Identify the affected component: code path, database table, API endpoint, integration connector
3. Determine the blast radius: how many users affected, what functionality is broken, is it partial or total outage
4. Check for similar errors in recent logs or error tracking
5. Record the reproduction steps if available

### Stage 2: Context Assembly
1. Read the relevant source files at the error location (use viewFile or direct file reads)
2. Check git log for recent changes to the affected files (last 7 days)
3. Review deployment history — when was the last deploy, what changed
4. Check environmental state: environment variables, feature flags, database migrations
5. Query the Knowledge Graph for any known issues with the affected component

### Stage 3: Hypothesis Formation
1. Based on the symptoms and context, form at least 2 distinct hypotheses
2. For each hypothesis, list the predicted evidence that would confirm or refute it
3. Rank hypotheses by probability based on pattern matching against known issues
4. Document the hypotheses in structured format for post-mortem traceability

### Stage 4: Evidence Collection
1. Query relevant database tables for anomalous records
2. Search logs with temporal context around the incident timestamp
3. Check monitoring dashboards (Vercel Analytics, Sentry, custom telemetry)
4. Review integration connector status and recent response patterns
5. If the issue is reproducible, add targeted logging to capture state

### Stage 5: Systematic Elimination
1. Test the highest-probability hypothesis first
2. Look for definitive evidence that disproves each hypothesis
3. Do not skip hypotheses without positive evidence of elimination
4. Document which hypotheses were eliminated and why

### Stage 6: Root Cause Identification
1. Only declare root cause when it explains ALL observed symptoms
2. Validate with a test case or reproduction that confirms the causal chain
3. Identify the minimal change needed to fix the root cause
4. Determine if this is a systemic issue affecting other components

### Stage 7: Fix & Verify
1. Apply the minimal fix — do not refactor unrelated code
2. Run targeted tests or reproduction steps to confirm the fix works
3. If the fix requires a deploy, follow the deploy-vercel-github playbook
4. Monitor the fix in production for at least 15 minutes post-deploy
5. Document the incident in a post-mortem with root cause, fix, and prevention measures

## Anti-Patterns (LOCKED)

- **NEVER fix symptoms without finding the root cause** — patching error messages or suppressing exceptions masks problems
- **NEVER deploy a fix without reproduction or test verification** — untested fixes create new incidents
- **NEVER investigate without forming explicit hypotheses** — ad-hoc searching wastes time and misses root causes
- **NEVER trust a single-source diagnosis** — validate with at least two independent evidence sources
- **NEVER skip post-mortem documentation** — every incident must leave a traceable record
- **NEVER modify production data without explicit user approval** — database changes must be reviewed
- **NEVER blame without evidence** — correlation is not causation
- **NEVER ignore the temporal dimension** — check what changed recently before assuming long-standing code is broken

## Safeguards

1. **Read-only first** — all investigation starts with read-only operations; writes require explicit approval
2. **Minimal fix principle** — the fix should be the smallest change that resolves the root cause
3. **Verification gate** — no fix is complete without positive verification
4. **Post-mortem required** — every P0/P1 incident produces a post-mortem document in `jarvis/cortex/incidents/`
5. **Escalation path** — if the root cause cannot be identified within 2 investigation cycles, escalate to a broader team review
6. **Evidence chain** — maintain a traceable chain of evidence from symptom to root cause

## Integration Points

### Sensor (Sentry)
- Error tracking and stack trace capture
- Release health monitoring
- Issue grouping and deduplication

### Dashboard (Telemetry)
- Custom application metrics via OpenTelemetry
- Request latency, error rates, throughput
- Integration connector health checks

### Codebase Access
- Full read access to the neptune-chat repository
- Git log for change history and blame
- Build logs and deployment records via Vercel

### Knowledge Graph
- Query for known issues: `knowledge://debugging/known-issues`
- Query for component quirks: `knowledge://connectors/{connector-name}/quirks`
- Record new findings: `knowledge://debugging/incidents/{incident-id}`

### Slack
- Incident notification to `#jarvis-admin`
- Status updates during investigation
- Post-mortem summary after resolution

## Metrics & Health

- **Mean Time to Detect (MTTD):** time from incident start to detection
- **Mean Time to Resolve (MTTR):** time from detection to fix deployment
- **Hypothesis count:** minimum 2 per investigation
- **Evidence sources per investigation:** minimum 2 independent sources
- **Post-mortem completion rate:** 100% for P0/P1 incidents
- **Fix-first-time rate:** percentage of fixes that resolve the issue without regression
- **Recurrence rate:** percentage of incidents that are repeats of previously resolved issues

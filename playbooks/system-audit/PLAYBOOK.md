---
playbook: system-audit
version: "1.0.0"
domain: system-audit
priority: P1
model_routing:
  default: "anthropic/claude-sonnet-4-6"
  reasoning_heavy: "anthropic/claude-sonnet-4-6"
  fast_iteration: "deepseek/deepseek-v4-flash"
  long_context: "google/gemini-2-pro"
---

# System Audit — Master Playbook

> **Version:** 1.0.0 | **Date:** 2026-06-13 | **Status:** ACTIVE
> **Priority:** P1 (system health)
> **Architecture:** V5 Domain-Driven Skill Architecture
> **Playbook ID:** system-audit

---

## Executive Summary

The System Audit domain provides a comprehensive framework for auditing system health, configuration consistency, security posture, data integrity, deployment state, and compliance with operational standards. Audits produce structured findings with severity ratings and actionable remediation recommendations, prioritizing issues that threaten system reliability or security.

## Operational Context

### Primary Use Case
When the user asks to audit the system, check health, verify configuration, validate data integrity, review security posture, or assess operational readiness, this playbook provides the audit methodology. Audits span the full stack: infrastructure, application code, database, integrations, deployments, and operational procedures.

### Domain Scope
Configuration audit, security posture review, database integrity check, deployment health assessment, integration connector verification, environment variable audit, dependency vulnerability scan, operational procedure compliance check, performance baseline comparison, and system-wide health scoring.

### Audit Dimensions (8-Pillar Framework)
1. **Configuration** — Environment variables, feature flags, build settings, runtime configs
2. **Security** — Auth mechanisms, secret management, API token rotation, CORS policies, rate limiting
3. **Database** — Schema consistency, index health, migration state, data integrity, backup status
4. **Deployments** — Active deployment status, build health, rollback readiness, environment parity
5. **Integrations** — Connector health, API key validity, rate limit headroom, error rates
6. **Code Quality** — Build health, test coverage trends, type safety, lint compliance
7. **Operations** — Monitoring coverage, alert configuration, incident response readiness, runbook currency
8. **Compliance** — Data retention policies, access control review, audit trail completeness

### Severity Classification
- **critical** — Active security vulnerability, data corruption, production outage risk, secrets exposed
- **high** — Configuration drift, stale dependencies with known CVEs, missing backups, degraded monitoring
- **medium** — Code quality regression, outdated documentation, non-critical dependency updates available
- **low** — Cosmetic issues, optional optimizations, documentation improvements
- **info** — Observations, trends, suggestions for future consideration

## Standard Operating Procedure

### Stage 1: Scope Definition
1. Determine audit scope: full system or specific dimension(s)
2. Set depth level: quick health check (surface scan), standard audit (all pillars, medium depth), or deep audit (exhaustive verification)
3. Identify the time window for trend analysis (default: last 7 days)
4. Define the output format: structured FINDINGS report, dashboard update, Slack notification

### Stage 2: Dimension-by-Dimension Collection
1. **Configuration Audit** — Read all .env files, vercel.json, next.config.ts, and deployment configs. Check for missing required variables, inconsistent values across environments, deprecated settings, and hardcoded values that should be configurable.
2. **Security Audit** — Verify auth middleware coverage on all routes, check token expiration and rotation policies, audit CORS and CSP headers, scan for exposed secrets in code or config files, verify rate limiting is active on all public endpoints, check dependency versions against known CVEs.
3. **Database Audit** — Verify schema.ts matches actual database state, check for unapplied migrations, validate index usage on slow queries, verify backup schedule and retention, check for orphaned records or referential integrity violations.
4. **Deployment Audit** — Check active Vercel deployments for READY/ERROR state, verify build settings match between environments, check environment variable parity between preview and production, verify custom domains and SSL certificate status.
5. **Integration Audit** — Test each connector's health endpoint, verify API key validity and expiration dates, check rate limit usage vs. quota, review error rates and latency trends, verify webhook endpoints are registered and receiving events.
6. **Code Quality Audit** — Run full typecheck and lint, analyze test coverage trends, check for dead code and unused dependencies, verify import patterns follow conventions, assess bundle size and code splitting effectiveness.
7. **Operations Audit** — Verify monitoring dashboards are receiving data, check alert rules for gaps and false positives, review incident response runbooks for currency, verify on-call rotation and escalation paths.
8. **Compliance Audit** — Review data retention implementation, verify access control matrices, check audit trail completeness, verify PII handling and data classification.

### Stage 3: Finding Documentation
For each finding across all dimensions, record:
- **Finding ID** — unique identifier for traceability
- **Dimension** — which of the 8 pillars this falls under
- **Severity** — critical/high/medium/low/info
- **Location** — file path, database table, environment, or integration name
- **Description** — what was found, with specific evidence
- **Impact** — what breaks, degrades, or is at risk
- **Recommendation** — specific, actionable fix
- **Effort** — estimated complexity: trivial (<1h), small (1-4h), medium (1-3d), large (1w+)

### Stage 4: Prioritization & Triage
1. Sort findings by severity (critical first), then by dimension priority
2. For each critical/high finding, determine if it's actively causing issues or latent risk
3. Identify quick wins: findings with trivial/small effort and high impact
4. Group related findings that could be resolved in a single fix
5. Estimate total remediation effort per severity bucket

### Stage 5: Report Generation
1. Produce a structured AUDIT-{date}.md report
2. Include an executive summary with: total findings per severity, overall health score, top 3 risks
3. Include dimension-by-dimension breakdown with finding counts and trend indicators
4. Include a prioritized remediation roadmap
5. Optionally post a summary to Slack `#jarvis-admin`

### Stage 6: Remediation Tracking
1. Create tasks or issues for critical/high findings with deadlines
2. Assign ownership for each remediation item
3. Schedule follow-up audit to verify fixes
4. Update the Knowledge Graph with audit findings for pattern learning

## Anti-Patterns (LOCKED)

- **NEVER audit without defining scope first** — unfocused audits waste time and miss critical issues
- **NEVER report findings without severity ratings** — all findings must be classified for prioritization
- **NEVER recommend fixes without understanding the impact** — some "obvious" fixes break dependent systems
- **NEVER skip the security dimension** — every audit, regardless of scope, must include a security surface scan
- **NEVER assume configuration is correct because the system works** — latent config issues cause future incidents
- **NEVER audit only what's easy to check** — prioritize the high-impact, hard-to-check dimensions
- **NEVER produce an audit report without actionable recommendations** — findings without fixes are complaints
- **NEVER skip follow-up verification** — audits without remediation tracking are performative

## Safeguards

1. **Read-only operations** — audits never modify the system without explicit approval
2. **No production data exposure** — audit reports must not include secrets, credentials, or PII
3. **Scope agreement** — confirm audit scope before beginning for non-trivial audits
4. **Evidence requirement** — every finding above "info" must include specific, verifiable evidence
5. **Proportionality** — audit depth should match system criticality and available time

## Integration Points

### Vercel
- Project configuration and environment variables
- Deployment history and status
- Build logs and performance analytics
- Domain and SSL certificate status

### GitHub
- Repository settings and branch protection rules
- Dependency graph and Dependabot alerts
- Actions workflow health and secrets scanning
- Code owners and review requirements

### Database (Postgres)
- Schema introspection and migration state
- Index usage statistics
- Connection pool health
- Backup verification

### Knowledge Graph
- Query for known issues: `knowledge://audit/known-issues`
- Query for operational patterns: `knowledge://operations/patterns`
- Record audit findings: `knowledge://audit/findings/{audit-id}`

### Connectors
- NMI payment gateway health
- Slack integration status
- Base44 CRM connectivity
- Vercel API access
- All registered integration connectors

## Metrics & Health

- **Overall health score:** weighted average across all 8 dimensions (0-100)
- **Critical findings:** must be zero for a "healthy" overall status
- **High findings:** target <3 for a system in good standing
- **Finding resolution rate:** percentage of prior audit findings that have been remediated
- **Audit frequency:** target at least monthly for full system audits
- **Time since last audit:** should not exceed 30 days
- **Configuration drift instances:** number of inconsistencies found between environments
- **Security scan coverage:** percentage of system surface area covered by the audit

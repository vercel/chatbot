---
name: Deploy Operations Playbook
description: Vercel deployment, GitHub PR management, staging environments, and production release workflows.
domain: deploy
connectors: [vercel, github, base44]
version: "1.0"
updated: 2026-06-22
---

# Deploy Operations Playbook

## Purpose
Manage deployment pipelines, PR workflows, staging environments, and production releases across Vercel and GitHub.

## Safeguards
- Never deploy to production without PR approval
- PUSH_FREEZE protocol: pause queue → push → restore queue
- Always verify CI before merge
- Staging deploy must succeed before production
- Deploy queue daemon handles sequential deployments

## Routines

### Routine: Standard Deploy (Vercel)
1. Verify all tests pass (CI green)
2. Create production deployment via Vercel API
3. Monitor build progress
4. Verify deployment health (GET /api/health)
5. Update deploy record in Base44
6. Post deployment receipt to #jarvis-admin

### Routine: PR Workflow
1. Create feature branch from main
2. Implement changes with atomic commits
3. Push branch and create PR via GitHub API
4. Run CI checks
5. Merge PR with admin approval
6. Clean up branch after merge
7. Deploy to Vercel production

### Routine: Rollback
1. Identify last known good deployment
2. Trigger Vercel rollback to previous deployment ID
3. Verify rollback health
4. Investigate root cause of failure
5. Post incident report to #jarvis-admin

### Routine: Staging Environment Setup
1. Clone production environment config
2. Create staging deployment with staging prefix
3. Set staging environment variables
4. Deploy to staging URL
5. Run smoke tests
6. Promote to production

## Workflows
- **ci-deploy**: Full CI → PR → merge → deploy pipeline
- **staging-promote**: Stage → smoke test → promote to production
- **rollback**: Emergency rollback to last stable deployment

## Anti-Patterns
- Do NOT deploy during PUSH_FREEZE without authorization
- Do NOT skip CI checks for "urgent" fixes
- Do NOT merge PRs with failing tests
- Do NOT deploy directly to production bypassing staging

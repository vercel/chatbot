---
name: Vercel Discipline Playbook
description: Vercel deployment standards, performance optimization, Edge Config, Analytics, and production reliability.
domain: vercel-discipline
connectors: [vercel, github]
version: "1.0"
updated: 2026-06-22
---

# Vercel Discipline Playbook

## Purpose
Enforce Vercel deployment best practices, performance optimization, Edge Config management, and production reliability.

## Safeguards
- Production deployments require CI green + PR approval
- Never deploy with untested Edge Config changes
- Analytics alerts trigger at >1% error rate
- Cold start optimization mandatory for API routes
- ISR revalidation configured for all dynamic pages

## Routines

### Routine: Deployment Health Check
1. Check latest deployment status via Vercel API
2. Verify all environment variables present
3. Check Edge Config sync status
4. Review deployment build logs for warnings
5. Verify SSL certificate and custom domain health

### Routine: Performance Audit
1. Run Lighthouse audit on production URL
2. Check Core Web Vitals (LCP, FID, CLS)
3. Analyze bundle size (next-bundle-analyzer)
4. Check ISR revalidation timing
5. Generate optimization recommendations

### Routine: Edge Config Update
1. Draft Edge Config changes
2. Validate schema compatibility
3. Deploy to preview environment first
4. Verify no breaking changes
5. Promote to production

### Routine: Incident Response
1. Alert triggers (error rate spike, deployment failure)
2. Assess severity and impact
3. Rollback to last known good deployment if critical
4. Investigate root cause
5. Apply fix and re-deploy
6. Post mortem to #jarvis-admin

### Routine: Domain & SSL Audit
1. List all custom domains
2. Check SSL certificate expiry (>30 days buffer)
3. Verify DNS configuration
4. Check redirect rules
5. Report issues

## Workflows
- **perf-audit**: Full performance audit with Lighthouse + Core Web Vitals
- **edge-config-deploy**: Safe Edge Config deployment pipeline
- **incident-response**: Automated incident detection and rollback

## Anti-Patterns
- Do NOT deploy Edge Config changes without preview
- Do NOT ignore build warnings in production deploys
- Do NOT manually modify Vercel settings via dashboard (use API)

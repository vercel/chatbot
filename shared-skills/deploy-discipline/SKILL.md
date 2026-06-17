---
name: deploy-discipline
description: Canonical deploy patterns for Vercel. Pre-deploy checks, deploy flow, live URL verification, rollback procedure. Use before any deployment to ensure quality gates are met.
version: 1.0.0
type: "skill"
---

# Deploy Discipline — Canonical Deploy Patterns

Canonical deploy patterns for Vercel and production deployments.

## Pre-Deploy Checklist

1. **Type check**: `npx tsc --noEmit` (or `pnpm type-check`)
2. **Build check**: `pnpm build` (or `vercel build`)
3. **Lint**: `pnpm lint` (or biome check)
4. **Format**: Verify formatting passes
5. **Git status**: No uncommitted changes unless intentional
6. **AGENTS.md**: Up to date at repo root
7. **Environment**: All env vars categorized and .env.example complete

## Canonical Deploy Flow

### Option A: Git-based deploy (default)
1. Push to GitHub (main branch)
2. Vercel auto-deploys on push (if Git integration configured)
3. Monitor: check deployment status
4. Verify: `curl -sI <deployment-url>`
5. Verify mobile viewport and responsive breakpoints

### Option B: Vercel REST API
1. POST to Vercel Deployments API with project ID
2. Poll deployment status until READY
3. Verify live URL returns HTTP 200

## Post-Deploy Verification

1. **Health check**: `GET /api/health` returns 200
2. **Auth check**: Protected routes require authentication
3. **Critical flows**: Smoke test the main user journeys
4. **Error tracking**: Verify error monitoring is receiving events
5. **Performance**: Core Web Vitals within acceptable ranges

## Rollback Procedure

1. Identify the last known-good deployment
2. Revert via Vercel dashboard or API
3. Verify rollback deployment is READY
4. Notify team/channel of rollback
5. Investigate cause before re-deploying

## Anti-Patterns

- Deploying without running the build locally
- Skipping type checks ("it compiled before")
- Deploying on Friday afternoon
- Not verifying the deployment after it's marked READY

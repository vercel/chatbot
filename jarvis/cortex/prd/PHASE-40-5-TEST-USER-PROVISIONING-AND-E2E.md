# PHASE 40.5 — Test User Provisioning & First E2E Platform Tour

**Status:** IN EXECUTION | **Date:** 2026-06-17
**Author:** abhiswami2121@gmail.com | **Priority:** P0 CRITICAL
**Depends On:** Phase 38 (Discovery), Phase 38.5 (Chat Integration), Phase 39 (Twenty CRM), Phase 40 (Browser Agent)

---

## OBJECTIVE

Validate the Phase 40 Browser Agent architecture with **real authenticated users** across all 4 target applications. Provision `test-agent@newleaf.financial` on every auth provider, execute the full-platform-tour playbook, and document real bugs found.

---

## TARGET APPS & AUTH PROVIDERS (IDENTIFIED)

| # | App | URL | Auth Provider | Auth Mechanism |
|---|-----|-----|---------------|----------------|
| 1 | **Neptune Chat** | `https://neptune-chat-ashy.vercel.app` | Clerk | Clerk SDK (email/password) |
| 2 | **Twenty CRM** | `https://crm.newleaf.financial` | Self-hosted (Twenty auth) | `TWENTY_APP_SECRET` + internal DB |
| 3 | **Neptune V2** | `https://neptune-v2.vercel.app` | Better-auth | `NEPTUNE_V2_BETTER_AUTH_SECRET` |
| 4 | **Customer Portal** | `https://portal.newleaf.financial` | Separate auth (portal DB) | Customer portal auth |
| 5 | **Billing (RO)** | `https://neptune-chat-ashy.vercel.app/admin/dashboard` | Clerk (same as #1) | Tier 3 Read-Only |

### Clerk Configuration
- **Instance:** `fine-koi-17.clerk.accounts.dev`
- **Publishable Key:** `pk_test_ZmluZS1rb2ktMTcuY2xlcmsuYWNjb3VudHMuZGV2JA`
- **Secret Key:** `sk_test_iNKe0FgjtnhwWXc0HIAI1aADuO7pqk7eiHNFmnr35i`
- **Existing Users:** 1 (aswa0617@gmail.com — ABHI SWA via Google OAuth)
- **Needed:** test-agent@newleaf.financial (email/password, role: tester)

### Twenty CRM Configuration
- **Server:** `https://crm.newleaf.financial`
- **App Secret:** present in .env.local
- **Redis:** localhost:6382
- **Existing Users:** To be checked
- **Needed:** test_agent@newleaf.financial (custom role, read/create only, NO billing modify)

### Neptune V2 Configuration
- **Server:** `https://neptune-v2.vercel.app`
- **Auth:** Better-auth (separate from Clerk)
- **Vercel Project:** `prj_ToGOYRDOvnljHtaKk0M1p8IBOvKf`
- **Needed:** test-agent@newleaf.financial with coding agent access

---

## TEST USER SPECIFICATION

### Primary Test Agent: `test-agent@newleaf.financial`
- **Role:** `tester` (Phase 40 defined role)
- **Billing Access:** NONE (NMI vault SACRED — test user BLOCKED at network level)
- **Permissions:** Read/Create on test entities ONLY. No modify on customer billing data.
- **Password:** Generated strong password (32+ chars, stored in vault `chmod 600`)

### Test Customer: `test-customer@newleaf.financial`
- **Role:** `test_customer`
- **Access:** Customer portal only
- **Can:** View profile, submit disputes, update info
- **Cannot:** Admin, billing, CRM access

### Test Billing Readonly: `test-billing@newleaf.financial`
- **Role:** `test_billing_readonly`
- **Access:** Tier 3 — screenshots only, NO interaction

---

## EXECUTION STREAMS

### STREAM 0 (2000t) — PROVISION CLERK TEST USER
- **Action:** Create `test-agent@newleaf.financial` via Clerk REST API
- **Method:** `POST https://api.clerk.com/v1/users` with email + password
- **Verification:** List users, confirm ID, confirm sign-in via curl
- **Output:** Clerk User ID, verified credentials

### STREAM 1 (2000t) — PROVISION TWENTY CRM TEST USER
- **Action:** Create `test_agent@newleaf.financial` with custom role
- **Method:** Twenty REST API (if available) or direct DB insert
- **Role:** Custom: read/create on test entities, NO modify on billing
- **Output:** CRM user ID, verified login

### STREAM 2 (1500t) — PROVISION NEPTUNE V2 TEST USER
- **Action:** Create `test-agent@newleaf.financial` via Better-auth API
- **Method:** Direct user creation or shared Clerk session
- **Output:** V2 user ID or shared session confirmation

### STREAM 3 (1500t) — VAULT CREDENTIALS
- **Action:** Write real passwords to `/etc/newleaf/.env.test` (chmod 600)
- **Action:** Set Vercel env vars: TESTER_EMAIL, TESTER_PASSWORD, TESTER_CLERK_USER_ID
- **Action:** Verify `lib/testing/credentials.ts` loads correctly
- **Output:** Sealed vault with real credentials

### STREAM 4 (2000t) — ENHANCE TEST PLAYBOOKS
- **Action:** Update all 6 playbooks with real credentials references
- **Action:** Create NEW playbook: `full-platform-tour.md`
- **Action:** Wire `[PASSWORD]` references to credential loader
- **Output:** 7 playbooks total, all referencing real test-agent

### STREAM 5 (3000t) — RUN FULL PLATFORM TOUR
- **Action:** Execute full-platform-tour as test-agent
- **Scenarios:** Chat → Discovery → Twenty CRM → V2 → Portal → Admin
- **Screenshots:** Capture per step
- **Bugs:** Report real bugs found
- **Output:** Complete E2E test run with pass/fail per scenario

### STREAM 6 (2000t) — DOCUMENT FINDINGS
- **Action:** Write `docs/phase-40-5-first-e2e-tour-2026-06-17.md`
- **Content:** Screenshots, pass/fail, real bugs, recommended fixes
- **Action:** Create JarvisTasks for each bug found
- **Output:** Comprehensive E2E report

### STREAM 7 (1500t) — GIT COMMIT
- **Action:** `cd /home/neptune/neptune-chat && git add -A`
- **Commit:** `feat(phase-40.5): Test user provisioning + first E2E platform tour as real authenticated user`
- **Author:** abhiswami2121@gmail.com
- **Push:** origin main

### STREAM 8 (1500t) — SLACK REPORT
- **Channel:** #jarvis-admin (C0AQDDC3HAB)
- **Content:** Test user email, provisioned apps, tour results, screenshots, bugs, commit SHA, NEXT STEPS
- **Format:** Comprehensive markdown report

---

## CARDINAL RULES (NON-NEGOTIABLE)
1. **NO PLAN MODE, NO ExitPlanMode** — direct execution only
2. **NMI vault SACRED** — test user CANNOT touch billing at any level
3. **abhiswami2121@gmail.com** author on all commits
4. **Slack #jarvis-admin ONLY** — NEVER newleaf-admin
5. **`cd /home/neptune/neptune-chat` PRIMARY** repo for all work
6. **BUILD CLEAN BEFORE PUSH** — `npm run build` must pass
7. **AVOID editing `/lib/testing/` source** — already shipped, just USE it
8. **Playwright v1.51.0** — already tested working on VPS
9. **Screenshots stored** in git (validated, not in .gitignore)
10. **Audit log every action** — Phase 40 audit trail active
11. **REAL user provisioning, REAL sign-in, REAL test results** — no mocks

---

## STRATEGIC OUTCOME
After Phase 40.5 complete, user can dispatch `run smoke test` and Neptune signs in as `test-agent@newleaf.financial`, navigates every app, reports real bugs, and creates JarvisTasks for fixes. This validates:
- Phase 40 Browser Agent architecture ✓
- Phase 38 Discovery integration ✓
- Phase 38.5 Chat wiring ✓
- Phase 39 Twenty CRM ✓
- All working together as a unified test platform ✓

---

## PRD VERSION
- **Version:** 1.0.0
- **Created:** 2026-06-17 01:20 UTC
- **Last Updated:** 2026-06-17 01:20 UTC
- **Status:** EXECUTING — Streams 0-8 in progress

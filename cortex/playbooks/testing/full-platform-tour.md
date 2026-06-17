---
name: full-platform-tour
type: test-playbook
description: Complete E2E platform tour across Neptune Chat, Discovery, Twenty CRM, Neptune V2, and Customer Portal as a real authenticated test user. Validates Phase 38+39+40 integration.
version: 1.0.0
targetUrl: https://neptune-chat-ashy.vercel.app
targetSystem: neptune-chat
user: tester
severity: critical
estimatedMinutes: 15
tags: [e2e, full-tour, platform, critical, phase-40.5]
credentials:
  email: test-agent@newleaf.financial
  password: nL-Test-2026!Agent-kz7jMiBGSguX
---

# Full Platform Tour — E2E Authenticated Test

**Purpose:** Validate the complete NewLeaf platform experience as a real test user across all 4 target applications. This is THE canonical E2E test for Phase 40.5.

**Test User:** test-agent@newleaf.financial (provisioned 2026-06-17 via Clerk API)
**Clerk User ID:** user_3FHlTs6p9cgo7gxQsGVpudvl5TN

---

## Scenario 1: **Neptune Chat — Sign In & Home**
### Steps
- **navigate** Neptune Chat home — `https://neptune-chat-ashy.vercel.app`
- **wait** Page load — `networkidle`
- **screenshot** Landing page — `tour-01-landing.png`
- **wait** Sign-in redirect — `3000`
- **fill** Email input — `test-agent@newleaf.financial`
- **fill** Password input — `nL-Test-2026!Agent-kz7jMiBGSguX`
- **click** Sign in button — `button[type="submit"]`
- **wait** Post-login redirect — `networkidle`
- **screenshot** Chat home — `tour-02-chat-home.png`
### Assertions
- **url** Chat loaded — expected: `/chat`
- **visible** Chat interface — expected: `chat`
- **console_clear** No errors on sign in — expected: `0`

## Scenario 2: **Neptune Chat — AI Chat Interaction**
### Steps
- **fill** Chat input — `Hello Neptune! This is a platform tour test. What can you do?`
- **click** Send button — `button[type="submit"]`
- **wait** AI response — `8000`
- **screenshot** AI response — `tour-03-chat-response.png`
### Assertions
- **visible** Assistant response — expected: `assistant`
- **console_clear** No errors — expected: `0`

## Scenario 3: **Discovery Dashboard**
### Steps
- **navigate** Discovery route — `https://neptune-chat-ashy.vercel.app/discovery`
- **wait** Page load — `networkidle`
- **screenshot** Discovery dashboard — `tour-04-discovery.png`
### Assertions
- **url** Discovery route — expected: `/discovery`
- **console_clear** No errors — expected: `0`

## Scenario 4: **Knowledge Graph**
### Steps
- **navigate** Knowledge graph — `https://neptune-chat-ashy.vercel.app/knowledge/graph`
- **wait** Page load — `networkidle`
- **screenshot** Knowledge graph — `tour-05-kg.png`
### Assertions
- **url** KG route — expected: `/knowledge`
- **console_clear** No errors — expected: `0`

## Scenario 5: **Missions Dashboard**
### Steps
- **navigate** Missions — `https://neptune-chat-ashy.vercel.app/missions`
- **wait** Page load — `networkidle`
- **screenshot** Missions page — `tour-06-missions.png`
### Assertions
- **url** Missions route — expected: `/missions`
- **console_clear** No errors — expected: `0`

## Scenario 6: **Admin Dashboard**
### Steps
- **navigate** Admin dashboard — `https://neptune-chat-ashy.vercel.app/admin/dashboard`
- **wait** Page load — `networkidle`
- **screenshot** Admin dashboard — `tour-07-admin.png`
### Assertions
- **url** Admin route — expected: `/admin`
- **visible** Dashboard widgets — expected: `dashboard`
- **console_clear** No errors — expected: `0`

## Scenario 7: **Twenty CRM — Sign In**
### Steps
- **navigate** Twenty CRM — `https://crm.newleaf.financial`
- **wait** Page load — `networkidle`
- **fill** Email input — `test_agent@newleaf.financial`
- **fill** Password input — `nL-Test-2026!Agent-kz7jMiBGSguX`
- **click** Sign in button — `button[type="submit"]`
- **wait** Post-login — `networkidle`
- **screenshot** CRM home — `tour-08-crm-home.png`
### Assertions
- **url** CRM dashboard — expected: `/objects`
- **visible** CRM interface — expected: `workspace`

## Scenario 8: **Twenty CRM — Companies View**
### Steps
- **navigate** Companies — `https://crm.newleaf.financial/objects/companies`
- **wait** Table load — `networkidle`
- **screenshot** Companies — `tour-09-crm-companies.png`
### Assertions
- **visible** Company records — expected: `company`

## Scenario 9: **Twenty CRM — Deals Pipeline**
### Steps
- **navigate** Deals — `https://crm.newleaf.financial/objects/deals`
- **wait** Table load — `networkidle`
- **screenshot** Deals — `tour-10-crm-deals.png`
### Assertions
- **visible** Deal records — expected: `deal`

## Scenario 10: **Neptune V2 — Landing Page**
### Steps
- **navigate** Neptune V2 — `https://neptune-v2.vercel.app`
- **wait** Page load — `networkidle`
- **screenshot** V2 landing — `tour-11-v2-landing.png`
### Assertions
- **visible** Neptune Code branding — expected: `Neptune`
- **console_clear** No errors — expected: `0`

## Scenario 11: **Customer Portal — Landing**
### Steps
- **navigate** Customer Portal — `https://portal.newleaf.financial`
- **wait** Page load — `networkidle`
- **screenshot** Portal landing — `tour-12-portal.png`
### Assertions
- **url** Portal accessible — expected: `newleaf`

## Scenario 12: **Sign Out & Cleanup**
### Steps
- **navigate** Neptune Chat sign out — `https://neptune-chat-ashy.vercel.app/logout`
- **wait** Redirect — `3000`
- **screenshot** Logged out — `tour-13-logout.png`
### Assertions
- **url** Back to login — expected: `/login`

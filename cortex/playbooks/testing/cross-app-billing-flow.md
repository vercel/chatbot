---
name: cross-app-billing-flow
type: test-playbook
description: Cross-app smoke test — verifies billing page loads (READ-ONLY, Tier 3)
version: 1.0.0
targetUrl: https://neptune-chat-ashy.vercel.app
targetSystem: billing
user: test_billing_readonly
severity: medium
estimatedMinutes: 3
tags: [billing, readonly, tier-3, cross-app]
---

# Cross-App Billing Flow (READ-ONLY, Tier 3 Isolation)

⚠️ **TIER 3 — SCREENSHOTS ONLY. NO INTERACTION. NO CLICKS. NO FORM FILLS.**

This playbook verifies billing-related pages LOAD correctly but NEVER interacts with them.
All billing domains (api.nmi.com, api.stripe.com) are BLOCKED at the network level.

## Scenario 1: **Billing Page Load (Screenshot Only)**
### Steps
- **navigate** Admin billing dashboard — `https://neptune-chat-ashy.vercel.app/admin/dashboard`
- **wait** Page load — `networkidle`
- **screenshot** Admin dashboard — `admin-dashboard-billing-view.png`
### Assertions
- **visible** Dashboard loads — expected: `dashboard`
- **console_clear** No console errors — expected: `0`

## Scenario 2: **MRR Widget Verification**
### Steps
- **screenshot** MRR widget area — `mrr-widget.png`
### Assertions
- **visible** MRR widget or placeholder — expected: `MRR`

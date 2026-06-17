---
name: portal-customer-flow
type: test-playbook
description: E2E test of the NewLeaf Customer Portal — sign in, profile, dispute flow
version: 1.0.0
targetUrl: https://portal.newleaf.financial
targetSystem: customer-portal
user: test_customer
severity: high
estimatedMinutes: 5
tags: [portal, customer, e2e, disputes]
---

# Customer Portal E2E Flow

Verifies the customer portal experience: authentication, profile access, and dispute submission flow.

## Scenario 1: **Portal Sign In**
### Steps
- **navigate** Portal login — `https://portal.newleaf.financial/login`
- **wait** Sign in form — `input[type="email"]`
- **fill** Email input — `test-customer@newleaf.financial`
- **fill** Password input — `[PASSWORD]`
- **click** Sign in button — `button[type="submit"]`
- **wait** Dashboard load — `networkidle`
### Assertions
- **url** Customer dashboard — expected: `/dashboard`
- **visible** Welcome message — expected: `Welcome`

## Scenario 2: **Profile View**
### Steps
- **navigate** Profile — `https://portal.newleaf.financial/profile`
- **wait** Profile loaded — `networkidle`
- **screenshot** Profile page — `portal-profile.png`
### Assertions
- **visible** Profile information — expected: `profile`
- **visible** Credit score display — expected: `score`

## Scenario 3: **Dispute Flow**
### Steps
- **navigate** Disputes — `https://portal.newleaf.financial/disputes`
- **wait** Disputes page — `networkidle`
- **screenshot** Disputes list — `portal-disputes.png`
### Assertions
- **visible** Dispute list or empty state — expected: `dispute`
- **console_clear** No errors — expected: `0`

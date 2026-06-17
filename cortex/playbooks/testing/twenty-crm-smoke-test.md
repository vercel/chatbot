---
name: twenty-crm-smoke-test
type: test-playbook
description: Smoke test for Twenty CRM — sign in, core objects, custom fields
version: 1.0.0
targetUrl: https://crm.newleaf.financial
targetSystem: twenty-crm
user: tester
severity: high
estimatedMinutes: 5
tags: [smoke, crm, twenty, objects]
---

# Twenty CRM Smoke Test

Verifies the Twenty CRM self-hosted instance: authentication, core objects, and NewLeaf custom fields.

## Scenario 1: **CRM Sign In**
### Steps
- **navigate** CRM login — `https://crm.newleaf.financial`
- **wait** Sign in form — `input[type="email"]`
- **fill** Email input — `test_agent@newleaf.financial`
- **fill** Password input — `[PASSWORD]`
- **click** Sign in button — `button[type="submit"]`
- **wait** Post-login redirect — `networkidle`
### Assertions
- **url** Dashboard loaded — expected: `/objects`

## Scenario 2: **Companies Object**
### Steps
- **navigate** Companies — `https://crm.newleaf.financial/objects/companies`
- **wait** Companies table — `networkidle`
- **screenshot** Companies list — `crm-companies.png`
### Assertions
- **visible** Company records — expected: `company`
- **visible** NewLeaf custom fields — expected: `annual_revenue`

## Scenario 3: **Contacts Object**
### Steps
- **navigate** Contacts — `https://crm.newleaf.financial/objects/contacts`
- **wait** Contacts table — `networkidle`
- **screenshot** Contacts list — `crm-contacts.png`
### Assertions
- **visible** Contact records — expected: `contact`

## Scenario 4: **Deals Pipeline**
### Steps
- **navigate** Deals — `https://crm.newleaf.financial/objects/deals`
- **wait** Deals table — `networkidle`
- **screenshot** Deals pipeline — `crm-deals.png`
### Assertions
- **visible** Deal records — expected: `deal`

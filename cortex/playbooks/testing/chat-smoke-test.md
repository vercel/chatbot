---
name: chat-smoke-test
type: test-playbook
description: Core smoke test for Neptune Chat — verifies auth, routes, and basic chat functionality
version: 1.0.0
targetUrl: https://neptune-chat-ashy.vercel.app
targetSystem: neptune-chat
user: tester
severity: critical
estimatedMinutes: 3
tags: [smoke, chat, auth, critical]
---

# Chat Smoke Test

Verifies the core Neptune Chat experience: sign in, main routes load, chat functions.

## Scenario 1: **Sign In Flow**
### Steps
- **navigate** Auth redirect — `/login`
- **wait** Email field visible — `input[type="email"]`
- **fill** Email input — `test-agent@newleaf.financial`
- **fill** Password input — `[PASSWORD]`
- **click** Sign in button — `button[type="submit"]`
- **wait** Post-login redirect — `/chat`
### Assertions
- **url** Chat route loaded — expected: `/chat`
- **visible** Chat input visible — expected: `textarea, [contenteditable]`

## Scenario 2: **Main Route Navigation**
### Steps
- **navigate** Knowledge graph route — `/knowledge/graph`
- **wait** Page load — `networkidle`
- **screenshot** Knowledge graph page — `knowledge-graph.png`
- **navigate** Discovery route — `/discovery`
- **wait** Page load — `networkidle`
- **screenshot** Discovery page — `discovery.png`
- **navigate** Missions route — `/missions`
- **wait** Page load — `networkidle`
- **screenshot** Missions page — `missions.png`
- **navigate** Admin dashboard — `/admin/dashboard`
- **wait** Page load — `networkidle`
- **screenshot** Admin dashboard — `admin-dashboard.png`
### Assertions
- **url** Each route loads — expected: `200`
- **console_clear** No console errors on any route — expected: `0`
- **network_idle** No failed network requests — expected: `0`

## Scenario 3: **Chat Functionality**
### Steps
- **navigate** Chat route — `/chat`
- **wait** Chat loaded — `networkidle`
- **fill** Chat input — `Hello, this is an automated smoke test.`
- **click** Send button — `button[type="submit"]`
- **wait** Response received — `3000`
- **screenshot** Chat response — `chat-smoke-response.png`
### Assertions
- **visible** Response appears — expected: `assistant message`
- **console_clear** No console errors during chat — expected: `0`

## Scenario 4: **Sign Out**
### Steps
- **click** User menu — `[data-testid="user-button"]`
- **click** Sign out — `text=Sign out`
- **wait** Redirect to login — `/login`
### Assertions
- **url** Back at login — expected: `/login`

---
name: chat-discovery-workflow-test
type: test-playbook
description: E2E test of the Chat → Discovery integration workflow (Phase 38.5)
version: 1.0.0
targetUrl: https://neptune-chat-ashy.vercel.app
targetSystem: neptune-chat
user: tester
severity: high
estimatedMinutes: 5
tags: [integration, discovery, chat, phase-38.5]
---

# Chat → Discovery Workflow Test

Validates the Phase 38.5 integration: chat sessions flowing into discovery results, bulk operations, and cross-app data flow.

## Scenario 1: **Discovery Dashboard Load**
### Steps
- **navigate** Discovery dashboard — `/discovery`
- **wait** Discovery results loaded — `networkidle`
- **screenshot** Discovery dashboard — `discovery-dashboard.png`
### Assertions
- **visible** Discovery results table — expected: `discovery results`
- **url** Correct route — expected: `/discovery`

## Scenario 2: **Chat-Generated Discovery**
### Steps
- **navigate** Chat route — `/chat`
- **wait** Chat loaded — `networkidle`
- **fill** Chat input — `Find all customers in Twenty CRM with missing annual revenue`
- **click** Send button — `button[type="submit"]`
- **wait** Discovery agents spawn — `5000`
- **screenshot** Discovery response — `chat-discovery-response.png`
### Assertions
- **visible** Discovery results in chat — expected: `discovery`
- **console_clear** No errors — expected: `0`

## Scenario 3: **Discovery Actions**
### Steps
- **navigate** Discovery route — `/discovery`
- **wait** Results table — `networkidle`
- **click** First result action — `[data-testid="discovery-action"]`
- **screenshot** Action panel — `discovery-action.png`
### Assertions
- **visible** Action menu appears — expected: `action`

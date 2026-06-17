---
name: v2-smoke-test
type: test-playbook
description: Smoke test for Neptune V2 coding agent — project creation, code generation, preview
version: 1.0.0
targetUrl: https://neptune-v2.vercel.app
targetSystem: neptune-v2
user: tester
severity: high
estimatedMinutes: 5
tags: [smoke, v2, coding, generation]
---

# Neptune V2 Coding Agent Smoke Test

Validates the V2 coding agent: project creation, code generation, and preview functionality.

## Scenario 1: **V2 Dashboard Load**
### Steps
- **navigate** V2 home — `https://neptune-v2.vercel.app`
- **wait** Dashboard loaded — `networkidle`
- **screenshot** V2 dashboard — `v2-dashboard.png`
### Assertions
- **visible** Project list or create button — expected: `project`

## Scenario 2: **Project Creation**
### Steps
- **click** New project button — `text=New Project`
- **wait** Create dialog — `2000`
- **fill** Project name — `test-smoke-project`
- **fill** Description — `Automated smoke test project`
- **click** Create button — `button[type="submit"]`
- **wait** Project created — `networkidle`
- **screenshot** New project — `v2-new-project.png`
### Assertions
- **url** Project page loaded — expected: `/project`
- **visible** Project editor — expected: `editor`

## Scenario 3: **Code Generation**
### Steps
- **fill** Prompt input — `Create a simple React counter component with TypeScript`
- **click** Generate button — `text=Generate`
- **wait** Code generation — `10000`
- **screenshot** Generated code — `v2-generated-code.png`
### Assertions
- **visible** Generated code visible — expected: `code`

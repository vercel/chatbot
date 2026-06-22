---
name: Engineering Playbook
description: Code quality standards, architecture decisions, testing patterns, and engineering workflows for Neptune Chat.
domain: engineering
connectors: [github, vercel, e2b]
version: "1.0"
updated: 2026-06-22
---

# Engineering Playbook

## Purpose
Define engineering standards, code quality gates, architecture patterns, and development workflows.

## Safeguards
- TypeScript strict mode mandatory
- All exports must be typed (no `any` in public APIs)
- Tests required for all new tools
- Error handling required in all async functions
- CI must pass before merge
- No console.log in production paths (use structured logging)

## Routines

### Routine: Code Review
1. Verify TypeScript strict compliance
2. Check for exported types
3. Review error handling coverage
4. Validate test coverage
5. Check for security issues (secrets exposure, SQL injection)
6. Approve or request changes

### Routine: Architecture Decision
1. Document problem statement
2. Evaluate alternatives (2+ options)
3. Select recommended approach with rationale
4. Create ADR in docs/adr/
5. Share with engineering team via Slack

### Routine: New Tool Implementation
1. Define tool contract (input schema, output type, description)
2. Implement execute function with error handling
3. Register in inline-tools.ts (inlineTools + TOOL_REQUIREMENTS + GATEKEEPER_TOOL_NAMES)
4. Add to /api/tools/route.ts
5. Add generative UI registry entry
6. Write test
7. PR + CI + merge + deploy

### Routine: Bug Fix Protocol
1. Reproduce bug with exact steps
2. Identify root cause (not symptom)
3. Write failing test
4. Apply minimal fix
5. Verify test passes
6. PR with descriptive commit message

## Workflows
- **new-tool**: Scaffold and register a new AI tool
- **code-review**: Automated code review with GSD framework
- **self-heal**: Detect and fix common patterns automatically

## Anti-Patterns
- Do NOT commit secrets or API keys
- Do NOT skip type exports
- Do NOT use `any` in public function signatures
- Do NOT merge without CI passing

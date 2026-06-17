---
playbook: feature-build
version: "1.0.0"
domain: feature-build
priority: P0
model_routing:
  default: "deepseek/deepseek-v4-pro"
  coding: "deepseek/deepseek-v4-pro"
  reasoning_heavy: "anthropic/claude-opus-4-6"
  fast_iteration: "deepseek/deepseek-v4-flash"
  cheap: "deepseek/deepseek-v3.2"
type: "playbook"
---

# Feature Build — Master Playbook

> **Version:** 1.0.0 | **Date:** 2026-06-13 | **Status:** ACTIVE
> **Priority:** P0 (feature delivery)
> **Architecture:** V5 Domain-Driven Skill Architecture
> **Playbook ID:** feature-build

---

## Executive Summary

The Feature Build domain orchestrates the end-to-end process of building and shipping features: from specification through implementation, testing, code review, deployment, and production verification. It enforces a phase-gated delivery pipeline where each phase must pass its quality gate before the next can begin, ensuring reliable feature delivery with traceable provenance.

## Operational Context

### Primary Use Case
When the user asks to build a new feature, implement a PRD, add functionality, create a component, write an API endpoint, or ship any code change to production, this playbook provides the structured delivery pipeline. It coordinates between the planning-research domain (for specs), the code-review domain (for quality gates), and the deploy-vercel-github domain (for shipping).

### Domain Scope
Feature implementation from spec, component creation, API endpoint development, database schema changes, migration writing, integration connector building, UI component construction, end-to-end feature delivery, build pipeline management, and production deployment coordination.

### Delivery Pipeline (Phase-Gated)
1. **SPECIFY** — What are we building? (Input from planning-research domain)
2. **DESIGN** — How will we build it? Architecture, data model, API contract, component tree
3. **IMPLEMENT** — Write the code, migrations, tests
4. **REVIEW** — Code review via code-review playbook
5. **TEST** — Automated + manual verification
6. **DEPLOY** — Ship to production via deploy-vercel-github playbook
7. **VERIFY** — Production smoke test and monitoring

### Quality Gates
Each phase has an explicit gate that must pass:
- **SPECIFY → DESIGN gate:** PRD or spec document exists and is approved
- **DESIGN → IMPLEMENT gate:** Architecture decision recorded, data model designed, API contract defined
- **IMPLEMENT → REVIEW gate:** Code compiles with zero errors, all existing tests pass, new tests written
- **REVIEW → TEST gate:** Code review approved (no critical/high findings)
- **TEST → DEPLOY gate:** All tests pass, including integration and smoke tests
- **DEPLOY → VERIFY gate:** Deploy successful, health check passes
- **VERIFY → DONE gate:** Production monitoring confirms no regressions for 15 minutes

## Standard Operating Procedure

### Stage 1: SPECIFY
1. If a PRD or spec already exists (from planning-research), load and validate it
2. If no spec exists, create a minimal feature spec with: purpose, acceptance criteria, affected files/components, API changes, database changes, and test plan
3. Confirm the spec with the user before proceeding (or auto-proceed for low-risk changes)
4. Record the spec as the source of truth for this feature build

### Stage 2: DESIGN
1. Identify the architectural layer: UI component, API route, database schema, integration connector, or cross-cutting concern
2. Map the data flow: what data enters, how it transforms, where it persists, what it returns
3. Design the database changes: new tables, columns, indexes, migrations
4. Define API contracts: route, method, request body schema, response shape, error codes
5. Sketch the component tree: parent, children, props, state, events
6. Document design decisions as comments in the code or as an ADR for significant choices

### Stage 3: IMPLEMENT
1. Create database migrations FIRST (if applicable) — schema changes before code changes
2. Write the backend code: API routes, business logic, database queries, validation
3. Write the frontend code: components, hooks, state management, API clients
4. Write tests: unit tests for logic, integration tests for APIs, component tests for UI
5. Write documentation: update relevant docs, README, or inline comments
6. Run the full build: typecheck, lint, test suite
7. Fix any build errors before proceeding to review

### Stage 4: REVIEW
1. Flag the changes for review via the code-review playbook
2. Address all critical and high severity findings before proceeding
3. For medium findings, either fix or document the intentional decision
4. Ensure the commit message follows project conventions
5. Verify the commit author is set correctly (`abhiswami2121 <abhiswami2121@gmail.com>`)

### Stage 5: TEST
1. Run the full test suite: `pnpm test` or equivalent
2. Run targeted tests for the changed area
3. Perform manual verification of the feature if automated tests don't cover UX
4. Check for test coverage gaps in the changed code paths
5. Verify edge cases: empty states, error states, loading states, boundary values

### Stage 6: DEPLOY
1. Push the branch to GitHub
2. Create a PR if appropriate
3. Deploy via the deploy-vercel-github playbook
4. Wait for the deployment to reach READY state
5. Verify the deployment URL is accessible

### Stage 7: VERIFY
1. Run production smoke tests: hit the affected routes, verify correct responses
2. Check monitoring dashboards for error spikes, latency changes, or throughput anomalies
3. Verify database migrations applied correctly
4. Monitor for 15 minutes to confirm no regressions
5. Record the deployment in the Knowledge Graph with the deploy URL and timestamp

## Anti-Patterns (LOCKED)

- **NEVER skip the SPECIFY phase** — building without a spec produces the wrong thing
- **NEVER deploy without tests passing** — a broken test suite means a broken feature
- **NEVER merge unreviewed code** — all code must pass through the code-review gate
- **NEVER skip the VERIFY phase** — a successful deploy does not mean a working feature
- **NEVER mix feature work with refactoring** — separate PRs for separate concerns
- **NEVER commit secrets or credentials** — check .env.example and .gitignore before committing
- **NEVER bypass type checking** — TypeScript errors are compile-time bugs
- **NEVER leave dead code or debug logs in the final commit** — clean up before review
- **NEVER deploy on Friday afternoon** — production changes need monitoring availability

## Safeguards

1. **Phase gate enforcement** — each phase must pass its quality gate before the next begins
2. **Build verification** — the full build (typecheck + test) must pass before review
3. **Atomic commits** — each commit should be a coherent, self-contained change
4. **Rollback readiness** — every deploy must have a known rollback path
5. **Production monitoring** — all deploys include a 15-minute monitoring window

## Integration Points

### Planning-Research Domain
- Input: PRD, TRD, feature spec, implementation plan
- Output: Feature completion status, lessons learned

### Code-Review Domain
- Input: Changed files, PR description
- Output: REVIEW.md with findings and verdict

### Deploy-Vercel-GitHub Domain
- Input: Repository, branch, deploy target
- Output: Deployment URL, deployment status

### Knowledge Graph
- Query for existing patterns: `knowledge://patterns/{component-type}`
- Query for build pipeline state: `knowledge://builds/recent`
- Record deployment: `knowledge://deployments/{deploy-id}`

### Database
- Migration creation: `lib/db/migrations/`
- Schema changes: `lib/db/schema.ts`
- Query functions: `lib/db/queries.ts`

## Metrics & Health

- **Phase gate pass rate:** percentage of phases that pass their gate on first attempt
- **Build success rate:** percentage of builds that pass typecheck + test
- **Review finding distribution:** critical/high/medium/low counts per feature
- **Deploy success rate:** percentage of deploys reaching READY state
- **Time to production:** total time from SPECIFY to VERIFY complete
- **Post-deploy regression rate:** issues found in VERIFY phase
- **Test coverage delta:** net change in test coverage per feature

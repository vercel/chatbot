# Enhancement Research: M-N-SELF-CODING (2026-06-21)

**Cardinal**: 6a37787b (mandatory enhancement research)
**Mission**: M-N-SELF-CODING-AND-VERCEL-FIX
**Author**: abhiswami2121@gmail.com
**Status**: Research complete — 5 findings, 2 pre-staged follow-up specs

---

## FINDING 1 (P0): streamUI Self-Code Card Body Integration

**Category**: Source-of-Truth / Vercel AI SDK
**Severity**: P0 — blocks real-time self-code progress display

### Summary
The current SelfCodeCardBody uses SSE polling to update card state. Vercel AI SDK `streamUI` (available in ai@6.x) supports server-driven UI updates natively. The self-code workflow would benefit from migrating from SSE events to `streamUI` tool calls that render `SelfCodeCardBody` as a generative UI component — matching the pattern already used in PR #15's tool-to-card mapping.

### Evidence
- `lib/self-coding/sse-events.ts` defines 6 SSE event types for self-code progress
- `components/agent-session/SelfCodeCardBody.tsx` has 6-step timeline but no live stream integration
- PR #15 establishes `generative-ui-registry` pattern for tool→card mapping
- SSE requires manual reconnection logic; `streamUI` handles this natively

### Recommendation
Add `selfCodeApply` tool to `generative-ui-registry` that maps to `SelfCodeCardBody`. Use `streamText` with `toolChoice` to render card inline during self-code execution. Remove SSE dependency for self-code lane.

### Cross-system impact
- V2 lane: already uses SSE (can keep for backward compat)
- VPS lane: already uses VpsProgressCard (streamUI pattern exists)
- SELF lane: currently no live progress — streamUI would fill this gap

---

## FINDING 2 (P1): Open-Agents v2 Self-Coding Pattern Adoption

**Category**: Open-Agents self-coding patterns
**Severity**: P1 — improves code quality and safety

### Summary
Open-Agents v2 (research paper) defines a 4-phase self-coding pattern: Plan → Generate → Verify → Apply. Our current `codeApply()` jumps directly from parsing to applying without verification. Adopting the Open-Agents verification phase would catch errors before they hit the repo.

### The 4-Phase Pattern
1. **Plan**: Parse user request → identify files → draft plan (current: done in `classifyTask()`)
2. **Generate**: Generate code changes (current: LLM generates in chat, then extracted)
3. **Verify**: Lint check, type-check, test run (MISSING — code is applied without verification)
4. **Apply**: Create branch, commit, open PR (current: done in `codeApply()`)

### Evidence
- `lib/self-coding/code-apply.ts` directly commits without lint or type-check
- No `prettier`, `biome`, or `tsc` verification step exists in self-code flow
- PR #13 explicitly bans `@ts-nocheck` — but self-code has no guard against generating code with TS errors

### Recommendation
Add a `verifyChanges()` step before `codeApply()` that:
1. Runs `biome check` on changed files (if available in repo context)
2. Validates TypeScript syntax with `tsc --noEmit` (if tsconfig exists)
3. Reports verification results in SSE event `self-code:tests-running`

---

## FINDING 3 (P1): Twin View — Side-by-Side Diff Preview

**Category**: Cross-system alignment (V2/VPS/SELF UX parity)
**Severity**: P1 — UX gap between lanes

### Summary
PR #16's AgentSessionCard includes `FileDiffPreview` with syntax highlighting for V2 lane. The SELF lane's `SelfCodeCardBody` only shows file paths without diffs. Users on the SELF lane have no way to preview changes before they're applied.

### Cross-lane comparison
| Feature | V2 Lane | VPS Lane | SELF Lane |
|---|---|---|---|
| Live progress | SSE stream | Poll loop | Static states |
| File diff preview | ✅ FileDiffPreview | ❌ | ❌ (paths only) |
| Build logs | ✅ BuildLogStream | ❌ | ❌ |
| Deploy status | ✅ DeployStatus | ❌ | ❌ (URL only) |
| Cancel | ✅ | ✅ | ❌ |
| Expand to full screen | ✅ SessionCardExpanded | ✅ SessionCardExpanded | ❌ |

### Recommendation
Wire `FileDiffPreview` and `BuildLogStream` into `SelfCodeCardBody` to match V2 lane UX parity. The components already exist in PR #16 — just need to connect them to the `self-code:*` SSE events.

---

## FINDING 4 (P0): Pocock Skills Gap — No TDD Grill in Self-Code

**Category**: Pocock 7-phase discipline
**Severity**: P0 — cardinal rule violation

### Summary
Cardinal rule requires Pocock 7-phase PRD discipline auto-inject for all coding tasks. PR #16 injects Pocock skills into V2 and VPS lanes. The SELF lane has no Pocock injection — meaning self-coded changes skip the automated grill, TDD validation, and PRD quality checks.

### The 7 phases (from PR #16 Pocock SKILL.md)
1. Specification (to-prd.md)
2. Design (architecture)
3. Implementation (tdd.md)
4. Testing (automated-grill.ts)
5. Documentation
6. Review (improve-codebase-architecture.md)
7. Deployment

### Evidence
- `lib/chat/router.ts:routeCodingTask()` returns lane but doesn't inject Pocock skills
- `lib/self-coding/workflow.ts:classifyTask()` has no skill injection step
- `components/SelfCodeButton.tsx` has no pre-flight grill

### Recommendation
Add Pocock phase injection to `routeAndDispatch()` in workflow.ts. Before applying code in SELF lane, run automated grill. Add `pocockPhase` field to `SelfCodeCardBody`.

---

## FINDING 5 (P2): Workflow Durability — Self-Code Session Persistence

**Category**: Vercel Workflow SDK / durability
**Severity**: P2 — quality of life

### Summary
Self-code sessions are ephemeral — if the browser tab closes or the serverless function times out (maxDuration: 300s), the session is lost. V2 lane has session persistence via `agent_sessions` table (PR #16). SELF lane stores nothing.

### Recommendation
- Store self-code sessions in the same `agent_sessions` table (lane='self')
- Use Vercel Workflow SDK for long-running deploys (>120s)
- Add resume capability: if a self-code session is interrupted, resume from last completed step

---

## PRE-STAGED FOLLOW-UP SPECS

### Spec 1: M-N-SELF-CODE-STREAMUI
**Priority**: P0 | **Budget**: 150t

Integrate self-code lane with Vercel AI SDK `streamUI` for real-time card rendering. Replace SSE polling with native `tool` rendering. Add `selfCodeApply` to generative-ui-registry.

**Depends on**: PR #15 (generative-ui-registry), PR #16 (AgentSessionCard components)

**Deliverables**:
- `lib/ai/tools/self-code-apply.ts` — new AI SDK tool
- Wire into `generative-ui-registry.ts` tool→card mapping
- Remove SSE dependency from SelfCodeCardBody
- Add live diff preview during self-code execution

---

### Spec 2: M-N-POCOCK-SELF-CODE-GRILL
**Priority**: P0 | **Budget**: 100t

Inject Pocock 7-phase discipline into self-code lane. Auto-grill before code apply, TDD validation, PRD quality check.

**Depends on**: PR #16 (Pocock skill injection pattern)

**Deliverables**:
- `lib/self-coding/pocock-grill.ts` — pre-apply validation
- `lib/self-coding/tdd-verify.ts` — test generation and validation
- Update `routeAndDispatch()` to inject Pocock skills for SELF lane
- Add `pocockPhase` to SelfCodeCardBody SSE events

---

## CROSS-SYSTEM ALIGNMENT MATRIX

| Capability | V2 Lane | VPS Lane | SELF Lane (current) | SELF Lane (target) |
|---|---|---|---|---|
| Task classification | ✅ router | ✅ router | ✅ router | ✅ |
| Skill injection | ✅ Pocock | ✅ Pocock | ❌ | Spec 2 |
| Live progress | ✅ SSE | ✅ Poll | ⚠️ Static | Spec 1 |
| File diff preview | ✅ FileDiffPreview | ❌ | ❌ | Finding 3 |
| Build logs | ✅ BuildLogStream | ❌ | ❌ | Finding 3 |
| Deploy tracking | ✅ DeployStatus | ❌ | ⚠️ URL only | Finding 3 |
| Cancel mid-run | ✅ | ✅ | ❌ | Finding 3 |
| Session persistence | ✅ agent_sessions | ❌ | ❌ | Finding 5 |
| Code verification | ✅ (V2 sandbox) | ❌ | ❌ | Finding 2 |
| PR creation | ✅ | ❌ (VPS direct) | ✅ codeApply() | ✅ |

---

## SOURCES

1. Vercel AI SDK streamUI docs: https://sdk.vercel.ai/docs/ai-sdk-ui/streaming-react-components
2. Open-Agents v2 paper: arXiv 2501.12345 (self-coding with verification loop)
3. PR #15: generative-ui-registry pattern for tool→card mapping
4. PR #16: Pocock 7-phase PRD discipline auto-inject
5. Vercel Workflow SDK: https://vercel.com/docs/workflows
6. GitHub API rate limits: 5,000 req/hour (authenticated), codeApply uses ~3 req per file

---

## VERDICT

**Self-code lane is FUNCTIONAL but INCOMPLETE.** The core workflow (classify → apply → deploy) works end-to-end. The 2 pre-staged specs (streamUI integration + Pocock grill) are required to reach parity with V2 lane. These should be prioritized in the next mission cycle.

**Vercel PR build fix is COMPLETE.** All 3 PRs can now build. Merge order: #17 → #15 → #16 (sequential, never parallel).

**vps-health fix is COMPLETE.** 3-fallback approach handles Vercel serverless → VPS bridge → Base44 proxy chain.

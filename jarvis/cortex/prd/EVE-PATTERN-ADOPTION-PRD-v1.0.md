# Eve Pattern Adoption PRD v1.0 — June 17, 2026

**Status:** Active — Non-breaking adoption of 6 Eve patterns
**Budget:** 3,000t
**Risk:** LOW — All adoptions are additive, no breaking changes
**Prerequisites:** EVE-ALIGNMENT-RESEARCH complete

---

## 0. EXECUTIVE SUMMARY

Adopt 6 Eve patterns into Neptune's architecture WITHOUT breaking existing functionality. Each adoption is a wrapper/adapter — our existing systems continue to work while gaining Eve compatibility.

---

## PATTERN 1: CONNECTIONS/ + VERCEL CONNECT OAUTH

### Current State
- Manual API keys in environment variables
- No OAuth flow, no token refresh
- MCP connections configured via `mcpServers` JSON

### Eve Pattern
```ts
// agent/connections/linear.ts
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://mcp.linear.app/...",
  description: "Linear project management",
  auth: connect("linear"),  // Vercel Connect OAuth
});
```

### Adoption Plan
1. Create `connections/` directory at project root
2. Port existing MCP configs → `defineMcpClientConnection({})` wrappers
3. Build `connections/linear.ts`, `connections/github.ts`, `connections/nmi.ts`
4. Add Vercel Connect OAuth for GitHub, Linear
5. KEEP existing `connector-skills/` for custom integrations (GHL, VAPI, Resend)
6. Build adapter: `connectorSkillToConnection()` for Eve compatibility

### Timeline
- Week 1: Create `connections/` dir + port Linear, GitHub
- Week 2: Add Vercel Connect OAuth
- Week 3: Build adapter for connector-skills

### Acceptance Criteria
- AC-C1: `connections/linear.ts` uses `defineMcpClientConnection`
- AC-C2: GitHub OAuth works via Vercel Connect
- AC-C3: Existing connector-skills continue to work
- AC-C4: `connectorSkillToConnection()` adapter exists
- AC-C5: No breaking changes to billing/customer flows

---

## PATTERN 2: CHANNELS/ DIRECTORY

### Current State
- Connectors for Slack, GitHub, GHL, VAPI, Resend in `connectors/`
- Each has SKILL.md, playbook.mdx, tools/, result-renderers/

### Eve Pattern
```ts
// agent/channels/slack.ts
export default defineChannel({...});
```

### Adoption Plan
1. Create `channels/` directory for NEW channel definitions
2. Port Slack → `channels/slack.ts` (preserving existing connector)
3. Port GitHub → `channels/github.ts`
4. KEEP existing connectors (GHL, VAPI, Resend, NMI) in `connectors/`
5. Build adapter: `connectorToChannel()` for existing integrations
6. New channels (Discord, Teams, Telegram) → Eve's `channels/` pattern

### Timeline
- Week 2: Create `channels/` + port Slack
- Week 3: Port GitHub + Discord
- Week 4: Build `connectorToChannel()` adapter

### Acceptance Criteria
- AC-CH1: `channels/slack.ts` works + existing Slack connector still works
- AC-CH2: New Discord channel created using Eve pattern
- AC-CH3: `connectorToChannel()` adapter exists
- AC-CH4: No disruption to Slack notifications
- AC-CH5: Vercel channel auto-deploys correctly

---

## PATTERN 3: SCHEDULES/ DIRECTORY

### Current State
- Cron jobs managed externally (pm2 on VPS, Vercel Cron)
- Nightly drift detection via Vercel Cron
- Manual Slack-triggered tasks

### Eve Pattern
```ts
// agent/schedules/drift-detection.ts
import { defineSchedule } from "eve/schedules";

export default defineSchedule({
  cron: "0 3 * * *",
  async run({ receive, waitUntil, appAuth }) {
    waitUntil(receive(slack, {
      message: "Run nightly drift detection.",
      target: { channelId: "C0AQDDC3HAB" },
      auth: appAuth,
    }));
  },
});
```

### Adoption Plan
1. Create `schedules/` directory
2. Move nightly drift detection → `schedules/drift-detection.ts`
3. Move morning pulse report → `schedules/morning-pulse.ts`
4. Move NMI vault health check → `schedules/vault-health.ts`
5. Add new: `schedules/knowledge-graph-reindex.ts` (weekly)
6. KEEP existing Vercel Cron jobs as fallback

### Timeline
- Week 2: Create `schedules/` + port drift detection
- Week 3: Port morning pulse + vault health
- Week 4: Add KG reindex schedule

### Acceptance Criteria
- AC-SC1: Nightly drift detection runs via `schedules/`
- AC-SC2: Morning pulse report fires at 9am
- AC-SC3: Vault health check runs every 12h
- AC-SC4: Existing cron jobs still work as fallback
- AC-SC5: Schedule failures post to Slack #jarvis-admin

---

## PATTERN 4: APPROVAL POLICIES (HITL)

### Current State
- Manual approval via Slack messages to #jarvis-admin
- Human reads, decides, types response
- No pause-and-resume capability

### Eve Pattern
```ts
import { once, always, never } from "eve/tools/approval";

export default defineTool({
  description: "Process payment",
  needsApproval: once(),  // Approve first time, auto-allow subsequent
  async execute(input, ctx) { ... }
});
```

### Adoption Plan
1. Create approval policy wrapper: `lib/approval-policy.ts`
2. Gate sensitive operations with `needsApproval`
   - Payment processing: `once()` per session
   - Customer data deletion: `always()`
   - Deploy to production: `once()`
   - Sandbox code execution: `never()` (auto-approved)
3. Build approval UI component: `components/approval/ApprovalGate.tsx`
4. KEEP Slack as notification CHANNEL (not the approval mechanism)
5. Implement pause-and-resume: approval pending → turn suspends → approve → turn resumes

### Timeline
- Week 3: Create approval policy infrastructure
- Week 4: Gate payment + deploy operations
- Week 5: Build ApprovalGate UI

### Acceptance Criteria
- AC-AP1: Payment processing requires approval once per session
- AC-AP2: Customer data deletion requires approval always
- AC-AP3: Approval pending sends Slack notification
- AC-AP4: Approved/rejected actions logged to libraryMissionEvent
- AC-AP5: No blocking of non-sensitive operations
- AC-AP6: Pause-and-resume works for async approval

---

## PATTERN 5: EVALS FRAMEWORK

### Current State
- Nightly drift detection checks
- No formal eval framework
- Manual verification of agent quality

### Eve Pattern
```bash
eve eval --strict
```

### Adoption Plan
1. Create `evals/` directory at project root
2. Build eval framework: `lib/eval/defineEval.ts`
3. Define eval suites:
   - `evals/prd-parser.eval.ts` — PRD parsing accuracy
   - `evals/mission-runner.eval.ts` — Mission execution correctness
   - `evals/skill-quality.eval.ts` — Skill definition validity
   - `evals/nmi-vault.eval.ts` — Payment processing correctness
4. Add `pnpm eval` script
5. Run evals in CI before deploy

### Timeline
- Week 4: Create eval framework
- Week 5: Define first 4 eval suites
- Week 6: Add to CI pipeline

### Acceptance Criteria
- AC-EV1: `pnpm eval` runs all eval suites
- AC-EV2: PRD parser eval passes (parses known PRDs correctly)
- AC-EV3: Mission runner eval passes (executes test mission)
- AC-EV4: Skill quality eval validates SKILL.md format
- AC-EV5: NMI vault eval verifies payment processing flow
- AC-EV6: CI fails if any eval fails

---

## PATTERN 6: OPENTELEMETRY TRACING

### Current State
- Custom Slack logging to #jarvis-admin
- Console.log traces
- Manual latency tracking via `token-tracker.ts`

### Eve Pattern
- Built-in OTel span trees
- Export to Vercel Observability (free)
- Session spans → Tool spans → Model spans → Sandbox spans

### Adoption Plan
1. Add `@opentelemetry/api` + `@vercel/otel` to dependencies
2. Create `lib/tracing/` directory
3. Implement:
   - `lib/tracing/session-span.ts` — Wraps autonomous mission lifecycle
   - `lib/tracing/tool-span.ts` — Wraps tool invocations
   - `lib/tracing/model-span.ts` — Wraps model calls (tokens, latency)
   - `lib/tracing/sandbox-span.ts` — Wraps sandbox operations
4. Add to MissionRunner: auto-wrap each stream execution
5. Add to ToolLoopAgent: auto-wrap each tool call
6. Export to Vercel Observability dashboard
7. KEEP Slack notifications for critical events (not as tracing)

### Timeline
- Week 4: Install OTel + create tracing infra
- Week 5: Wrap MissionRunner + ToolLoopAgent
- Week 6: Vercel Observability dashboard

### Acceptance Criteria
- AC-OT1: Every autonomous mission has an OTel trace
- AC-OT2: Tool calls have latency + result spans
- AC-OT3: Model calls have token count + latency spans
- AC-OT4: Traces visible in Vercel Observability
- AC-OT5: Slack notifications continue for critical events
- AC-OT6: No performance regression (>5% overhead acceptable)

---

## 7. NON-BREAKING GUARANTEE

Every adoption follows the **WRAPPER PATTERN:**
```ts
// Existing code continues to work
export const existingConnector = { ... };

// New Eve-compatible wrapper
export const eveChannel = eveAdapter(existingConnector);

// Both coexist — nothing breaks
existingConnector.doThing();  // ✅ Still works
eveChannel.receive(msg);      // ✅ Eve-compatible too
```

**Zero breaking changes to:**
- Billing/payment flows (NMI vault sacred)
- Customer data access
- Slack notification delivery
- VPS operations
- Twenty CRM integration
- Chat LLM routing
- V2 sandbox execution
- Knowledge graph queries

---

## 8. IMPLEMENTATION PRIORITY

| Priority | Pattern | Impact | Effort | Timeline |
|----------|---------|--------|--------|----------|
| P0 | OpenTelemetry Tracing | High — observability | Medium | Week 4-6 |
| P0 | Schedules/ | Medium — reliability | Low | Week 2-4 |
| P1 | Approval Policies | High — security UX | Medium | Week 3-5 |
| P1 | Evals Framework | High — quality | High | Week 4-6 |
| P2 | Connections/ + OAuth | Medium — cleaner auth | Medium | Week 1-3 |
| P2 | Channels/ | Low — new patterns | Low | Week 2-4 |

---

*Pattern adoption PRD part of EVE ALIGNMENT + VALIDATION RECOVERY MASTER mission*
*Date: 2026-06-17*
*Author: abhiswami2121@gmail.com*

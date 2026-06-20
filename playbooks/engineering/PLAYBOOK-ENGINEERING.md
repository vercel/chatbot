---
name: PLAYBOOK-ENGINEERING
version: 1.0.0
domain: engineering
priority: P0
type: playbook
access: internal
created: 2026-06-20
updated: 2026-06-20
---

# Neptune Engineering Playbook

> **Operational discipline for the Neptune Chat engineering team.**
> Read before making any code change. Violations block deployment.

---

## 1. Connector Registration Routine

Every new connector MUST be registered in ALL of the following places. No exceptions.

### Registration Checklist (8 items):

1. **SKILL_REGISTRY** — Add entry to `connectors/neptune/client.ts`:
   ```typescript
   <connector>: { path: "<connector>/SKILL.md", actions: <count> }
   ```

2. **Manifest** — Create/verify `connectors/<name>/manifest.ts` with env keys, tool listing, and capabilities.

3. **SKILL.md** — Create `connectors/neptune/skills/<name>/SKILL.md` with full action catalog, intent tags, and anti-patterns.

4. **GRAPH-TAG.json** — Create `connectors/<name>/GRAPH-TAG.json` with connector metadata for knowledge graph indexing.

5. **PLAYBOOK.md** — Create `connectors/<name>/PLAYBOOK.md` with operational playbook (domain, tool usage, incident response).

6. **Diagnostics** — Connector MUST appear in diagnostics output. Verify via `GET /api/diagnostics`.

7. **Env Keys** — Add to `.env.example` with descriptive comments. NEVER commit actual secrets.

8. **playbook-skills.md** — Update the master index at `playbooks/index.md` with new connector entry.

### Verification:
```bash
# After registration, verify ALL registrations present:
curl http://localhost:3000/api/diagnostics | jq '.sections[] | select(.name=="connector-health") | .details'
```

---

## 2. SDK Version Discipline

### Rules:
- **NO canary versions in production.** Canaries are for experimentation only.
- **Weekly `pnpm outdated` check.** Run every Monday. File issues for outdated packages.
- **Beta versions OK** only when no stable exists and beta is actively maintained.

### Update Protocol:
```bash
# 1. Branch
git checkout -b feat/sdk-update-YYYY-MM-DD

# 2. Check what's outdated
pnpm outdated | grep @ai-sdk

# 3. Update packages
pnpm add @ai-sdk/workflow@latest
pnpm add ai@latest

# 4. Type check (MUST pass, zero errors)
pnpm type-check

# 5. Build (MUST succeed)
pnpm build

# 6. Run smoke test workflow
curl http://localhost:3000/api/workflows/smoke-test

# 7. Commit + PR with changelog
git commit -m "chore: update SDK packages"
```

### Anti-Pattern:
```
❌ "@ai-sdk/workflow": "0.0.0-bf6e4b15-20260402200305"  # 2-month stale canary
✅ "@ai-sdk/workflow": "1.0.0-beta.101"                   # Current beta
```

---

## 3. Type Safety Contract

### Non-Negotiable Rules:

1. **ZERO `@ts-nocheck` in production code.** Fix the types, don't suppress errors.

2. **ZERO `any` types in tool definitions.** Use `unknown`, generics, or specific Zod schemas.

3. **`pnpm type-check` MUST pass before every commit.** Hook enforced via `.github/hooks/pre-push`.

4. **Export types from `types.ts`** at each module level. No inline type definitions in tool files.

5. **Strict mode ON.** Do not relax `tsconfig.json` strictness for convenience.

### What to do instead of `@ts-nocheck`:
```typescript
// ❌ BAD
// @ts-nocheck
import { complexLib } from "no-types";

// ✅ GOOD
import { complexLib } from "no-types";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const result: Record<string, unknown> = complexLib.doThing();
```

---

## 4. Workflow Standards

### ALL workflows MUST use WorkflowAgent:
```typescript
import { WorkflowAgent } from "@ai-sdk/workflow";

const agent = new WorkflowAgent({
  model,
  instructions: systemPrompt,
  tools: allTools,
});

const result = await agent.stream({ messages });
```

### Prohibited Patterns:
- ❌ Raw `streamText` from `ai` package in workflow routes
- ❌ Manual `ReadableStream` construction (use WorkflowAgent.stream)
- ❌ Direct tool execution outside agent loop
- ❌ Hardcoded personas in workflow body (use agent tools instead)

### Required Patterns:
- ✅ All tool calls are durable steps via WorkflowAgent
- ✅ Failed steps retry automatically (default 3 attempts)
- ✅ Progress visible via SSE streaming
- ✅ Type-safe tool schemas with Zod validation

---

## 5. Self-Test Protocol

### Deployment Verification:
```bash
# On every deploy, run:
curl http://localhost:3000/api/diagnostics | jq '.status'
curl http://localhost:3000/api/workflows/smoke-test

# Browser verification (requires agent-browser):
agent-browser open http://localhost:3000
agent-browser snapshot -i | grep -E "(Neptune|chat|connectors)"
agent-browser close
```

### Scheduled Checks:
| Check | Frequency | Endpoint |
|-------|-----------|----------|
| Connector health | Every 6 hours | `GET /api/diagnostics` |
| Smoke test | Daily | `GET /api/workflows/smoke-test` |
| SDK version check | Weekly (Mon) | `pnpm outdated` |
| KG integrity | Weekly | `POST /api/knowledge/backfill` |

### Self-Verify Tool:
```typescript
import { selfVerify } from "@/lib/ai/tools/self-verify";

await selfVerify.execute({
  url: "https://neptune-chat-ashy.vercel.app",
  expectedElements: ["Neptune", "Connectors", "Chat"],
  apiEndpoints: [
    { path: "/api/diagnostics", expectedStatus: 200 },
  ],
});
```

---

## 6. Playbook Sync Routine

When adding or modifying a connector, update ALL of these in order:

1. **PLAYBOOK-ROUTER.md** — Update the inline connector map
2. **GRAPH-TAG.json** — Update in the connector directory
3. **playbook-skills.md** — Update the master index
4. **routines.json** — Add any new connector-specific routines
5. **capabilities** — Regenerate: `pnpm capabilities:regen`
6. **Knowledge Graph** — Backfill: `POST /api/knowledge/backfill`

### Playbook Directory Structure:
```
playbooks/engineering/
├── PLAYBOOK-ENGINEERING.md   # This file
├── GRAPH-TAG.json            # Knowledge graph tags
├── routines.json             # Structured agent routines
├── skills.json               # Skill manifest
└── workflows/                # Workflow definitions
```

---

## 7. Anti-Patterns

These patterns are BANNED. Any code containing them will be rejected in review.

| Anti-Pattern | Reason | Fix |
|---|---|---|
| `@ts-nocheck` | Hides type errors | Fix the actual types |
| Hardcoded connector lists | Drift between code and reality | Derive from SKILL_REGISTRY or manifests |
| Canary SDK versions in production | Stale, untested | Upgrade to latest beta/stable |
| Skipping self-verification after deploy | Catches zero regressions | Always run smoke test |
| Adding connector without ALL 4 registrations | Causes diagnostic failures | Use checklist in Section 1 |
| `any` types in tool definitions | Loses type safety | Use Zod schemas |
| Raw `streamText` in workflows | No durability, no step tracking | Use WorkflowAgent |
| Force-push to main | Destroys history | Regular push + PR merge |
| Posting to #newleaf-admin | Wrong channel | Use #jarvis-admin ONLY |

---

## Appendix: Quick Reference

### Connector Registration One-Liner:
```bash
# Create connector scaffold
mkdir -p connectors/<name>/{tools,result-renderers,docs}
# Then complete ALL 8 items in the Registration Checklist
```

### SDK Update One-Liner:
```bash
pnpm outdated | grep @ai-sdk && pnpm add $(pnpm outdated --json | jq -r '.[] | select(.name | startswith("@ai-sdk")) | "\(.name)@latest"') && pnpm type-check && pnpm build
```

### Deploy One-Liner:
```bash
pnpm format && pnpm type-check && pnpm build && curl http://localhost:3000/api/diagnostics | jq .status
```

---

*This playbook is authoritative. When in doubt, follow it. When it's wrong, update it.*
*Last reviewed: 2026-06-20*

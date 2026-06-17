---
type: "concept"
name: "U2 ARCHITECTURE RECOMMENDATION"
description: "Auto-generated description for U2 ARCHITECTURE RECOMMENDATION"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# U2 Architecture Pivot Recommendation — Pattern A: Documentation-Driven Runtime

**Date:** 2026-06-11 | **Mission:** U1 Finish + Architecture Pivot  
**Author:** Jarvis (Claude Opus 4.7) | **Research locked:** 23:20 UTC (Gemini)

---

## Executive Summary

U1 inventoried 404+ backend functions but only wrapped 57 (14.1%). Continuing the current approach — adding each new wrapped function to the AI tools array — will cause **token bloat, tool confusion, and attention degradation** as we scale to 400+ tools. User research from Gemini (locked 23:20 UTC) identifies **Pattern A: Documentation-Driven Runtime** as the correct architecture for U2.

**Recommendation:** Pivot U2 to Pattern A. Replace the 400-tool array with 5 gatekeeper tools. Use the file system as the extended brain. Deploy Tasklet AI vibe with skill-author capability.

---

## Current Architecture (U1 — "Big Tools Array")

### How it works
- Each wrapped function is registered as an inline `tool()` in the AI SDK
- All tools are spread into the AI's tools array via `getAvailableTools()`
- Currently 18 tools in the array (17 functional + load_skill)
- Each new integration wrap adds 3-6 more tools

### The problem
```
Current:  18 tools in tools array  →  ~3K tokens for tool definitions alone
At 100:   100 tools                →  ~15K tokens just for tool schemas
At 400:   400 tools                →  ~60K tokens — exceeds context window
```

### Failure modes
1. **Token bloat:** Each tool's description + inputSchema consumes ~150-300 tokens. 400 tools = 60K+ tokens consumed before the agent even starts thinking.
2. **Tool confusion:** Claude's attention mechanism degrades with too many tools. Similar tool names (e.g., `queryTransactions`, `listPayments`, `getSubscription`) cause misrouting.
3. **Attention degradation:** The model's effective tool selection accuracy drops significantly above ~50 tools.
4. **Maintenance burden:** Each new tool requires updates to inline-tools.ts, the static manifest, and the chat route — 3 touch points per tool.

---

## Recommended Architecture: Pattern A — Documentation-Driven Runtime

### Core principle
**The file system IS the extended brain.** Instead of loading 400 tools into context, load one gatekeeper tool that reads the right file on demand. The agent stays lean; the knowledge base stays rich.

### 5 Gatekeeper Tools

| # | Tool | Purpose | Status |
|---|------|---------|--------|
| 1 | `load_skill` | Read skill/playbook content on demand from the VPS file system | ✅ **UF2 deployed** |
| 2 | `view_file` | Read any file from the VPS file system (code, config, docs) | 🔜 U2 |
| 3 | `execute_skill` | Run a skill's TypeScript tool with typed input/output | 🔜 U2 |
| 4 | `list_playbooks` | Discover available playbooks by category (connectors, capabilities, orgs) | 🔜 U2 |
| 5 | `spawn_v2` / `self_code` | Hand off complex tasks to Neptune V2 sandbox (already exists) | ✅ Exists |

### File System Structure

```
skills/
├── connectors/
│   ├── slack/
│   │   ├── SKILL.md              # What this connector does, auth, anti-patterns
│   │   ├── playbook-slack.md     # Operational playbook: when to use each tool
│   │   ├── tools/
│   │   │   ├── postMessage.ts    # Each tool is a standalone TS file with z.object schema
│   │   │   ├── pullMessages.ts
│   │   │   ├── listChannels.ts
│   │   │   ├── searchChannels.ts
│   │   │   └── reactionAdd.ts
│   │   └── docs/
│   │       └── rate-limits.md    # Documentation for the connector's constraints
│   ├── nmi/
│   │   ├── SKILL.md
│   │   ├── playbook-nmi.md
│   │   └── tools/
│   │       ├── queryTransactions.ts
│   │       ├── refund.ts
│   │       ├── getVault.ts
│   │       └── getSubscription.ts
│   ├── github/
│   ├── vercel/
│   ├── base44/
│   └── ... (14 connectors)
├── capabilities/
│   ├── self-coding/
│   │   ├── SKILL.md
│   │   └── tools/
│   ├── sandbox/
│   └── workflow/
├── organizations/
│   └── newleaf-financial/
│       ├── customer-support/
│       │   ├── SKILL.md
│       │   └── playbook.md
│       └── billing/
│           ├── SKILL.md
│           └── playbook.md
└── NEPTUNE.md                    # Master traffic controller (40 lines max)
```

### How it works (conversation flow)

```
User: "Process a refund for transaction 12345"

Agent (thinking):
  1. I need NMI refund details → call load_skill("connectors/nmi")
  2. Receives: NMI SKILL.md + playbook + tools_available: [queryTransactions, refund, getVault, getSubscription]
  3. I need to execute the refund → call execute_skill({skill: "connectors/nmi", tool: "refund", params: {transactionId: "12345"}})
  4. Tool executes npm run skill connectors/nmi/tools/refund.ts --transactionId 12345
  5. Returns result: {success: true, refundId: "ref_67890"}

Total tools in context: 3 (load_skill + execute_skill + the result)
Total tokens: ~1K (vs ~8K if all NMI tools were preloaded)
```

### Tasklet AI Vibe (Skill-Author Capability)

The defining feature of Pattern A: **Neptune can WRITE new skills.**

```
User: "Add a new Stripe connector"

Agent (via selfCode + execute_skill):
  1. Creates skills/connectors/stripe/SKILL.md
  2. Creates skills/connectors/stripe/playbook-stripe.md
  3. Creates skills/connectors/stripe/tools/createPaymentIntent.ts
  4. Creates skills/connectors/stripe/tools/refund.ts
  5. Updates skills/NEPTUNE.md: adds "| stripe | connectors/stripe | createPaymentIntent, refund | ✅ |"

File system is self-documenting. Playbook MD tells other agents where to find scripts:
  "For Stripe payments, execute node skills/connectors/stripe/tools/createPaymentIntent.js --amount <amount>"
```

---

## Migration Path (U2 PRD)

### Phase 1: Gatekeeper Deployment (Week 1)
- `view_file` tool — read any VPS file
- `list_playbooks` tool — discover playbooks
- Move existing connector tools from inline-tools.ts → skills/connectors/<name>/tools/*.ts
- Each connector gets SKILL.md + playbook-<name>.md

### Phase 2: execute_skill Runtime (Week 2)
- `execute_skill` tool — run any skill tool by path + params
- Node.js child_process or V2 sandbox execution
- Zod schema validation on input/output
- Error handling + retry logic

### Phase 3: Skill-Author Capability (Week 3)
- selfCode integration: Neptune writes new skills autonomously
- Template scaffolding for new connectors
- Playbook MD auto-generation
- NEPTUNE.md auto-update on skill creation

### Phase 4: Dynamic Registry Removal (Week 4)
- Remove static tool manifest (app/api/tools/route.ts hardcoded list)
- Remove TOOL_REQUIREMENTS map
- Replace getAvailableTools() with gatekeeper-only registry
- System prompt rewrites to Pattern A

---

## Trade-off Analysis

| Dimension | Current (Big Array) | Pattern A (Gatekeeper) |
|-----------|-------------------|----------------------|
| **Context efficiency** | 60K tokens (400 tools) | <2K tokens (5 gatekeepers) |
| **Tool selection accuracy** | Degrades above 50 tools | Always accurate (5 tools) |
| **Scalability** | Hard cap at ~100 tools | Unlimited (file system) |
| **New tool deployment** | 3 files to edit | 1 file to create |
| **Skill discoverability** | Agent sees all tools | Agent must call list_playbooks |
| **Latency** | Instant tool selection | +1 file read per unknown skill (~200ms) |
| **Self-documentation** | None | Every skill is self-documenting |
| **Skill-author capability** | Not possible | Built into the architecture |
| **Maintenance** | High (3 touch points) | Low (file system is source of truth) |

---

## U1→U2 Handoff Checklist

- [x] U1.1: Query fatigue safeguards
- [x] U1.2: V2 handoff resilience
- [x] U1.3: 14 connectors audited, 57/404 wrapped
- [x] UF1: Secrets server live, 10 migrations done
- [x] UF2: load_skill tool (first gatekeeper) deployed
- [x] UF3: This document — bridging U1 to U2

**U2 PRD:** should start with this document as its architecture section. The PRD will detail the exact implementation of view_file, execute_skill, list_playbooks, and the file system migration of all 57 wrapped tools.

---

## Appendix: load_skill Tool (First Gatekeeper — Deployed)

The `load_skill` tool deployed in UF2 is the first gatekeeper for Pattern A:

- **Input:** `skill_path` (e.g., `connectors/slack`, `organizations/newleaf-financial/billing`)
- **Resolution:** 5 path conventions → tries SKILL.md + playbook.md + .md variants
- **Output:** name, description, content (capped 15KB), tools_available list, sources
- **Bridge:** VPS FS bridge at secrets.vps.fsBridgeUrl
- **Fallback:** On miss, lists available skills for the agent to retry

This tool alone reduces the need to preload connector-specific knowledge. The remaining gatekeepers will complete the Pattern A architecture.

---

**Next action:** Write U2 PRD using this document as the architecture foundation. The PRD should specify:
1. Exact implementation of view_file, execute_skill, list_playbooks
2. File system migration plan for all 57 wrapped tools
3. NEPTUNE.md format specification (40 lines max)
4. Skill-author capability design
5. System prompt rewrite for Pattern A
6. Removal plan for the static tools array

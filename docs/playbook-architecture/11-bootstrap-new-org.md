---
title: "11 — Bootstrap New Organization"
version: "1.0.0"
last_updated: "2026-06-15"
owner: "playbook-skills meta-skill"
status: ACTIVE
kb_index: 11
---

# 11 — Bootstrap New Organization

Complete setup ritual for bootstrapping the playbook architecture in a new organization.

## Prerequisites

- [ ] Next.js project with AI SDK 6+
- [ ] Vercel AI Gateway Pro access (or direct API keys)
- [ ] At least one connector set up (Base44 recommended as entity store)
- [ ] NEPTUNE.md at project root

## Bootstrap Ritual (11 Steps)

### Step 1: Clone the Fractal Structure

```bash
mkdir -p connectors/neptune/skills/native-agent-skills/ai-agent-sdk/functions
mkdir -p connectors/neptune/skills/custom-skills/playbook-skills/{functions,playbooks,workflows}
```

### Step 2: Copy the Meta-Skill

```bash
cp -r <source-org>/connectors/neptune/skills/custom-skills/playbook-skills/ \
      connectors/neptune/skills/custom-skills/playbook-skills/
```

### Step 3: Install Core Functions

Create these minimum functions or copy from source:

| Function | Purpose | Required? |
|----------|---------|-----------|
| `route-intent.ts` | Match user input to playbook | ✅ YES |
| `session-start-handler.ts` | Initialize session context | ✅ YES |
| `session-end-handler.ts` | Log outcomes, trigger evolution | ✅ YES |
| `create-playbook.ts` | Scaffold new playbooks | Recommended |
| `update-playbook.ts` | Modify existing playbooks | Recommended |
| `organize-knowledge-graph.ts` | Wiki integration | Optional |

### Step 4: Create Foundation Playbooks

Create these minimum playbooks:

```bash
# P0 (Critical)
touch playbook-skills/playbooks/playbook-billing.md
touch playbook-skills/playbooks/playbook-support.md

# P1 (Important)
touch playbook-skills/playbooks/playbook-engineering.md
touch playbook-skills/playbooks/playbook-deploy.md

# META
touch playbook-skills/playbooks/playbook-index.md
```

Fill each with YAML frontmatter + SOP template using `create-playbook.ts`.

### Step 5: Write the Router

Create `PLAYBOOK-ROUTER.md` with:
- Fractal library MAP (~500 tokens)
- Intent → Playbook table (start with 5-10 routes)
- Cardinal rules
- Anti-patterns

### Step 6: Update NEPTUNE.md

```
1. **Read** `connectors/neptune/skills/custom-skills/playbook-skills/PLAYBOOK-ROUTER.md` FIRST
```

### Step 7: Wire Up load-skill Tool

Update `lib/ai/tools/load-skill.ts` to resolve fractal paths:
```
playbooks/<domain> → playbook-skills/playbooks/playbook-<domain>.md
playbook-skills → PLAYBOOK-ROUTER.md
```

### Step 8: Register Tools in Chat Route

In `app/(chat)/api/chat/route.ts`:
```typescript
import { loadSkill } from "@/lib/ai/tools/load-skill";
// Add to tools object
const normalTools = {
  loadSkill,
  // ... other tools
};
```

### Step 9: Set Up Knowledge Graph

```bash
# Create wiki and knowledge endpoints
mkdir -p app/api/wiki/{ingest,search,entity}
mkdir -p app/api/knowledge/extract
mkdir -p app/api/raw-logs/query

# Initialize with base entities
POST /api/wiki/ingest → playbook-skills
POST /api/wiki/ingest → each playbook
```

### Step 10: Set Up Self-Evolution

- Wire `session-end-handler.ts` to chat route's `onFinish` hook
- Set up cron for `/api/knowledge/extract` (hourly)
- Set up cron for `/api/cron/refinement-loop` (daily)
- Verify the cycle: log → extract → wiki → refine

### Step 11: Create KB Documentation

```bash
mkdir docs/playbook-architecture/
# Create 12 docs (clone from source org or generate fresh)
```

Triple-mirror:
1. `docs/playbook-architecture/` (repo)
2. `jarvis/cortex/playbook-architecture/` (cortex)
3. `app/(chat)/playbook-architecture/page.tsx` (Chat page)

## Verification Checklist

- [ ] `pnpm build` passes with 0 TS errors
- [ ] `routeIntent("charge a customer")` returns playbook-billing.md
- [ ] `loadSkill({ skill_path: "playbooks/billing" })` loads playbook
- [ ] Session end writes to `/api/raw-logs`
- [ ] Knowledge extraction creates wiki entities
- [ ] Chat route routes intents through PLAYBOOK-ROUTER.md
- [ ] NEPTUNE.md points to correct router path

## Minimum Viable Playbook Set

For a new org to be functional, create these playbooks:

| Priority | Playbook | Why |
|----------|----------|-----|
| P0 | playbook-support.md | Customer inquiries are inevitable |
| P0 | playbook-engineering.md | Code changes are the primary activity |
| P1 | playbook-deploy.md | Shipping is critical |
| P1 | playbook-planning.md | Planning reduces rework |
| META | playbook-index.md | Fallback for unknown intents |

## Bootstrap Time Estimate

| Step | Time |
|------|------|
| Clone structure | 5 min |
| Copy meta-skill | 5 min |
| Create foundation playbooks | 15 min |
| Write router | 20 min |
| Wire up tools | 15 min |
| Set up knowledge graph | 15 min |
| Set up self-evolution | 10 min |
| Create KB docs | 5 min (clone) |
| **Total** | **~90 min** |

---

*Phase 21 V3 — Fractal Library + Router-as-Map*

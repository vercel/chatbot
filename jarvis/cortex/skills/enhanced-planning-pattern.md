# Enhanced Planning Pattern — CORE INNOVATION

**Status:** LOCKED — Permanent architectural pattern
**Created:** 2026-06-17
**Insight by:** User (Command Center draft → VPS enhance → execute)
**Scope:** All future mission execution

---

## 1. THE PATTERN (LOCK FOREVER)

```
CURRENT FLAWED PATTERN:
  Quick plan (2 min) → Code 30 min → Mistakes → Replan → Recode = BAD

ENHANCED PLANNING PATTERN:
  Jarvis CC (2-5 min draft) → VPS Enhance (10-15 min) → Human Approve (optional)
  → VPS Execute (multi-hour) → Slack Land = BETTER

WHY:
  - 10-15 min of pre-execution research prevents 30+ min of rework
  - VPS has cognitive context — researches deeper, checks alternatives
  - Better plan → fewer mistakes → less replanning → faster delivery
  - VPS can query knowledge graph, read skills, check prior art
  - Enhanced plan includes exact budget, rollback, acceptance criteria
```

---

## 2. STEP-BY-STEP IMPLEMENTATION

### STEP 1: JARVIS DRAFT (Command Center, 2-5 min)

**Who:** Jarvis (Command Center / Chat agent)
**What:** Drafts initial PRD/TRD/Implementation Plan skeleton

```yaml
Input: User describes goal ("build autonomous coding platform")
Action:
  1. Draft PRD skeleton in jarvis/cortex/prd/
  2. Draft Implementation Plan skeleton
  3. Identify domain from V5 domain architecture
  4. Load relevant playbook (domain/playbook.md)
  5. Dispatch as cortex-payload to VPS via create_task
  6. Post Slack: "Plan draft ready — dispatching to VPS for enhancement"
Output:
  - PRD draft path (e.g., jarvis/cortex/prd/PHASE-38-PRD-draft.md)
  - Implementation Plan draft path
  - Mission ID from jarvisTaskManager
  - Slack notification with mission link
```

### STEP 2: VPS ENHANCEMENT (5-15 min)

**Who:** VPS agent (Claude SDK via claudeAgentBridge)
**What:** Deep research + plan enhancement

```yaml
Input: PRD draft + Implementation Plan draft (from Step 1)

Enhancement Actions:
  A. Read ALL relevant skills
     - Query cortex graph for related PRDs, skills, memories
     - Read domain playbook (Section 1: Context, Section 2: Tools)
     - Load NKS v1.0 spec for compliance

  B. Deep research
     - Query code graph for existing implementations
     - Check Eve compatibility patterns
     - Search for prior art in knowledge graph
     - Query ChromaDB for semantic matches

  C. Check alternative approaches
     - Are there simpler ways to achieve the goal?
     - What would Eve do? What would we do better?
     - Can we reuse existing components vs building new?

  D. Identify anticipated pitfalls
     - What usually breaks in this domain?
     - Cardinal rule violations to watch for
     - Integration points that are fragile
     - Tool budget overruns common here?

  E. Review architecture
     - Does this fit V5 Domain-Driven Architecture?
     - Which connectors/hooks/subagents are affected?
     - Are there circular dependencies?

  F. Add missing acceptance criteria
     - At least 10 specific, measurable ACs
     - Include rollback ACs
     - Include performance ACs (build time, response time)
     - Include Eve compatibility where applicable

  G. Estimate accurate tool budget
     - Calculate per-stream token budget
     - Add 20% buffer for unexpected
     - Estimate wall-clock time
     - Factor in model costs

  H. Write ENHANCED PRD back to cortex
     - jarvis/cortex/prd/<NAME>-ENHANCED.md
     - Includes: research findings, alternatives considered, pitfalls, enhanced ACs, budget

  I. Propose execution plan
     - Start/continue/abort decision
     - If continue: explicit budget, timeline, rollback strategy
     - If abort: documented reason, alternative approach

Output:
  - Enhanced PRD in cortex
  - Execution recommendation (start/continue/abort)
  - Slack: "Enhanced plan ready — review at /missions/{id}/plan-review"
```

### STEP 3: HUMAN APPROVAL (Optional, via /missions UI)

**Who:** Human operator
**What:** Review enhanced plan, approve/modify/reject

```yaml
UI: /missions/[id]/plan-review

Shows:
  - Original draft vs enhanced plan (side by side)
  - Research findings summary
  - Alternatives considered
  - Pitfalls identified
  - Enhanced acceptance criteria
  - Budget estimate (tokens + time)
  - Rollback strategy
  - Files that will be created/modified

Actions:
  - [Approve & Execute] → Starts Step 4
  - [Modify] → Edit acceptance criteria, add/remove streams
  - [Reject] → Mission cancelled, learning captured
  - [Re-draft] → Back to Step 1 with feedback

Slack: "Plan approved — executing" or "Plan rejected — learning captured"
```

### STEP 4: VPS EXECUTION (Multi-hour)

**Who:** VPS agent (autonomous mission runner)
**What:** Execute the EXCELLENT plan

```yaml
Input: Enhanced PRD + Execution approval

Execution:
  - Uses MissionRunner from lib/autonomous-mission/runner.ts
  - Parse enhanced PRD via parsePrdToPlan()
  - Execute streams sequentially with checkpoint support
  - Automatic build verification after each commit
  - Deploy on completion (if autoDeploy enabled)
  - Slack notifications at stream boundaries
  - Real-time progress via /api/missions/{id}/stream (SSE)

Output:
  - Committed code in feature branch
  - Vercel deploy URL (if autoDeploy)
  - Mission summary in Slack
  - Deploy receipt card in Chat
```

---

## 3. IMPLEMENTATION COMPONENTS

### 3.1 JarvisDraftPRD (Formalize existing)
**File:** Already exists — the PRD drafting flow is part of Chat's tool set.
**Enhancement needed:**
- Add `dispatchToVPS()` step after draft
- Add mission ID generation
- Add Slack notification template

### 3.2 VPSPlanEnhancer (NEW)
**File:** `lib/autonomous-mission/plan-enhancer.ts`
**Mission type:** `PLAN_ENHANCEMENT` (new mission status)
**Implementation:**
```ts
export async function enhancePlan(prdPath: string): Promise<EnhancedPlan> {
  // 1. Read draft PRD
  // 2. Load relevant skills from cortex
  // 3. Query knowledge graph for prior art
  // 4. Check Eve compatibility
  // 5. Identify pitfalls
  // 6. Estimate accurate budget
  // 7. Write enhanced PRD
  // 8. Return execution recommendation
}
```

### 3.3 PlanReviewUI (NEW)
**File:** `app/(harness)/missions/[id]/plan-review/page.tsx`
**UI Components:**
- Side-by-side draft vs enhanced view
- Research findings accordion
- Acceptance criteria checklist
- Budget visualization
- Approve/Modify/Reject buttons
- Live SSE connection for status updates

### 3.4 DispatchWithEnhancement (NEW)
**File:** `app/api/missions/draft/route.ts`
**API Route:** `POST /api/missions/draft`
**Flow:**
1. Accept PRD draft path or inline content
2. Create mission record with status `DRAFT`
3. Trigger VPS enhancement (fire-and-forget)
4. Return mission ID + plan-review URL

### 3.5 Slack Notification Templates
```
Plan draft ready:
  📝 *Plan Draft Ready*
  📋 {prd_name}
  🔄 Dispatching to VPS for enhancement...
  👀 /missions/{id}/plan-review

Enhancing on VPS:
  🔬 *Enhancing Plan*
  📋 {prd_name}
  Researching: skills, prior art, alternatives, pitfalls...
  ⏳ ~{estimated_minutes}min

Enhanced plan ready:
  ✨ *Enhanced Plan Ready*
  📋 {prd_name}
  ✅ {acceptance_criteria_count} acceptance criteria
  💰 {estimated_tokens}t budget
  🔗 /missions/{id}/plan-review

Executing:
  🚀 *Executing*
  📋 {prd_name}
  📊 {total_streams} streams · {total_steps} steps
  🔗 /missions/{id}
```

---

## 4. COMPARISON: ENHANCED vs CURRENT

| Aspect | Current (Jarvis Only) | Enhanced (Jarvis + VPS) |
|--------|----------------------|------------------------|
| Planning time | 2 min | 2 min (draft) + 12 min (enhance) = 14 min |
| Research depth | Surface-level | Deep: KG, skills, alternatives, pitfalls |
| Budget accuracy | Rough estimate | Accurate with 20% buffer |
| Acceptance criteria | 2-3 generic | 10+ specific, measurable, with rollback |
| Mistake rate | High (30 min fixes) | Low (plan catches issues) |
| Total delivery time | 32+ min (plan+code+fix) | 14 min plan + 20 min code = 34 min |
| Quality | Variable | Consistently higher |
| Replanning needed | Frequently | Rarely |

**Bottom line:** Same total time for simple tasks, WAY better for complex tasks. The 12-minute enhancement pays for itself by preventing 30+ minutes of rework.

---

## 5. EVE ALIGNMENT

The enhanced planning pattern aligns with Eve's architecture:
- **Plan PRD = Eve's `instructions.md`**: Both define WHAT the agent should do
- **Enhanced PRD = Eve's compiled manifest**: Both add detail before execution
- **Step 2 Enhancement = Eve's build step**: Research + validation before execution
- **Step 4 Execution = Eve's runtime**: Execute the plan with durability

The key innovation is making the ENHANCEMENT step a first-class, observable, interruptible phase — not an implicit build step.

---

*Core innovation part of EVE ALIGNMENT + VALIDATION RECOVERY MASTER mission*
*Date: 2026-06-17*
*Author: abhiswami2121@gmail.com*

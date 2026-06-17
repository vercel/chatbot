---
type: prd
name: "Autonomous Coding Platform PRD v1.0"
description: "Full PRD for Neptune Chat autonomous coding platform — dispatch sprints from PRDs, execute without human intervention, beautiful UI with robust orchestration"
version: "1.0.0"
updated: "2026-06-17"
access: internal
priority: P0
domain: platform
tags: [autonomous, coding, prd, platform, missions, self-coding]
state: stable
---

# AUTONOMOUS CODING PLATFORM — PRD v1.0

**Author:** Hermes V5 Agent | **Date:** 2026-06-17 | **Budget:** 35,000 tokens
**Dependencies:** Phases 34-37 (Knowledge Layer, Twenty CRM, NKS, OKF)
**Target:** Neptune Chat + V2 — full autonomous coding capability matching VPS agent

---

## 1. Executive Summary

### 1.1 The Problem

The VPS agent (this Claude agent running on the VPS) can autonomously: read a PRD → plan → execute → commit → test → deploy → post to Slack. This is proven capability. But the experience is CLI-only, text-stream-driven, with no beautiful UI, no real-time progress visualization, no intervention controls, no cross-session memory, and no structured observability.

Neptune Chat currently handles conversational AI well but cannot dispatch autonomous coding missions. Users must manually copy-paste PRDs or hand-hold the agent through every step.

### 1.2 The Goal

**Neptune Chat + V2 becomes an autonomous coding platform** — matching or exceeding VPS agent capability while adding:

1. **Beautiful UI** — MissionCard with live progress bars, StreamProgress per-stream, DeployTimeline, SlackPreview
2. **Robust orchestration** — Playbook-First execution, Twin View toggle, sequential streams with checkpoint/rollback
3. **User intervention** — Pause, inject instructions, change branch, abort at any step
4. **Production observability** — Linear ticket lifecycle, Slack auto-landing, commit-to-deploy timeline
5. **Cross-session memory** — Missions persist across sessions, context is reloadable
6. **Real-time streaming** — SSE progress events, live code preview, deploy status watcher

### 1.3 The Outcome

User opens Neptune Chat, pastes a PRD, clicks "Dispatch Mission." Neptune:
1. Parses the PRD into execution plan (streams, steps, dependencies)
2. Creates a Git branch
3. Executes each stream sequentially — writing code, running tests, committing
4. Deploys to Vercel
5. Verifies the live URL
6. Posts comprehensive summary to Slack
7. Updates Linear ticket

**The user watches live progress in a beautiful UI and can intervene at any time.**

---

## 2. Capability Mapping — VPS Agent vs Neptune

| Capability | VPS Agent (Current) | Neptune (Target) |
|-----------|---------------------|-------------------|
| PRD → execution plan | ✅ Via LLM reasoning | ✅ PRD parser → structured JSON plan |
| Code generation | ✅ Sequential streams | ✅ Stream coordinator with steps |
| File operations | ✅ Read/Write/Edit | ✅ Code editor + MCP bridge |
| Git operations | ✅ branch/commit/push | ✅ Git ops with signing |
| Testing | ✅ Run tests | ✅ Sandbox executor + test runner |
| Deploy | ✅ Vercel deploy trigger | ✅ Deploy watcher with status |
| Live verification | ✅ curl URL check | ✅ Live URL browser test |
| Slack landing | ✅ Manual post | ✅ Auto-comprehensive with links |
| UI | ❌ CLI only | ✅ Beautiful MissionCard + StreamProgress |
| Progress visualization | ❌ Text stream | ✅ Live progress bars + DeployTimeline |
| User intervention | ❌ None (kill switch only) | ✅ Pause/Inject/Abort at any step |
| Cross-session memory | ❌ Ephemeral | ✅ Persistent mission log (NKS log.md) |
| Playbook integration | ✅ Manual reference | ✅ Auto-loaded playbooks drive execution |
| Knowledge graph | ✅ Manual query | ✅ KG auto-queried for prior art |
| Linear integration | ❌ Manual | ✅ Ticket lifecycle automation |
| Observability | ❌ None | ✅ /admin/observability dashboard |
| Error recovery | ❌ Manual restart | ✅ Checkpoint/rollback/retry |

---

## 3. Architecture Overview

### 3.1 System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Neptune Chat UI                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │MissionCard│ │StreamProg│ │LivePreview│ │DeployTimeln│ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘ │
│       │            │            │              │         │
│  ┌────┴────────────┴────────────┴──────────────┴──────┐ │
│  │              InterventionPanel                      │ │
│  │      [Pause] [Inject Instructions] [Abort]          │ │
│  └────────────────────────┬───────────────────────────┘ │
└───────────────────────────┼─────────────────────────────┘
                            │ SSE Stream
┌───────────────────────────┼─────────────────────────────┐
│              Mission Runner (Server)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │PRD Parser│ │StreamCoord│ │Git Ops   │ │DeployWatch│  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│       │            │            │              │         │
│  ┌────┴────────────┴────────────┴──────────────┴──────┐ │
│  │              Sandbox Executor                       │ │
│  │    Vercel Sandbox → Run code → Capture output       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │              Knowledge Layer                        │ │
│  │   Playbooks → Skills → KG → Memory → NKS log.md    │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Core Components

| Component | File | Responsibility |
|-----------|------|----------------|
| **MissionRunner** | `lib/autonomous-mission/runner.ts` | Orchestrates PRD→execution→completion |
| **PRDParser** | `lib/autonomous-mission/prd-parser.ts` | Parses PRD markdown → structured execution plan |
| **StreamCoordinator** | `lib/autonomous-mission/stream-coordinator.ts` | Manages sequential stream execution |
| **SandboxExecutor** | `lib/autonomous-mission/sandbox-executor.ts` | Executes code in sandbox, captures output |
| **GitOps** | `lib/autonomous-mission/git-ops.ts` | Branch, commit, push, PR creation |
| **DeployWatcher** | `lib/autonomous-mission/deploy-watcher.ts` | Trigger deploy, watch status, verify URL |
| **CheckpointManager** | `lib/autonomous-mission/checkpoint.ts` | Save/restore state, enable rollback |
| **SSEStreamer** | `app/api/missions/[id]/stream/route.ts` | Real-time SSE event stream to UI |

---

## 4. PRD Parser — Markdown to Execution Plan

### 4.1 Input Format

PRDs follow the standard NKS format:

```markdown
---
type: prd
name: "Feature X"
description: "Build feature X"
version: "1.0.0"
updated: "2026-06-17"
priority: P0
streams:
  - name: "Core implementation"
    budget: 5000
    order: 1
  - name: "Testing + QA"
    budget: 3000
    order: 2
---

# Feature X

## Stream 1: Core Implementation (5000t)
- Create file X
- Implement function Y
- Add tests

## Stream 2: Testing + QA (3000t)
- E2E tests
- Build verification

## Acceptance Criteria
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Deploy verified

## Cardinal Rules
- NO sub-agents
- Commit after each stream
- Author: abhiswami2121@gmail.com
```

### 4.2 Parsed Output

```typescript
interface ExecutionPlan {
  missionId: string;
  prdName: string;
  streams: StreamPlan[];
  acceptanceCriteria: string[];
  cardinals: CardinalRule[];
  estimatedTotalTokens: number;
}

interface StreamPlan {
  id: string;
  name: string;
  budget: number;
  order: number;
  steps: ExecutionStep[];
  dependsOn: string[];
}

interface ExecutionStep {
  type: "create_file" | "edit_file" | "run_test" | "run_build" | "commit" | "deploy" | "verify";
  description: string;
  filePath?: string;
  expectedOutput?: string;
}
```

### 4.3 PRD → Plan Algorithm

1. Extract YAML frontmatter (streams, priority, tags)
2. Parse markdown body by `## Stream N:` headings
3. Convert bullet points to execution steps
4. Extract acceptance criteria (checkbox lists under `## Acceptance`)
5. Extract cardinal rules (under `## Cardinal`)
6. Resolve dependencies between streams
7. Validate: all steps map to known action types
8. Output: `ExecutionPlan` JSON

---

## 5. Mission Runner — Core Orchestrator

### 5.1 Flow

```
1. User clicks "Dispatch Mission" or sends PRD in chat
2. PRD Parser → ExecutionPlan
3. MissionRunner initializes:
   a. Creates mission record (DB row)
   b. Creates Git branch: feat/auto-{mission-id}
   c. Loads relevant playbooks + skills from KG
   d. Sends "MISSION_STARTED" SSE event
4. For each stream (sequential):
   a. Checkpoint current state
   b. Report "STREAM_STARTED" to UI
   c. Execute steps sequentially
   d. After each step, report progress
   e. Commit after stream completes
   f. Report "STREAM_COMPLETE" to UI
   g. If error: rollback to checkpoint, report "STREAM_FAILED"
5. After all streams:
   a. Run build: `pnpm build`
   b. If build fails: fix, retry (up to 3x)
   c. Push to origin
   d. Create PR (optional, configurable)
   e. Trigger Vercel deploy
   f. Watch deploy status
   g. Verify live URL
   h. Post to Slack
   i. Update Linear ticket
   j. Write mission log to NKS log.md
   k. Report "MISSION_COMPLETE" to UI
```

### 5.2 State Machine

```
PROPOSED → PARSING → PLANNING → EXECUTING → DEPLOYING → VERIFYING → COMPLETE
                ↓         ↓           ↓            ↓           ↓
              FAILED   FAILED     PAUSED       FAILED      FAILED
                                    ↓
                                RESUMING → back to EXECUTING
                                    ↓
                                ABORTED
```

### 5.3 Intervention API

```typescript
// User can send these commands via the InterventionPanel
type InterventionCommand =
  | { type: "pause"; reason?: string }
  | { type: "resume" }
  | { type: "inject"; instruction: string }
  | { type: "skip_stream"; streamId: string }
  | { type: "retry_stream"; streamId: string }
  | { type: "change_branch"; branchName: string }
  | { type: "abort"; reason: string }
```

---

## 6. Three Execution Modes

### 6.1 LIVE Mode
- User opens mission detail page `/missions/[id]`
- Watches every step in real-time via SSE
- Can pause, inject instructions, or abort
- Best for: Critical features, learning/oversight

### 6.2 BACKGROUND Mode
- User dispatches via chat: "Run this PRD in background"
- Mission runs autonomously without UI connection
- Posts progress updates to Slack at each stream boundary
- User can open `/missions/[id]` to check status anytime
- Best for: Routine tasks, overnight runs

### 6.3 HYBRID Mode
- Runs autonomously until a blocker is encountered
- Blocker = build failure, test failure, ambiguous instruction
- Pauses and sends "BLOCKED" notification via Slack + in-app
- User unblocks via chat or InterventionPanel
- Resumes automatically after unblock
- Best for: Semi-autonomous work where human judgment needed occasionally

---

## 7. UI Components

### 7.1 MissionCard (Enhanced)

Existing `components/generative/mission-card.tsx` enhanced with:
- **Live status badge:** PROPOSED / EXECUTING / PAUSED / COMPLETE / FAILED
- **Progress bar:** Per-stream progress (completed/total steps)
- **Recent actions feed:** Latest 5 actions with timestamps
- **Elapsed time:** Live ticker showing mission duration
- **Click → Full mission detail page**

### 7.2 StreamProgress

New component `components/autonomous/stream-progress.tsx`:
- **Per-stream card:** Stream name, budget used/remaining, step count
- **Step timeline:** Vertical timeline with checkmarks/failures
- **Live code preview:** Shows file being written in real-time (diff view)
- **Output console:** Scrollable terminal showing build output, test results

### 7.3 LivePreview

New component `components/autonomous/live-preview.tsx`:
- Shows the code being written in real-time
- Syntax-highlighted diff view
- Left: before | Right: after
- Clean monospace font, dark theme

### 7.4 DeployTimeline

New component `components/autonomous/deploy-timeline.tsx`:
- Commit SHA → Build Started → Build Complete → Deploying → READY → Verified
- Each step with timestamp and status icon
- Green checkmark cascade on success
- Red X on failure with error message

### 7.5 SlackPreview

New component `components/autonomous/slack-preview.tsx`:
- Shows exactly what will be posted to Slack
- Preview card mimicking Slack message format
- "Post Now" button with confirmation
- Option to edit before posting

### 7.6 InterventionPanel

New component `components/autonomous/intervention-panel.tsx`:
- **Pause/Resume:** Big toggle button
- **Inject instructions:** Text area → Send
- **Skip stream:** "Skip Stream 3" button with confirmation
- **Change branch:** Input field for branch name
- **Abort:** Red "Abort Mission" button with double confirmation

---

## 8. Server Components

### 8.1 Mission Database Schema

```typescript
// lib/db/schema.ts — new table
export const missions = pgTable("missions", {
  id: text("id").primaryKey(),
  prdPath: text("prd_path").notNull(),
  prdName: text("prd_name").notNull(),
  status: text("status").notNull(), // PROPOSED | PARSING | PLANNING | EXECUTING | PAUSED | DEPLOYING | VERIFYING | COMPLETE | FAILED | ABORTED
  mode: text("mode").notNull(), // LIVE | BACKGROUND | HYBRID
  branch: text("branch"),
  currentStream: integer("current_stream").default(0),
  totalStreams: integer("total_streams").default(0),
  completedSteps: integer("completed_steps").default(0),
  totalSteps: integer("total_steps").default(0),
  executionPlan: jsonb("execution_plan"),
  checkpoints: jsonb("checkpoints"),
  deployUrl: text("deploy_url"),
  deployId: text("deploy_id"),
  commitSha: text("commit_sha"),
  slackTs: text("slack_ts"),
  linearIssueId: text("linear_issue_id"),
  error: text("error"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### 8.2 API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/missions` | POST | Create new mission (PRD path or inline PRD) |
| `/api/missions` | GET | List missions (with filter/status) |
| `/api/missions/[id]` | GET | Get mission detail + execution plan |
| `/api/missions/[id]/stream` | GET | SSE stream of live events |
| `/api/missions/[id]/control` | POST | Send intervention command |
| `/api/missions/[id]/events` | GET | Get event history |
| `/api/missions/[id]/log` | GET | Get mission log (NKS format) |

### 8.3 SSE Event Types

```typescript
type MissionEvent =
  | { type: "MISSION_STARTED"; missionId: string; plan: ExecutionPlan }
  | { type: "STREAM_STARTED"; streamId: string; streamName: string; stepCount: number }
  | { type: "STEP_STARTED"; streamId: string; step: ExecutionStep }
  | { type: "STEP_COMPLETE"; streamId: string; step: ExecutionStep; output: string }
  | { type: "STEP_FAILED"; streamId: string; step: ExecutionStep; error: string }
  | { type: "FILE_CREATED"; filePath: string; content: string }
  | { type: "FILE_EDITED"; filePath: string; diff: string }
  | { type: "BUILD_STARTED" }
  | { type: "BUILD_OUTPUT"; line: string }
  | { type: "BUILD_COMPLETE"; success: boolean; output: string }
  | { type: "COMMIT_CREATED"; sha: string; message: string }
  | { type: "PUSH_COMPLETE"; branch: string }
  | { type: "DEPLOY_TRIGGERED"; deployId: string }
  | { type: "DEPLOY_STATUS"; status: string; url?: string }
  | { type: "DEPLOY_READY"; url: string }
  | { type: "URL_VERIFIED"; url: string; statusCode: number }
  | { type: "SLACK_POSTED"; channel: string; ts: string }
  | { type: "LINEAR_UPDATED"; issueId: string }
  | { type: "STREAM_COMPLETE"; streamId: string }
  | { type: "CHECKPOINT_SAVED"; checkpointId: string }
  | { type: "PAUSED"; reason?: string }
  | { type: "RESUMED" }
  | { type: "ABORTED"; reason: string }
  | { type: "MISSION_COMPLETE"; summary: MissionSummary }
  | { type: "MISSION_FAILED"; error: string }
  | { type: "HEARTBEAT"; timestamp: string };
```

---

## 9. Execution Flow — Example

### User dispatches PRD "Add Dark Mode Toggle"

```
1. PRD Parser: 3 streams identified
   Stream 1: Theme context + styles (2000t)
   Stream 2: Toggle component + integration (2000t)
   Stream 3: Testing + deploy (1000t)

2. MissionRunner init:
   - Branch: feat/auto-dark-mode-20260617
   - Loads skill: vercel-react-best-practices
   - Loads playbook: vercel-discipline

3. STREAM 1 EXECUTION:
   Step 1: Create lib/theme/context.tsx ✅
   Step 2: Create lib/theme/styles.css ✅
   Step 3: Create lib/theme/provider.tsx ✅
   Step 4: Run build ✅
   Step 5: Commit "feat(theme): dark mode context + styles" ✅

4. STREAM 2 EXECUTION:
   Step 1: Create components/ui/theme-toggle.tsx ✅
   Step 2: Edit app/layout.tsx (wrap with ThemeProvider) ✅
   Step 3: Run build ❌ — Missing import
   Step 4: Auto-fix import ✅
   Step 5: Run build ✅
   Step 6: Commit "feat(theme): dark mode toggle + integration" ✅

5. STREAM 3 EXECUTION:
   Step 1: Run E2E tests ⏳ (33s)
   Step 2: Push to origin ✅
   Step 3: Trigger deploy ✅ (deploy_abc123)
   Step 4: Watch deploy... BUILDING → READY ✅
   Step 5: Verify https://neptune-chat.vercel.app ✅ (200)
   Step 6: Post Slack ✅ (C0AQDDC3HAB, ts: 1718123456.789)
   Step 7: Update Linear ✅ (NEP-142)

6. MISSION COMPLETE
   - 3/3 streams ✅
   - 11/11 steps ✅
   - Deploy: https://neptune-chat.vercel.app
   - Commit: a1b2c3d
   - Duration: 4m 22s

7. Slack landing:
   🚀 Autonomous Mission Complete
   📋 PRD: Add Dark Mode Toggle
   ✅ 3/3 streams · 11/11 steps · 4m 22s
   🔗 Deploy: https://neptune-chat.vercel.app
   📝 Commit: a1b2c3d
   🎫 Linear: NEP-142
```

---

## 10. Integration Architecture

### 10.1 NKS Integration

- **PRDs stored in NKS format:** `jarvis/cortex/prd/*.md` with YAML frontmatter
- **Skills auto-loaded:** MissionRunner queries KG for relevant skills by domain/tags
- **Playbooks drive execution:** playbook `steps` field maps to execution steps
- **Mission log written to NKS:** `jarvis/cortex/missions/log.md` updated on completion
- **Knowledge graph updated:** New skills/connectors created during mission are indexed

### 10.2 Twenty CRM Integration

- **Linear tickets:** Created at mission start, updated at each stream boundary, closed on completion
- **Customer context:** If mission references a customer, auto-load customer 360
- **Activity logging:** Mission events recorded in Twenty activity timeline

### 10.3 V2 Integration

- **Spawn coding agent:** `spawnCodingAgent({ prd: '...', mode: 'BACKGROUND' })` from V2
- **V2 reports back:** V2 SSE webhook reports progress that Chat UI renders
- **Shared mission state:** Both Chat and V2 read/write same mission DB row

### 10.4 Slack Integration

- **#jarvis-admin ONLY** (cardinal rule)
- **Mission started:** "🔧 Mission X started — PRD: Y"
- **Stream complete:** "✅ Stream N/N complete (M/N steps)"
- **Mission complete:** Comprehensive landing with commit SHA, deploy URL, duration
- **Mission failed:** "❌ Mission X failed at Stream N: error message"
- **Blocked (hybrid mode):** "⏸️ Mission X blocked — needs human: reason"

### 10.5 Linear Integration

- **Issue created:** At mission start with PRD link, estimated duration
- **Status updated:** IN PROGRESS when executing, IN REVIEW when deploy verified
- **Comment added:** At each stream boundary with progress summary
- **Issue closed:** On mission complete

---

## 11. Observability

### 11.1 `/admin/observability` Dashboard

```
┌────────────────────────────────────────────────────────┐
│  Active Missions (3)                                    │
│  ┌──────────────────────┐ ┌──────────────────────┐     │
│  │ Dark Mode Toggle     │ │ API Rate Limiter     │     │
│  │ Stream 2/3 · 67%     │ │ Stream 1/2 · 50%    │     │
│  │ Elapsed: 2m 14s      │ │ Elapsed: 5m 01s     │     │
│  │ Mode: LIVE           │ │ Mode: BACKGROUND     │     │
│  └──────────────────────┘ └──────────────────────┘     │
│                                                         │
│  Recent Commits + Deploys (last 24h)                    │
│  ┌──────────────────────────────────────────────────┐   │
│  │ a1b2c3d feat(theme): dark mode — Deployed ✅     │   │
│  │ d4e5f6g feat(api): rate limiter — Building ⏳    │   │
│  │ h7i8j9k fix(auth): token refresh — Deployed ✅   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  KG Health · Phase Progress · Build Status · Alerts     │
└────────────────────────────────────────────────────────┘
```

### 11.2 Metrics Tracked

| Metric | Source | Dashboard |
|--------|--------|-----------|
| Active missions | missions DB | Count + status |
| Mission duration | missions DB | Avg / p50 / p95 |
| Stream success rate | missions DB | % completed vs failed |
| Build success rate | Build log | % builds passing |
| Deploy frequency | Vercel API | Deploys per day |
| KG node count | Graphify | Live count |
| KG last sync | Graphify | Timestamp |
| KB size | Cortex dir | File count + total size |

---

## 12. Safety & Cardinal Rules

### 12.1 Hard Constraints (LOCKED)

1. **NO force push to main** — missions create branches, push, create PR (optional)
2. **Commit after every stream** — atomic, revertible units
3. **Build + typecheck before push** — `pnpm build && npx tsc --noEmit` must pass
4. **Author is `abhiswami2121@gmail.com`** — all commits signed with this email
5. **Slack #jarvis-admin only** — never post to any other channel
6. **NMI vault memory `6a1f118b` is sacred** — never read, write, or reference in generated code
7. **NO open-source release** — all code is proprietary until explicitly approved
8. **NO sub-agents in background** — sequential streams only (unless PRD explicitly allows)
9. **Live URL verification > local proof** — deploy must be verified with actual HTTP request

### 12.2 Rollback Protocol

1. If stream fails, rollback to last checkpoint
2. Checkpoint = Git stash or branch reset to last good commit
3. If build fails, auto-fix up to 3 attempts
4. If deploy fails, report error, don't retry (wait for human)
5. If Slack post fails, retry 3x with exponential backoff

---

## 13. Phased Rollout

### Phase 38a: Core Runner (this PRD)
- `lib/autonomous-mission/runner.ts` — core orchestrator
- `lib/autonomous-mission/prd-parser.ts` — PRD → plan
- `app/(harness)/missions/[id]/page.tsx` — mission detail page
- `app/api/missions/start/route.ts` — dispatch endpoint
- `app/api/missions/[id]/stream/route.ts` — SSE stream

### Phase 38b: Git + Deploy
- `lib/autonomous-mission/git-ops.ts` — branch, commit, push, PR
- `lib/autonomous-mission/deploy-watcher.ts` — trigger, watch, verify
- `lib/autonomous-mission/sandbox-executor.ts` — sandbox testing

### Phase 38c: UI Polish
- `components/autonomous/stream-progress.tsx`
- `components/autonomous/live-preview.tsx`
- `components/autonomous/deploy-timeline.tsx`
- `components/autonomous/slack-preview.tsx`
- `components/autonomous/intervention-panel.tsx`

### Phase 38d: Integrations
- `lib/autonomous-mission/slack-landing.ts` — auto Slack post
- `lib/autonomous-mission/linear-sync.ts` — ticket lifecycle
- `lib/autonomous-mission/nks-logger.ts` — mission log to NKS

### Phase 39: Background + Hybrid Modes
- Background execution queue
- Hybrid mode block/unblock flow
- `/admin/observability` dashboard

---

## 14. Acceptance Criteria

- [ ] User can paste a PRD in Chat and click "Dispatch Mission"
- [ ] MissionCard shows live progress with stream-by-stream updates
- [ ] Each stream executes steps sequentially with visible progress
- [ ] User can pause, inject instructions, and resume
- [ ] Git branch created, commits pushed, PR optionally created
- [ ] Build + typecheck passes before push
- [ ] Vercel deploy triggered, watched, and verified
- [ ] Comprehensive Slack landing posted to #jarvis-admin
- [ ] Linear ticket lifecycle managed (create → update → close)
- [ ] Mission log written to NKS log.md
- [ ] `/missions/[id]` page shows full mission detail
- [ ] `/admin/observability` shows all active missions
- [ ] Rollback works on stream failure
- [ ] Background mode posts Slack updates without UI connection
- [ ] Hybrid mode pauses on blocker and resumes after unblock
- [ ] All cardinal rules enforced (no main force-push, sacred vault, etc.)

---

## 15. Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| Phases 34-37 (Knowledge Layer) | ✅ Complete | KG, NKS, OKF all ready |
| NKS v1.0 spec | ✅ Published | Frontmatter format used by PRD parser |
| Graphify knowledge graph | ✅ Online | 21K nodes for skill discovery |
| V2 handoff | ✅ Operational | SSE bridge for V2→Chat communication |
| Twenty CRM | ✅ Integrated | Linear + customer context |
| Clerk auth | ✅ Configured | Mission dispatch auth-guarded |
| Vercel deploy | ✅ Working | Deploy watcher endpoint exists |
| Slack bridge | ✅ Working | Post to #jarvis-admin |

---

## 16. Risk Register

| Risk | Severity | Mitigation |
|------|----------|-----------|
| LLM generates broken code | HIGH | Build check after each stream; auto-fix retry (3x max) |
| Deploy breaks production | HIGH | Feature branches only; PR gate before merge to main |
| Infinite loop in autonomous mode | MEDIUM | Token budget enforcement per stream; 5-min timeout per step |
| Credentials leaked in generated code | HIGH | Secrets scan before commit; `.env` never committed |
| User confusion with UI | MEDIUM | InterventionPanel always visible; clear documentation |
| Mission state corruption | MEDIUM | Checkpoint before each stream; DB transactions |
| V2 session timeout | LOW | Session keepalive pings; resume from checkpoint |

---

## 17. Token Budget

| Stream | Content | Budget |
|--------|---------|--------|
| 4 (this doc) | Architecture PRD | 12,000t |
| 5 | Implementation (core runner) | 3,500t |
| 6 | V2 Enhancement | 2,500t |
| 7 | KG Update + Reindex | 2,500t |
| 8 | Twenty Testing | 2,500t |
| 9 | Phase 38-43 Prep | 2,500t |
| 10 | Observability Dashboard | 2,500t |
| 11 | Commit + Deploy + Slack Land | 2,500t |
| **Total** | | **30,500t** |

---

*PRD v1.0 completed 2026-06-17. Ready for implementation dispatch.*

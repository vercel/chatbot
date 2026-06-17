---
type: "design"
name: "MASTER DESIGN DOC V1.0"
description: "Auto-generated description for MASTER DESIGN DOC V1.0"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# MASTER DESIGN DOCUMENT v1.0

## Neptune Platform v1.0 — Design System & UI Specification

**Version:** 1.0.0
**Date:** 2026-06-17
**Type:** design
**Status:** ACTIVE
**Owner:** hermes
**Dependencies:** NEPTUNE-KNOWLEDGE-SPEC v1.0, MASTER-TRD v1.0
**Tags:** design, ui, ux, design-system, components, visual-language, mobile-first

---

## TABLE OF CONTENTS

1. [Design Language](#1-design-language)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Spacing & Grid](#4-spacing--grid)
5. [Component Library](#5-component-library)
6. [Knowledge Layer UX](#6-knowledge-layer-ux)
7. [Twenty CRM Extension UX](#7-twenty-crm-extension-ux)
8. [Chat Interface Design](#8-chat-interface-design)
9. [Responsive Strategy](#9-responsive-strategy)
10. [Animation & Motion](#10-animation--motion)
11. [Accessibility](#11-accessibility)

---

## 1. DESIGN LANGUAGE

### 1.1 Primary Language: iOS Liquid Glass

Per memory 6a29fe59, the Neptune design language follows **iOS Liquid Glass** principles with fintech benchmarks (Wise, Revolut, Ramp).

**Core Principles:**

| Principle | Implementation |
|-----------|---------------|
| **Depth** | Layered glass surfaces with backdrop-blur, elevation shadows, and translucency |
| **Fluidity** | Continuous animations, spring physics, 60fps transitions |
| **Clarity** | High contrast text, generous whitespace, clear hierarchy |
| **Focus** | One primary action per view, progressive disclosure of complexity |
| **Trust** | Fintech-grade polish — no jank, no errors, instant feedback |

### 1.2 Benchmark References

| Product | What We Borrow |
|---------|---------------|
| **Wise** | Clean data tables, money display, status badges |
| **Revolut** | Card-based layouts, quick actions, dark gradients |
| **Ramp** | Command palette, workflow automation UI, receipt scanning |
| **Linear** | Issue tracking, keyboard shortcuts, project views |
| **Vercel** | Dashboard cards, deployment previews, log streams |
| **Stripe** | Payment forms, subscription management, billing calendar |

### 1.3 Dark Theme Primary

Neptune is **dark-first**. All designs start in dark mode. Light mode is a secondary consideration.

```
Theme: Dark (primary)
Background: #0F172A (slate-900)
Surface:   #1E293B (slate-800)
Elevated:  #334155 (slate-700)
Border:    #475569 (slate-600) at 20% opacity
```

---

## 2. COLOR SYSTEM

### 2.1 Brand Palette

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| Brand Primary | `#14B8A6` | teal-500 | Primary buttons, links, active states |
| Brand Light | `#2DD4BF` | teal-400 | Hover states, highlights |
| Brand Dark | `#0D9488` | teal-600 | Pressed states, depth |
| Brand Muted | `#14B8A6` at 15% opacity | — | Subtle brand backgrounds |

### 2.2 Surface Colors (Dark)

| Token | Hex | Tailwind | z-index layer | Usage |
|-------|-----|----------|---------------|-------|
| Root Background | `#0F172A` | slate-900 | 0 | Main app background |
| Base Surface | `#1E293B` | slate-800 | 1 | Cards, panels |
| Elevated Surface | `#273449` | custom | 2 | Dropdowns, popovers |
| Overlay Surface | `#0F172A` at 80% | — | 10 | Modal backdrops |
| Glass Surface | `rgba(255,255,255,0.05)` | — | 5 | Glass cards, nav |

### 2.3 Text Colors

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| Text Primary | `#F8FAFC` | slate-50 | Body text, headings |
| Text Secondary | `#94A3B8` | slate-400 | Descriptions, labels |
| Text Tertiary | `#64748B` | slate-500 | Placeholders, disabled |
| Text Inverse | `#0F172A` | slate-900 | On brand/light backgrounds |
| Text Link | `#14B8A6` | teal-500 | Interactive text |
| Text Error | `#EF4444` | red-500 | Error messages |
| Text Success | `#22C55E` | green-500 | Success messages |

### 2.4 Status Colors

| Status | Hex | Tailwind | Usage |
|--------|-----|----------|-------|
| Success | `#22C55E` | green-500 | Completed, active, paid |
| Warning | `#F59E0B` | amber-500 | Pending, attention needed |
| Error | `#EF4444` | red-500 | Failed, overdue, critical |
| Info | `#3B82F6` | blue-500 | Information, neutral status |
| Neutral | `#64748B` | slate-500 | Inactive, archived, disabled |

### 2.5 Data Visualization Palette

```
Chart Colors (8-point):
1. #14B8A6 (teal)     — Primary metric
2. #3B82F6 (blue)     — Secondary metric
3. #8B5CF6 (violet)   — Tertiary metric
4. #F59E0B (amber)    — Warning metric
5. #EF4444 (red)      — Negative metric
6. #22C55E (green)    — Positive metric
7. #EC4899 (pink)     — Accent
8. #06B6D4 (cyan)     — Accent
```

---

## 3. TYPOGRAPHY

### 3.1 Font Stack

```css
/* UI Text */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Code */
--font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;

/* Fintech feel (optional) */
--font-display: 'Inter', 'SF Pro Display', system-ui;
```

### 3.2 Type Scale

| Token | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| `text-xs` | 0.75rem (12px) | 1rem | 400 | Badges, captions |
| `text-sm` | 0.875rem (14px) | 1.25rem | 400 | Body small, labels |
| `text-base` | 1rem (16px) | 1.5rem | 400 | Body text |
| `text-lg` | 1.125rem (18px) | 1.75rem | 500 | Card titles, inputs |
| `text-xl` | 1.25rem (20px) | 1.75rem | 600 | Section headers |
| `text-2xl` | 1.5rem (24px) | 2rem | 700 | Page titles |
| `text-3xl` | 1.875rem (30px) | 2.25rem | 700 | Hero headers |
| `text-4xl` | 2.25rem (36px) | 2.5rem | 800 | Landing headers |

### 3.3 Code Typography

```css
.code-block {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8125rem; /* 13px */
  line-height: 1.7;
  tab-size: 2;
}

.inline-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875em;
  padding: 0.125em 0.375em;
  background: rgba(255,255,255,0.06);
  border-radius: 4px;
}
```

---

## 4. SPACING & GRID

### 4.1 Base Spacing Scale

Based on 4px base unit:

| Token | Value | px | Usage |
|-------|-------|----|-------|
| `space-0` | 0 | 0px | No spacing |
| `space-1` | 0.25rem | 4px | Inline gaps, icon padding |
| `space-2` | 0.5rem | 8px | Tight gaps, between related items |
| `space-3` | 0.75rem | 12px | Component inner padding |
| `space-4` | 1rem | 16px | Standard gutter, card padding |
| `space-5` | 1.25rem | 20px | Section spacing |
| `space-6` | 1.5rem | 24px | Section padding, between sections |
| `space-8` | 2rem | 32px | Large section gaps |
| `space-10` | 2.5rem | 40px | Page-level spacing |
| `space-12` | 3rem | 48px | Hero spacing |
| `space-16` | 4rem | 64px | Major layout divisions |

### 4.2 Layout Grid

```css
/* Main content grid */
.content-grid {
  display: grid;
  grid-template-columns: 1fr min(768px, 100%) 1fr;
  /* Center column max 768px, full width on mobile */
  padding: 0 16px;
}

/* Dashboard grid */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

/* Detail grid (60/40 split) */
.detail-grid {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 24px;
}

/* Card grid (2-column) */
.card-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
```

### 4.3 Container Widths

| Breakpoint | Width | Usage |
|------------|-------|-------|
| Mobile | 100% (375px min) | Chat, Portal |
| Tablet | 640px max | Content pages |
| Desktop | 768px max | Chat main content |
| Wide | 1024px max | Dashboards, Twenty iframe |
| Full | 1280px max | Admin pages, roadmaps |

---

## 5. COMPONENT LIBRARY

### 5.1 MissionCard

```
┌────────────────────────────────────────┐
│ ● MISSION: OKF Export Generation       │
│ Status: ████████░░ 80%                 │
│ Phase: 34  │  Budget: 3,000t          │
│ Elapsed: 2h │  Remaining: ~1h         │
│                                         │
│ [Cancel]              [View Details →] │
└────────────────────────────────────────┘
```

**4 States:**
- `planned` — Outline, muted colors, "Dispatch" button
- `dispatched` — Subtle teal glow, progress 0%
- `in_progress` — Pulsing status dot, live progress bar, elapsed timer
- `completed` — Green check, summary stats, "View Results" link
- `failed` — Red border, error summary, "Retry" / "Post-Mortem" buttons

**Props:**
```typescript
interface MissionCardProps {
  mission: Mission;
  status: 'planned' | 'dispatched' | 'in_progress' | 'completed' | 'failed';
  progress: number; // 0-100
  elapsedMs: number;
  estimatedMs: number;
  onDispatch: () => void;
  onViewDetails: () => void;
  onCancel: () => void;
}
```

### 5.2 HandoffCard

```
┌────────────────────────────────────────┐
│ 🔀 HANDOFF: Billing Dashboard Build    │
│ To: V2 Coding Agent                    │
│ Repo: newleaf-financial                │
│ Branch: feat/billing-dashboard         │
│ Status: ██████████░░ 80%               │
│                                         │
│ Commits: 3  │  PR: #123 (open)         │
│ Deploy: ✓ neptune-chat.vercel.app      │
│                                         │
│ [Open PR]  [View Deploy]  [Details →]  │
└────────────────────────────────────────┘
```

**Props:**
```typescript
interface HandoffCardProps {
  sessionId: string;
  prompt: string;
  target: 'v2_coding_agent';
  repo: string;
  branch: string;
  status: 'spawning' | 'coding' | 'reviewing' | 'deploying' | 'completed' | 'failed';
  commits: number;
  prUrl?: string;
  deployUrl?: string;
}
```

### 5.3 QuickActionModals

```
Trigger: Button "Quick Actions" (⚡ icon)

Modal:
┌──────────────────────────┐
│ Quick Actions            │
├──────────────────────────┤
│ 📤 Send Payment Link     │
│ 💬 Send SMS              │
│ 📝 Add Note              │
│ 🎫 Create Ticket         │
│ ⚙️  Run Workflow         │
│ 📞 Trigger Call          │
│ 📧 Send Email            │
└──────────────────────────┘
```

**Props:**
```typescript
interface QuickActionModalProps {
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  actions: QuickAction[];
  onAction: (action: QuickAction) => void;
}

interface QuickAction {
  id: string;
  icon: string;
  label: string;
  type: 'payment_link' | 'sms' | 'note' | 'ticket' | 'workflow' | 'call' | 'email';
  disabled?: boolean;
  disabledReason?: string;
}
```

### 5.4 PresetCard

```
┌────────────────────────────────────────┐
│ ⚡ Billing Agent                       │
│ Full billing ops dashboard             │
│                                         │
│ Panels: Recovery │ Subscriptions │ Cal │
│ Skills: nmi, billing-flow, reporting   │
│                                          │
│ [Apply Preset]                          │
└────────────────────────────────────────┘
```

**Props:**
```typescript
interface PresetCardProps {
  name: string;
  description: string;
  icon: string;
  panels: string[];
  skills: string[];
  onApply: () => void;
}
```

### 5.5 MapView (Knowledge Graph)

```
┌──────────────────────────────────────────┐
│ 🔍 Search knowledge...       [Library ▼]│
├──────────────────────────────────────────┤
│                                          │
│    ●───────●      ●─────●               │
│    │        \    /       │               │
│    ●    ●────●──●──●     ●              │
│    │    │     \/   │     │               │
│    ●────●      ●    ●────●               │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │ billing-flow/SKILL.md           │    │
│  │ type: skill | domain: billing   │    │
│  │ v2.3.0 | nmi, slack             │    │
│  │ [Open File]  [View Links]       │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

**Props:**
```typescript
interface KnowledgeGraphProps {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  view: 'library' | 'playbook';
  onNodeClick: (node: KnowledgeNode) => void;
  onSearch: (query: string) => void;
  onFilterType: (type: string) => void;
  onFilterDomain: (domain: string) => void;
}
```

### 5.6 PipelineKanban

```
┌──────────────────────────────────────────────────────────┐
│ SALES PIPELINE                    [+ Add Lead]           │
├────────────┬────────────┬────────────┬───────────────────┤
│ ● NEW LEAD │ ↻ IN PROG. │ ✓ ENROLLED │ ✗ LOST            │
│            │            │            │                   │
│ ┌────────┐ │ ┌────────┐ │ ┌────────┐ │ ┌────────┐       │
│ │ John D │ │ │ Sarah K│ │ │ Mike T │ │ │ Anna L │       │
│ │ $500   │ │ │ $750   │ │ │ $600   │ │ │ $400   │       │
│ │ 2d ago │ │ │ 1d ago │ │ │ Today  │ │ │ 3d ago │       │
│ └────────┘ │ └────────┘ │ └────────┘ │ └────────┘       │
│ ┌────────┐ │ ┌────────┐ │ ┌────────┐ │                   │
│ │ Jane S │ │ │ Tom R  │ │ │ Lisa P │ │                   │
│ │ $900   │ │ │ $350   │ │ │ $800   │ │                   │
│ │ 5d ago │ │ │ 3d ago │ │ │ 2d ago │ │                   │
│ └────────┘ │ └────────┘ │ └────────┘ │                   │
└────────────┴────────────┴────────────┴───────────────────┘
```

### 5.7 BillingCalendar

```
┌──────────────────────────────────────────┐
│ JUNE 2026                   ← →          │
├───┬───┬───┬───┬───┬───┬───┬───┬──────────┤
│ ▓ │ ▓ │ ▓ │ ▓ │ ▓ │ ▓ │ ▓ │ 1 │ $2,450   │
│   │   │   │   │   │   │   │    │ 3 charges │
├───┼───┼───┼───┼───┼───┼───┼───┼──────────┤
│ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │ 8 │ 9 │ $1,800   │
│   │   │   │   │   │   │   │    │ 2 charges │
├───┼───┼───┼───┼───┼───┼───┼───┼──────────┤
... (calendar grid with charge amounts per day)
```

### 5.8 TwentyIframe

```typescript
interface TwentyIframeProps {
  view: 'pipeline' | 'person' | 'calendar' | 'settings';
  personId?: string;
  authToken: string; // JWT bridge token
  onNavigate: (view: string, params: any) => void;
}
```

### 5.9 ChatDrawer

```
Trigger: Cmd+/ or swipe from right

┌─────────────────────┐
│ Quick Commands    ✕ │
├─────────────────────┤
│ /knowledge          │
│ /library            │
│ /roadmap            │
│ /settings           │
│ /command-center     │
│ /new-session        │
│ /dispatch-mission   │
└─────────────────────┘
```

---

## 6. KNOWLEDGE LAYER UX

### 6.1 /knowledge Route Design

```
┌──────────────────────────────────────────────────────────────┐
│ ← Back to Chat              KNOWLEDGE         [Library ▼]   │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 🔍 Search across all knowledge...                        │ │
│ │ Filter: [All Types ▼] [All Domains ▼] [Sort: Updated ▼] │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌─────────────────────┐  ┌─────────────────────────────────┐ │
│ │                     │  │                                 │ │
│ │   KNOWLEDGE         │  │  📄 billing-flow/SKILL.md       │ │
│ │   GRAPH             │  │  ─────────────────────────      │ │
│ │   (D3.js)           │  │  type: skill                    │ │
│ │                     │  │  domain: billing                │ │
│ │   ●────●     ●      │  │  version: 2.3.0                 │ │
│ │   │     \   /       │  │  mcp: nmi, slack               │ │
│ │   ●      ●─●──●     │  │                                 │ │
│ │   │       \/        │  │  # Billing Flow Agent           │ │
│ │   ●        ●        │  │  Handles payment collection...  │ │
│ │                     │  │                                 │ │
│ │                     │  │  ## Procedures                   │ │
│ │                     │  │  1. Check NMI vault...          │ │
│ │                     │  │                                 │ │
│ └─────────────────────┘  │  [Open Full File] [Links: 8]   │ │
│                           └─────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Concept Card (Hover Preview)

```
┌────────────────────────────┐
│ 📄 SKILL.md                │
│ billing-flow               │
├────────────────────────────┤
│ Type: skill                │
│ Domain: billing            │
│ Version: 2.3.0             │
│ Tags: billing, p0, nmi     │
│                             │
│ Handles payment collection,│
│ decline recovery, and      │
│ billing inquiries.         │
│                             │
│ Links to:                  │
│ → billing playbook         │
│ → nmi connector            │
│ → payment-link skill       │
│                             │
│ [Open]  [Pin to Graph]    │
└────────────────────────────┘
```

### 6.3 Search Experience

```
Search input behavior:
- Type ≥ 2 chars → start search (debounced 300ms)
- Results grouped by type:
  ┌────────────────────────────┐
  │ Skills (3)                 │
  │  billing-flow/SKILL.md     │
  │  payment-link/SKILL.md     │
  │  decline-recovery/SKILL.md │
  ├────────────────────────────┤
  │ Playbooks (1)              │
  │  billing/playbook.md       │
  ├────────────────────────────┤
  │ PRDs (2)                   │
  │  phase-34-okf/prd.md       │
  │  phase-39-billing/prd.md   │
  └────────────────────────────┘

Click result → Navigate to node in graph
Enter → Open first result
Esc → Clear search
```

### 6.4 Twin View Toggle

**Library View:**
- Flat, searchable list of ALL files
- Filtered by type (Skill, Playbook, PRD, Mission, Research, Memory)
- Filtered by domain (billing, disputes, support, etc.)
- Sort by: Name, Type, Domain, Recently Updated
- Each row: icon + name + type badge + domain badge + version + last updated
- Click row → open file viewer

**Playbook View:**
- Domain-organized hierarchy
- Each domain shows: playbook.md status, linked skills count, active missions
- Expand domain → show connector status (green=up, red=down)
- Click domain → show full playbook with manifest.yaml metadata
- Visual indicators: connector health, workflow status, mission progress

---

## 7. TWENTY CRM EXTENSION UX

### 7.1 AI Customer Summary (defineFrontComponent)

```
┌─────────────────────────────────────┐
│ AI CUSTOMER SUMMARY                 │
├─────────────────────────────────────┤
│ John Doe                            │
│ Enrolled: Jan 15, 2026              │
│ Plan: Premium ($149/mo)            │
│                                     │
│ 📊 Credit Score: 680                │
│ 📋 Active Disputes: 2               │
│ 💳 Last Payment: June 1 ($149)     │
│ 🎫 Open Tickets: 1                  │
│                                     │
│ ⚡ NEXT BEST ACTION:               │
│ Send payment reminder for June 15   │
│ [Send SMS]  [Send Email]           │
│                                     │
│ [View Full 360 →]                  │
└─────────────────────────────────────┘
```

### 7.2 Cmd+K Palette

```
Trigger: Cmd+K (anywhere in Twenty)

┌─────────────────────────────────────┐
│ > sea                               │
├─────────────────────────────────────┤
│ 👤 Search customers...              │
│ John Doe · j@email.com · Active     │
│ Jane Seaver · jane@email.com · Lead │
│                                     │
│ 📄 Go to...                         │
│ Pipeline view                       │
│ Billing Calendar                    │
│ Agent Dashboard                     │
│                                     │
│ ⚡ Actions...                       │
│ Create lead                         │
│ Send payment link                   │
│ Generate dispute letter             │
└─────────────────────────────────────┘
```

### 7.3 Generative Onboarding Wizard

```
┌─────────────────────────────────────┐
│ NEW CUSTOMER ONBOARDING    Step 1/6 │
├─────────────────────────────────────┤
│                                     │
│   👋 Welcome! Let's get started.   │
│                                     │
│   Step 1: Personal Information      │
│   ┌─────────────────────────────┐  │
│   │ First Name: [__________]    │  │
│   │ Last Name:  [__________]    │  │
│   │ Email:      [__________]    │  │
│   │ Phone:      [__________]    │  │
│   └─────────────────────────────┘  │
│                                     │
│   Progress: ██░░░░░░░░ 16%         │
│                                     │
│   [Back]              [Next →]     │
└─────────────────────────────────────┘
```

---

## 8. CHAT INTERFACE DESIGN

### 8.1 Main Chat Layout

```
┌─────────────────────────────────────────────────────────────┐
│ CHAT  ┌──────────┐                        ┌──────────────┐ │
│       │ Library  │                        │ Command Ctr  │ │
│       │ (collapse)│                        │ (Twenty)     │ │
├───────┴──────────┴────────────────────────┴──────────────┤ │
│                                                           │ │
│  ┌─────────────────────────────────────────────────────┐  │ │
│  │ AI: How can I help with billing today?              │  │ │
│  └─────────────────────────────────────────────────────┘  │ │
│                                                           │ │
│  ┌──────────────────────────────────────────────┐         │ │
│  │ User: Show me John Doe's payment history     │         │ │
│  └──────────────────────────────────────────────┘         │ │
│                                                           │ │
│  ┌─────────────────────────────────────────────────────┐  │ │
│  │ AI: Here's John Doe's payment history:              │  │ │
│  │                                                     │  │ │
│  │ ┌─────────────────────────────────────────────┐    │  │ │
│  │ │ PAYMENT HISTORY — John Doe                  │    │  │ │
│  │ │ ─────────────────────────────────────────── │    │  │ │
│  │ │ June 1, 2026    $149.00    ✓ Success       │    │  │ │
│  │ │ May 1, 2026     $149.00    ✓ Success       │    │  │ │
│  │ │ April 1, 2026   $149.00    ✗ Declined      │    │  │ │
│  │ │ March 1, 2026   $149.00    ✓ Success       │    │  │ │
│  │ │                                             │    │  │ │
│  │ │ Total: $596.00  │  Success: 3  │  Failed: 1 │    │  │ │
│  │ └─────────────────────────────────────────────┘    │  │ │
│  └─────────────────────────────────────────────────────┘  │ │
│                                                           │ │
├───────────────────────────────────────────────────────────┤ │
│ [📎] Type a message...                          [Send →] │ │
└───────────────────────────────────────────────────────────┘
```

### 8.2 Panel System

```
Left Panel (collapsible):
- Library (skills, playbooks, PRDs)
- Recent conversations
- Quick links

Right Panel (collapsible):
- Command Center (Twenty iframe)
- Knowledge Graph (mini view)
- Mission Tracker

Bottom Drawer (Cmd+/):
- Quick commands
- Recent actions
- Search
```

---

## 9. RESPONSIVE STRATEGY

### 9.1 Breakpoints

| Name | Width | Layout |
|------|-------|--------|
| **Mobile** | 375px - 639px | Single column, panels as sheets |
| **Tablet** | 640px - 1023px | Two column (main + optional sidebar) |
| **Desktop** | 1024px+ | Three column (left + main + right) |

### 9.2 Mobile Adaptations

```
Mobile (375px):
┌───────────────────┐
│ ☰ Neptune      ⚙️ │
├───────────────────┤
│                   │
│ CHAT AREA         │
│ (full width)      │
│                   │
│                   │
│                   │
│                   │
├───────────────────┤
│ [📎] Type... [→] │
└───────────────────┘
  Panels accessible via hamburger menu
  Twenty iframe → fullscreen modal
  Knowledge graph → simplified list view
  Mission cards → stacked vertically

Tablet (768px):
┌──────────┬────────────────────┐
│ Library  │ CHAT AREA          │
│ (200px)  │ (568px)            │
│          │                    │
│          │                    │
│          │                    │
│          │                    │
│          ├────────────────────┤
│          │ Type...       [→]  │
└──────────┴────────────────────┘

Desktop (1280px):
┌──────────┬────────────────────┬──────────┐
│ Library  │     CHAT AREA      │ Command  │
│ (220px)  │     (740px)        │ Center   │
│          │                    │ (320px)  │
│          │                    │          │
│          │                    │          │
│          ├────────────────────┤          │
│          │ Type...       [→]  │          │
└──────────┴────────────────────┴──────────┘
```

---

## 10. ANIMATION & MOTION

### 10.1 Animation Tokens

```css
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* Bouncy */
--ease-out: cubic-bezier(0, 0, 0.2, 1);           /* Standard out */
--ease-in: cubic-bezier(0.4, 0, 1, 1);            /* Standard in */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);      /* Standard */

--duration-instant: 50ms;
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-slow: 400ms;
--duration-very-slow: 600ms;
```

### 10.2 Animation Patterns

| Pattern | Duration | Easing | Usage |
|---------|----------|--------|-------|
| Fade in | 150ms | ease-out | Cards, modals appearing |
| Slide up | 250ms | spring | Bottom sheets, drawers |
| Scale in | 200ms | spring | Popovers, dropdowns |
| Graph zoom | 400ms | ease-out | Knowledge graph transitions |
| Status pulse | 2000ms | infinite | Active mission indicator |
| Skeleton shimmer | 1500ms | infinite | Loading states |
| Page transition | 300ms | ease-in-out | Route changes |
| Drag feedback | real-time | — | Kanban cards, graph nodes |

### 10.3 Glass Surface Effects

```css
.glass-surface {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
}

.glass-surface-elevated {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(60px);
  -webkit-backdrop-filter: blur(60px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}
```

---

## 11. ACCESSIBILITY

### 11.1 WCAG 2.1 AA Compliance

| Requirement | Implementation |
|-------------|---------------|
| Color contrast | All text ≥ 4.5:1 against background |
| Focus indicators | Visible focus ring on all interactive elements |
| Keyboard navigation | All UI operable via keyboard (Tab, Enter, Esc) |
| Screen readers | Semantic HTML, ARIA labels, alt text |
| Reduced motion | `prefers-reduced-motion: reduce` honored |
| Touch targets | Minimum 44x44px touch area |
| Error identification | Error messages with clear descriptions |
| Form labels | All inputs have associated labels |

### 11.2 Focus Ring

```css
*:focus-visible {
  outline: 2px solid #14B8A6;
  outline-offset: 2px;
  border-radius: 4px;
}
```

### 11.3 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## END OF DESIGN DOCUMENT

**Version:** 1.0.0
**Design Language:** iOS Liquid Glass
**Palette:** Teal brand (#14B8A6), Dark surfaces (#0F172A), Glass overlays
**Typography:** Inter UI + JetBrains Mono
**Components:** MissionCard, HandoffCard, QuickActions, PresetCard, KnowledgeGraph, PipelineKanban, BillingCalendar, TwentyIframe, ChatDrawer
**Mobile-First:** 375px → 768px → 1280px

*"Design is not decoration. Design is how it works. Glass, depth, clarity, trust."*

— Master Design Doc v1.0, June 17, 2026

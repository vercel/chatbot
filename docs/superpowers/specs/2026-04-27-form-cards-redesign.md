# Form Cards Redesign — Gap Analysis & Review

**Date:** 2026-04-27
**Branch:** feat/gap-review-card
**Source design:** Anthropic Claude Design bundle, `Form Cards.html` from `labs-form-filling-assistant`

## Goal

Port the design's `MissingInfoCard` and `ReviewCard` patterns into the existing `GapAnalysisCard` and `FormSummaryCard` components. The new pattern introduces:

1. A small pink "summary CTA" card shown inline in the chat thread
2. A full-page modal that opens when the user starts filling/reviewing
3. Section-by-section navigation inside the modal with progress dots
4. Updated source badges (`DATABASE` / `AUTOFILLED` / `MANUAL` / `REQUIRED`)
5. Submitted/Skipped recap states

The user explicitly asked for full design fidelity (Option A) including the modal overlay, accepting that this requires changing tool input shapes and the skill prompt.

## Non-goals

- The design's `view='all'` (full scrollable list of all sections) — disabled in the design source itself, skip
- Changing other AI element cards (`Confirmation`, `UserActionConfirmation`, `Checkpoint`)
- Touching the chat artifact pane or browser kernel
- Restyling unrelated UI

## Disabled states

A card is **disabled** when any of these is true:
- The user has skipped (`skipped === true` from local state or initial prop)
- The form-filling artifact is closed (`isArtifactVisible === false`)
- The chat is being replayed from history (effectively a special case of "artifact closed" — the same `isArtifactVisible=false` signal covers it; no new prop needed)

What "disabled" means per state:

- **Summary CTA**:
  - All buttons (`Provide info`, `Skip for now`, `Start review`, `Review & submit`, `Edit responses`) render with `disabled` attribute and the muted styling. No clicks open the modal, no message is sent.
  - Exception: in the review card, when the card has a captured submission (any state with data to show), a **`View submitted`** button replaces the disabled primary CTA and **does** open the modal in read-only mode (see below).

- **Detail modal — read-only (review card only)**:
  - Opens on the first section with data. Section header shows the section title; close (×) and ESC still work.
  - All inputs render as plain text rows (no `<input>` element, just the value); source badges still show.
  - Bottom bar has only `Back ← / progress dots / Next →` for navigation — **no `Submit updates` button** on the last section, just `Next →` wraps to first or the last-section state shows nothing on the right.
  - Backdrop click + ESC + × all collapse.

- **Gap analysis card**: no read-only modal — once disabled, the user just sees the summary CTA in its disabled state. There's nothing meaningful to "view" because the gap card is purely about collecting input.

This means the `GapAnalysisCard` needs to start receiving `isArtifactVisible` (currently it doesn't); add the prop to its signature and pass it through from `message.tsx`.

## High-level architecture

```
Tool input (sections + clientName)
            │
            ▼
   message.tsx renders <GapAnalysisCard /> or <FormSummaryCard />
            │
            ▼
   Card receives `sections` prop; if absent, adapter wraps legacy
   `missingFields` / `fields` into a single unnamed section
            │
            ▼
   Card has 4 view states: summary | detail | submitted | skipped
            │
   ┌────────┴────────┐
   │                 │
   ▼                 ▼
 inline pink     fixed modal
 CTA shell       overlay (z-50,
                 backdrop, ESC
                 to close)
```

## Tool schema changes

### `lib/ai/tools/gap-analysis.ts`

```ts
inputSchema: z.object({
  formName: z.string().optional(),
  clientName: z.string().optional(),  // NEW
  sections: z.array(z.object({
    id: z.string(),
    title: z.string(),
    fields: z.array(missingFieldSchema),
  })),
})
```

`missingFieldSchema` keeps current fields (`field`, `options?`, `inputType?`, `multiSelect?`, `condition?`) and gains:
- `required?: boolean`
- `placeholder?: string`
- `note?: string` (alias for caseworker-facing helper text; `condition` stays for backward compatibility)

### `lib/ai/tools/form-summary.ts`

```ts
inputSchema: z.object({
  formName: z.string().optional(),
  clientName: z.string().optional(),  // NEW
  sections: z.array(z.object({
    id: z.string(),
    title: z.string(),
    fields: z.array(fieldSchema),
  })),
})
```

`fieldSchema` is unchanged. Source enum stays `database | caseworker | inferred | missing` — visually mapped in the component (no churn for the database-label "Apricot 360").

### Backward-compatibility adapter

In `message.tsx`, both render branches construct `sections` as follows:

```ts
const sections =
  input?.sections ??
  (input?.missingFields
    ? [{ id: 'missing', title: '', fields: input.missingFields }]
    : input?.fields
      ? [{ id: 'fields', title: '', fields: input.fields }]
      : []);
```

If a section's `title` is empty, the card shows the field list without a section header (single-section mode). This keeps old saved chats rendering — they collapse to one untitled section but otherwise look correct in the new shell.

## Component design

### Shared building blocks (co-located inside each card file to start)

- **`CardShell`** — renders the outer container; two visual variants (`cta` for the pink summary; default white for detail). When `expanded=true`, wraps content in a fixed full-page overlay (z-50, `bg-[rgba(16,24,40,0.45)]` backdrop, click outside or ESC closes) with a centered `max-w-[640px]` container. Layout shape and spacing follow `form-cards.jsx` lines 607–629.
- **`SectionHeader`** — eyebrow ("Section X of Y") + section title + close (×) button, lines 84–104 of the design source.
- **`ProgressDots`** — clickable dots in the bottom bar for jumping between sections. Active dot is `bg-primary` (`w-2`), neutral dots are `bg-[hsl(220_13%_86%)]` with hover state. Both cards use the same simple primary/neutral pattern (the design source defines an orange "issue" variant but neither rendered card uses it).
- **`FieldSourceBadge`** (review only) — maps current source enum to design pill:
  - `database` → stone pill, label `"APRICOT 360"`
  - `caseworker` → stone pill, label `"MANUAL"`
  - `inferred` → pink pill, label `"AUTOFILLED"`
  - `missing` + `required` → red pill with border, label `"REQUIRED"`
  - `missing` + !required → stone pill, label `"OPTIONAL"`

### `GapAnalysisCard` (was `MissingInfoCard` in design)

Props (after change):
```ts
{
  formName?: string;
  clientName?: string;
  sections: Section[];
  sendMessage?: UseChatHelpers<ChatMessage>['sendMessage'];
  isSubmitted?: boolean;     // preserved
  isSkipped?: boolean;       // preserved
  isArtifactVisible?: boolean; // NEW — same semantics as FormSummaryCard
  className?: string;
}
```

`disabled = isSkipped || skipped || !isArtifactVisible`. When `disabled`, all summary-state buttons render with `disabled` attribute + muted styling and the modal cannot be opened.

State: `view: 'summary' | 'detail'`, `current: number`, `answers: Record<string, string|string[]>`, `submitted`, `skipped`, `expanded`.

**Summary state** (pink CTA shell):
- Default: "Missing information" + count copy + `Provide info` (primary) / `Skip for now` (outline). Clicking `Provide info` sets `expanded=true` and `view='detail'`. Both buttons honor `disabled`.
- Submitted: green check + "Information submitted" + filled count + `Edit responses` button (also disabled when artifact closed). Reopens detail at section 0.
- Skipped: muted "Skipped for now" + `Provide info` button — both visually muted **and** disabled (no reopen). This matches "skipped for now = locked" intent.

**Detail state** (fixed modal):
- `SectionHeader` with title + section index eyebrow + × button (collapses).
- One field per row using current input renderers (text, date, radio, checkbox, select, textarea). Required fields show red `*`.
- Sticky bottom bar (3-col grid): `Back ←` (collapses on first section, otherwise prev), progress dots, `Next →` or `Submit updates` on last section.
- ESC and backdrop click both collapse to summary.
- On submit, builds the same multi-line message the current card builds and calls `sendMessage`, then collapses to the submitted summary state.

### `FormSummaryCard` (was `ReviewCard` in design)

Props (after change):
```ts
{
  formName?: string;
  clientName?: string;
  sections: Section[];
  sendMessage?: UseChatHelpers<ChatMessage>['sendMessage'];
  isArtifactVisible?: boolean;  // preserved
  className?: string;
}
```

State: `view`, `current` (auto-jumps to first section with `missing` required field on Start review), `confirmed`, `skipped`, `expanded`, plus the existing per-field `editValues` accumulated as the user types in detail rows.

`disabled = skipped || !isArtifactVisible`. When `disabled` and there is captured data (submitted, or any sections with values), the primary action becomes a `View submitted` button that opens the modal in **read-only mode**. When `disabled` with no captured data (rare — e.g., the model produced an empty review), all buttons are disabled and the card stays on the summary copy.

**Summary state** (pink CTA shell):
- Default: "Application ready for review" + count copy with missing/total breakdown. Primary `Start review` (or `Review & submit` when no issues) + outline `Skip for now`. Both honor `disabled`.
- Confirmed: green check + "Application submitted" + recap copy. When `disabled` (artifact closed), shows a `View submitted` button that opens the read-only modal.
- Skipped: muted recap. If there is captured data to show, render `View submitted` (always enabled, opens read-only modal). Otherwise render a disabled `Start review` button.

**Detail state — editable** (fixed modal, when not disabled):
- One section at a time. Each row is `ReviewFieldRow`: field label (with `*` for required) on the left, source badge on the right, then editable `<input>` (or `<select>`/`<textarea>` per `inputType`). Required-but-empty rows get red border + tinted bg.
- Same Back / dots / Next / Submit updates bottom bar.
- On Submit updates from the last section: build the existing "Please update the following form fields" message (preserve current diff-detection logic), then collapse to the confirmed summary.

**Detail state — read-only** (fixed modal, when `disabled` and data exists):
- Section header still shows; × close still works.
- Each row renders `field label + source badge + plain text value` (no input element). Empty values render as muted "Not provided".
- Bottom bar shows only `Back ← / progress dots / Next →` (no Submit updates). On the last section, the right-hand Next slot is empty.
- Backdrop click, ESC, and × all collapse.

## Skill prompt updates

`lib/ai/skills/application-protocol/SKILL.md` lines 122–126 and 138 describe how the model uses each tool. Update both to instruct sectioning:

- Replace `missingFields: array of { field, options?, inputType?, condition? }` with `sections: array of { id, title, fields: [...] }` and add a note that sections should follow the natural form structure (e.g., "Identity & eligibility", "Household composition", "Income", "Expenses & assets", "Preferences & legal"). When a form has only a few missing fields, a single section titled after the form area is fine.
- Add `clientName` to the example call shapes.
- For `formSummary`, the same sectioning instruction; field ordering rule stays ("in the order they appear on the original form" — applied within each section).

## message.tsx integration

```tsx
// gap analysis branch
<GapAnalysisCard
  key={toolCallId}
  formName={input?.formName}
  clientName={input?.clientName}
  sections={adaptSections(input)}            // sections ?? wrap legacy
  sendMessage={sendMessage}
  isArtifactVisible={isArtifactVisible}      // NEW — controls disabled state
/>

// form summary branch
<FormSummaryCard
  key={toolCallId}
  formName={input?.formName}
  clientName={input?.clientName}
  sections={adaptSections(input)}
  sendMessage={sendMessage}
  isArtifactVisible={isArtifactVisible}
/>
```

`adaptSections(input)` is the backward-compatibility helper from the "Backward-compatibility adapter" section above.

## Migration / risk

- **Backward compatibility**: the adapter handles legacy `missingFields` / `fields` inputs by wrapping them in a single untitled section. Old saved chats will render without a section header but otherwise look right.
- **Skill prompt drift**: model takes a turn or two to settle on sensible section titles. Acceptable; sections are presentational, no validation.
- **Modal overlay in chat**: the modal mounts above the chat thread (`fixed inset-0 z-50`). No conflict with existing modals (sidebar, sheet, dialog) because it's only open while the user is actively filling/reviewing — single-active-modal UX.
- **No new dependencies**: design uses Tailwind utilities + plain React, both already in the project.

## Test plan

Manual verification (no UI test infrastructure for these cards exists yet):

- Trigger a chat that fills CalFresh — confirm the gap analysis card renders with sections, opens to a modal, navigates Back/Next, submits, then shows the submitted summary inline.
- Trigger the form summary card on review — confirm source badges render correctly for all four source values, required-but-empty rows flag red, edits propagate into the submission message.
- Replay a saved chat made before the change — confirm the legacy adapter renders the single-section fallback without errors.
- **Disabled states**:
  - Close the artifact while a fresh gap analysis card is on screen — confirm `Provide info` and `Skip for now` are both disabled and the modal won't open.
  - Click `Skip for now` on the gap analysis card — confirm the resulting "Skipped for now" view has its `Provide info` button disabled (no reopen).
  - Close the artifact while a confirmed review card is on screen — confirm a `View submitted` button appears, opens a read-only modal showing all section values with no inputs and no Submit button.
  - Reload an old chat that contains a confirmed review card — confirm `View submitted` appears and the modal is read-only.
- Type-check (`pnpm typecheck`) and lint pass.

## Files touched

- `lib/ai/tools/gap-analysis.ts` — schema change
- `lib/ai/tools/form-summary.ts` — schema change
- `lib/ai/skills/application-protocol/SKILL.md` — prompt update
- `components/ai-elements/gap-analysis-card.tsx` — rewrite
- `components/ai-elements/form-summary-card.tsx` — rewrite
- `components/message.tsx` — pass `sections` + `clientName`, install adapter

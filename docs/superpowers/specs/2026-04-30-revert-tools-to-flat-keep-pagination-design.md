# Revert Form-Card Tools to Flat Schema, Keep Modal Pagination

**Date:** 2026-04-30
**Branch:** feat/gap-review-card
**Supersedes (partial):** `2026-04-27-form-cards-redesign.md` — sections-shape tool input

## Goal

Revert the agent-facing schema for `gapAnalysis` and `formSummary` from the `sections` shape introduced in this branch back to a single ordered `missingFields` / `fields` array, matching the pre-branch tool inputs. Move the modal pagination from agent-driven sections to UI-driven chunking by 5.

## Why

The `sections` schema asks the agent to *group* fields ("Identity & eligibility", "Household composition", etc.). In practice the agent groups fields semantically rather than in form display order. After completing or skipping a gap analysis, the agent then has trouble locating the next form field to fill, because its mental model (semantic groups) no longer matches the form's actual layout (sequential pages).

Going back to a flat ordered list — which is what the form actually presents — keeps the agent's understanding aligned with the page. The modal can still be paginated; pagination is purely a UI concern.

## Non-goals

- Changing card visual design, source badges, submitted/skipped states, or any non-pagination behavior
- Changing pagination UX (Back/Next buttons, progress dots, sticky footer all stay)
- Reworking the chat-side CTA card
- Modifying any other tool

## Scope

### Tools

- `lib/ai/tools/gap-analysis.ts` — replace `sections: GapSection[]` with `missingFields: GapField[]`. Field-level shape unchanged: `field`, `options?`, `inputType?`, `multiSelect?`, `condition?`, `required?`, `placeholder?`, `note?`. Update tool description to drop section language and emphasize form display order.
- `lib/ai/tools/form-summary.ts` — replace `sections: ReviewSection[]` with `fields: ReviewField[]`. Field-level shape unchanged. Update description to drop section language and emphasize form display order.

### Skill prompt

`lib/ai/skills/application-protocol/SKILL.md`

- **Gap Analysis Protocol step 5** — replace the `sections` instructions and the "no more than 5 fields" / "split larger sections" guidance with: "Pass `missingFields`: an array of `{ field, options?, inputType?, multiSelect?, condition?, required?, placeholder?, note? }` in the order the fields appear on the original form."
- **Form Completion Summary** — replace `sections` guidance with: "Pass `fields`: an array of fields in the order they appear on the original form. For each field set `source` to ...". Drop the "split larger sections" / "5-per-section" instruction. Keep the source enum, the inputType + options requirement, and the `required` rule.

### Adapter

`lib/types/form-cards.ts`

- `adaptGapSections(input)` returns `GapSection[]` shaped as **pages**:
  1. Resolve a flat ordered `GapField[]`: prefer `input.missingFields`; if absent, flatten any `input.sections[*].fields` in order (legacy chat).
  2. Chunk the flat list into pages of 5.
  3. Emit `{ id: 'page-0', title: '', fields: [...] }`, `{ id: 'page-1', ... }`, etc.
- `adaptReviewSections(input)` mirrors the same logic for `ReviewSection[]` / `ReviewField[]` / `input.fields` / legacy `input.sections`.
- Page size is a constant in this file (e.g., `const PAGE_SIZE = 5;`).

### Cards

- `components/ai-elements/gap-analysis-card.tsx` and `components/ai-elements/form-summary-card.tsx` — change the eyebrow string from `Section ${current + 1} of ${sections.length}` to `Page ${current + 1} of ${sections.length}`. No other changes.

### Tests

- `tests/client/gap-analysis-card.test.tsx` and `tests/client/form-summary-card.test.tsx` — update fixtures from `sections` to flat arrays. Update any `Section X of Y` text assertions to `Page X of Y`. Adjust expected page counts where fixtures rely on field count divided by 5.

## What stays the same

- `GapField` / `ReviewField` types, `source` enum, `inputType` enum, `options`, `required`, `inferredFrom`, `note`, `placeholder`, `condition`, `multiSelect` — unchanged
- `GapSection` / `ReviewSection` types — kept as the internal "page" shape produced by the adapter and consumed by the cards
- `CardShell`, `Modal`, `SectionHeader`, `SectionFooter`, `ProgressDots`, `FieldSourceBadge`, `CheckCircleFilled` — unchanged
- The two cards' submitted/skipped states, modal flow, submit handler that aggregates answers into a chat message, read-only modal — unchanged
- `message.tsx` rendering of the cards — unchanged (still calls `adaptGapSections(input)` / `adaptReviewSections(input)`)

## Backward compatibility

Old chats whose stored tool input has the `sections` shape will render through the same adapter path: their fields are flattened in order and re-chunked into pages of 5. Original section titles are discarded. The user accepted this tradeoff in brainstorming.

## Acceptance criteria

- A new gap analysis with 14 missing fields renders as 3 pages (5, 5, 4) with eyebrow `Page 1 of 3` … `Page 3 of 3`.
- A new form summary with 22 fields renders as 5 pages (5, 5, 5, 5, 2).
- An old chat with the `sections` shape still opens and paginates without errors.
- Tool descriptions and SKILL prompt no longer mention `sections`.
- The agent, when prompted with the same scenario where it previously confused itself, produces fields in form display order.
- `npx tsc --noEmit` passes for all touched files.
- Updated card tests pass.

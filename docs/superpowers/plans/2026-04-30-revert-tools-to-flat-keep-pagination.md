# Revert Form-Card Tools to Flat Schema, Keep Modal Pagination — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revert `gapAnalysis` and `formSummary` tool inputs (and matching SKILL prompt) from the agent-grouped `sections` shape back to a flat ordered field array, while keeping the modal cards paginated by chunking the flat list into pages of 5 in the UI adapter.

**Architecture:** The agent emits a flat ordered list. The UI adapter (`adaptGapSections` / `adaptReviewSections`) chunks that list into pages of 5 and produces the existing `GapSection` / `ReviewSection` shape that the cards already consume. The cards themselves change only one string ("Section" → "Page" in the eyebrow). Old chats stored in the `sections` shape pass through the same adapter: their fields are flattened in order and re-chunked.

**Tech Stack:** TypeScript, Zod (tool schemas), Vitest browser tests, Markdown SKILL prompt.

**Spec:** `docs/superpowers/specs/2026-04-30-revert-tools-to-flat-keep-pagination-design.md`

---

## File map

- Modify: `lib/ai/tools/gap-analysis.ts` — schema flat
- Modify: `lib/ai/tools/form-summary.ts` — schema flat
- Modify: `lib/ai/skills/application-protocol/SKILL.md` — drop `sections` language
- Modify: `lib/types/form-cards.ts` — adapter chunks by 5
- Modify: `components/ai-elements/gap-analysis-card.tsx` — eyebrow string
- Modify: `components/ai-elements/form-summary-card.tsx` — eyebrow string
- Test: `tests/client/form-cards-adapter.test.ts` — new unit test for chunking behavior

Existing card tests (`tests/client/gap-analysis-card.test.tsx`, `tests/client/form-summary-card.test.tsx`) pass `sections` directly to the cards (they bypass the adapter), so their fixtures don't need changing.

---

### Task 1: Add unit test for the chunking adapter

**Files:**
- Create: `tests/client/form-cards-adapter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from 'vitest';
import {
  adaptGapSections,
  adaptReviewSections,
} from '@/lib/types/form-cards';

describe('adaptGapSections', () => {
  test('returns empty array when input is undefined', () => {
    expect(adaptGapSections(undefined)).toEqual([]);
  });

  test('returns empty array when no fields are provided', () => {
    expect(adaptGapSections({})).toEqual([]);
    expect(adaptGapSections({ missingFields: [] })).toEqual([]);
  });

  test('chunks a flat missingFields list into pages of 5 in order', () => {
    const fields = Array.from({ length: 14 }, (_, i) => ({ field: `f${i + 1}` }));
    const pages = adaptGapSections({ missingFields: fields });
    expect(pages).toHaveLength(3);
    expect(pages[0]).toEqual({
      id: 'page-0',
      title: '',
      fields: fields.slice(0, 5),
    });
    expect(pages[1]).toEqual({
      id: 'page-1',
      title: '',
      fields: fields.slice(5, 10),
    });
    expect(pages[2]).toEqual({
      id: 'page-2',
      title: '',
      fields: fields.slice(10, 14),
    });
  });

  test('flattens legacy sections shape preserving order, then chunks by 5', () => {
    const pages = adaptGapSections({
      sections: [
        { id: 's1', title: 'Identity', fields: [{ field: 'a' }, { field: 'b' }, { field: 'c' }] },
        { id: 's2', title: 'Income', fields: [{ field: 'd' }, { field: 'e' }, { field: 'f' }, { field: 'g' }] },
      ],
    });
    expect(pages).toHaveLength(2);
    expect(pages[0].fields.map((f) => f.field)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(pages[1].fields.map((f) => f.field)).toEqual(['f', 'g']);
    // Original section titles are discarded; pages have empty titles.
    expect(pages.every((p) => p.title === '')).toBe(true);
  });
});

describe('adaptReviewSections', () => {
  test('returns empty array when input is undefined', () => {
    expect(adaptReviewSections(undefined)).toEqual([]);
  });

  test('chunks a flat fields list into pages of 5 in order', () => {
    const fields = Array.from({ length: 12 }, (_, i) => ({
      field: `r${i + 1}`,
      source: 'database' as const,
    }));
    const pages = adaptReviewSections({ fields });
    expect(pages).toHaveLength(3);
    expect(pages.map((p) => p.fields.length)).toEqual([5, 5, 2]);
    expect(pages[0].id).toBe('page-0');
    expect(pages[2].id).toBe('page-2');
  });

  test('flattens legacy sections shape preserving order, then chunks by 5', () => {
    const pages = adaptReviewSections({
      sections: [
        {
          id: 's1',
          title: 'Identity',
          fields: [
            { field: 'a', source: 'database' as const },
            { field: 'b', source: 'database' as const },
            { field: 'c', source: 'database' as const },
          ],
        },
        {
          id: 's2',
          title: 'Income',
          fields: [
            { field: 'd', source: 'database' as const },
            { field: 'e', source: 'database' as const },
            { field: 'f', source: 'database' as const },
          ],
        },
      ],
    });
    expect(pages).toHaveLength(2);
    expect(pages[0].fields.map((f) => f.field)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(pages[1].fields.map((f) => f.field)).toEqual(['f']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/client/form-cards-adapter.test.ts`
Expected: tests fail. The `adaptGapSections` and `adaptReviewSections` adapters currently return a single section for the legacy/flat shape (no chunking), and they currently return the existing `sections` array as-is, so multiple assertions will fail (lengths, ids, page-empty titles).

---

### Task 2: Implement the chunking adapter

**Files:**
- Modify: `lib/types/form-cards.ts`

- [ ] **Step 1: Replace adapter implementations**

Replace the existing `adaptGapSections` and `adaptReviewSections` functions (and the legacy input types) at the bottom of the file with this:

```ts
const PAGE_SIZE = 5;

type LegacyGapInput = {
  sections?: GapSection[];
  missingFields?: GapField[];
};

type LegacyReviewInput = {
  sections?: ReviewSection[];
  fields?: ReviewField[];
};

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export function adaptGapSections(input: LegacyGapInput | undefined): GapSection[] {
  if (!input) return [];
  const flat: GapField[] = input.missingFields?.length
    ? input.missingFields
    : (input.sections ?? []).flatMap((s) => s.fields);
  return chunk(flat, PAGE_SIZE).map((fields, i) => ({
    id: `page-${i}`,
    title: '',
    fields,
  }));
}

export function adaptReviewSections(input: LegacyReviewInput | undefined): ReviewSection[] {
  if (!input) return [];
  const flat: ReviewField[] = input.fields?.length
    ? input.fields
    : (input.sections ?? []).flatMap((s) => s.fields);
  return chunk(flat, PAGE_SIZE).map((fields, i) => ({
    id: `page-${i}`,
    title: '',
    fields,
  }));
}
```

- [ ] **Step 2: Run the adapter tests to verify they pass**

Run: `npx vitest run tests/client/form-cards-adapter.test.ts`
Expected: all tests in the file PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/types/form-cards.ts tests/client/form-cards-adapter.test.ts
git commit -m "feat(form-cards): chunk flat field lists into pages of 5 in adapter"
```

---

### Task 3: Revert `gapAnalysis` tool schema to flat

**Files:**
- Modify: `lib/ai/tools/gap-analysis.ts`

- [ ] **Step 1: Replace the file contents**

```ts
import { tool } from 'ai';
import { z } from 'zod';

const gapFieldSchema = z.object({
  field: z.string().describe('Field label'),
  options: z.array(z.string()).optional().describe('Possible answer options, if applicable'),
  inputType: z
    .enum(['text', 'select', 'date', 'boolean', 'textarea'])
    .optional()
    .describe('Expected input type'),
  multiSelect: z.boolean().optional().describe('Whether multiple options can be selected'),
  condition: z
    .string()
    .optional()
    .describe('Condition under which this field is required, e.g. "if pregnant"'),
  required: z.boolean().optional().describe('Whether this field is required to submit the form'),
  placeholder: z.string().optional().describe('Placeholder hint shown inside the input'),
  note: z.string().optional().describe('Short helper text shown under the field label'),
});

export const gapAnalysis = tool({
  description:
    'Shows the caseworker a card listing ONLY the missing fields, in the order they appear on the original form. Calling this tool ends your turn — do not call any other tools after it; wait for the caseworker\'s reply. Include only missing fields, no fields you already have. After calling, write one short sentence like "Please provide the missing info above." and stop. If nothing is missing, do not call this tool.',
  inputSchema: z.object({
    formName: z
      .string()
      .optional()
      .describe('Name of the form being filled, e.g. "WIC Application"'),
    clientName: z
      .string()
      .optional()
      .describe('Full name of the participant the form is being filled for'),
    missingFields: z
      .array(gapFieldSchema)
      .describe('Missing fields in the order they appear on the original form.'),
  }),
  execute: async (input) => input,
});
```

- [ ] **Step 2: Run a type check on the touched files**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `gap-analysis.ts`. (The pre-existing test errors about a missing `session` prop in `tests/client/benefit-applications-langing.test.tsx` are unrelated and can be ignored.)

---

### Task 4: Revert `formSummary` tool schema to flat

**Files:**
- Modify: `lib/ai/tools/form-summary.ts`

- [ ] **Step 1: Replace the file contents**

```ts
import { tool } from 'ai';
import { z } from 'zod';

const fieldSchema = z.object({
  field: z.string().describe('Field label'),
  value: z
    .string()
    .optional()
    .describe('Value that was filled in. Omit or leave empty for fields that could not be filled.'),
  source: z
    .enum(['database', 'caseworker', 'inferred', 'missing'])
    .describe(
      '"database" = pulled from Apricot records, "caseworker" = provided by the caseworker this session, "inferred" = agent reasoned from available data, "missing" = field could not be filled',
    ),
  inputType: z
    .enum(['text', 'select', 'radio', 'checkbox'])
    .optional()
    .describe(
      'Type of input the form field uses. Use "select" for dropdowns, "radio" for single-choice radio buttons, "checkbox" ONLY for fields that allow multiple simultaneous selections, or omit for plain text.',
    ),
  options: z
    .array(z.string())
    .optional()
    .describe('Available choices for select, radio, or checkbox fields'),
  required: z
    .boolean()
    .optional()
    .describe('Whether the field is required to submit the form'),
  inferredFrom: z
    .string()
    .optional()
    .describe(
      'For inferred fields only: a short description of what the value was based on, e.g. "the zipcode", "the client\'s date of birth", "the household size"',
    ),
});

export const formSummary = tool({
  description:
    'Display a form summary card showing what was filled in and where each value came from. Call this INSTEAD of writing a summary message at the end of form completion. List fields in the order they appear on the original form. The card already displays all information — do NOT write any text listing the fields before or after calling this tool. Just call the tool, then follow with one short sentence like "Please review and submit when ready."',
  inputSchema: z.object({
    formName: z
      .string()
      .optional()
      .describe('Name of the form that was filled, e.g. "WIC Application"'),
    clientName: z
      .string()
      .optional()
      .describe('Full name of the participant the form was filled for'),
    fields: z
      .array(fieldSchema)
      .describe(
        'All form fields in the order they appear on the original form. Each field has a source indicating where the value came from.',
      ),
  }),
  execute: async (input) => input,
});
```

- [ ] **Step 2: Run a type check on the touched files**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `form-summary.ts`.

- [ ] **Step 3: Commit Tasks 3 + 4 together**

```bash
git add lib/ai/tools/gap-analysis.ts lib/ai/tools/form-summary.ts
git commit -m "feat(tools): revert gapAnalysis and formSummary to flat field arrays"
```

---

### Task 5: Update SKILL prompt — Gap Analysis Protocol

**Files:**
- Modify: `lib/ai/skills/application-protocol/SKILL.md` — Gap Analysis Protocol step 5 (currently lines 122–126)

- [ ] **Step 1: Replace step 5 of the Gap Analysis Protocol**

Find the block:

```md
5. Call the `gapAnalysis` tool with:
   - `formName`: the name of the form (e.g. "WIC Application")
   - `clientName` (optional): the participant's full name, so the card can address them by name
   - `sections`: an array of `{ id, title, fields }` grouping the missing fields. Use the form's natural sections (e.g. "Identity & eligibility", "Household composition", "Income", "Expenses & assets", "Preferences & legal"). **Keep each section to no more than 5 fields** — if a logical grouping is larger, split it into smaller, more specific sections (e.g. "Contact info" + "Identity verification" instead of one big "Identity & contact"). The card paginates each section as a separate page so the caseworker doesn't have to scroll. For each field include `{ field, options?, inputType?, multiSelect?, condition?, required?, placeholder?, note? }`. If only a few fields are missing, a single section titled after the form area is fine.
   - Do NOT include fields you already have data for. The caseworker only needs to see what's missing.
```

Replace with:

```md
5. Call the `gapAnalysis` tool with:
   - `formName`: the name of the form (e.g. "WIC Application")
   - `clientName` (optional): the participant's full name, so the card can address them by name
   - `missingFields`: an array of `{ field, options?, inputType?, multiSelect?, condition?, required?, placeholder?, note? }` listing the missing fields **in the order they appear on the original form**. The card paginates this list automatically — you do not group or chunk it.
   - Do NOT include fields you already have data for. The caseworker only needs to see what's missing.
```

- [ ] **Step 2: Verify the file still parses as Markdown**

Run: `head -5 lib/ai/skills/application-protocol/SKILL.md && grep -c '^## ' lib/ai/skills/application-protocol/SKILL.md`
Expected: frontmatter intact, top-level `## ` headings count unchanged.

---

### Task 6: Update SKILL prompt — Form Completion Summary

**Files:**
- Modify: `lib/ai/skills/application-protocol/SKILL.md` — Form Completion Summary section (currently lines 135–148)

- [ ] **Step 1: Replace the Form Completion Summary body**

Find the block:

```md
## Form Completion Summary

When you have finished filling a form, call the `formSummary` tool **instead of** writing a summary message. The tool renders an interactive card for the caseworker and participant to review.

Pass a `sections` array grouping fields by the form's natural sections. Within each section, list fields in the order they appear on the original form. Optionally pass `clientName` so the card can name the participant. For each field, set `source` to one of:

- **`database`**: value pulled directly from Apricot records
- **`caseworker`**: value provided by the caseworker this session (e.g., answers to a gap analysis)
- **`inferred`**: value you reasoned from available data (e.g., "Lives alone — no household members listed")
- **`missing`**: field could not be filled — omit `value` or leave it empty

**Field order**: Within each section, list fields in the order they appear on the original form. Group fields into the same logical sections you would see on the form (e.g. "Identity & eligibility", "Household composition", "Income"). **Keep each section to no more than 5 fields** — split larger sections into more specific ones so each page of the review modal fits without scrolling. Do NOT group by source.

**Field types**: For every field — including `missing` fields — you MUST set `inputType` based on the actual form control you observed: `"select"` for dropdowns, `"radio"` for single-choice radio buttons (pick one), `"checkbox"` for multi-select checkboxes (pick many), `"text"` for plain text inputs (or omit for text). For `"select"`, `"radio"`, and `"checkbox"` fields you MUST also include the `options` array with all available choices you observed on the form. Set `required: true` on any field that is marked as required on the form (e.g. asterisk, "required" label, or validation that blocks submission). This applies even if you could not fill the field.
```

Replace with:

```md
## Form Completion Summary

When you have finished filling a form, call the `formSummary` tool **instead of** writing a summary message. The tool renders an interactive card for the caseworker and participant to review.

Pass `fields`: a single array of every form field **in the order they appear on the original form**. Optionally pass `clientName` so the card can name the participant. The card paginates the list automatically — you do not group or chunk it. For each field, set `source` to one of:

- **`database`**: value pulled directly from Apricot records
- **`caseworker`**: value provided by the caseworker this session (e.g., answers to a gap analysis)
- **`inferred`**: value you reasoned from available data (e.g., "Lives alone — no household members listed")
- **`missing`**: field could not be filled — omit `value` or leave it empty

**Field order**: List fields in the order they appear on the original form. Do NOT reorder by source or by any other grouping.

**Field types**: For every field — including `missing` fields — you MUST set `inputType` based on the actual form control you observed: `"select"` for dropdowns, `"radio"` for single-choice radio buttons (pick one), `"checkbox"` for multi-select checkboxes (pick many), `"text"` for plain text inputs (or omit for text). For `"select"`, `"radio"`, and `"checkbox"` fields you MUST also include the `options` array with all available choices you observed on the form. Set `required: true` on any field that is marked as required on the form (e.g. asterisk, "required" label, or validation that blocks submission). This applies even if you could not fill the field.
```

- [ ] **Step 2: Quick search to confirm `sections` is fully out of the SKILL**

Run: `grep -n -i 'section' lib/ai/skills/application-protocol/SKILL.md`
Expected: only matches that refer to non-grouping concepts (e.g., "Review Screen", "Review Screen (REQUIRED)" heading, "Communication Rules" — no remaining instructions to group fields into `sections`). If you see leftover "Pass a `sections` array" or "Keep each section to no more than 5 fields" text, remove it.

- [ ] **Step 3: Commit Tasks 5 + 6 together**

```bash
git add lib/ai/skills/application-protocol/SKILL.md
git commit -m "docs(skill): drop sections grouping; require form display order"
```

---

### Task 7: Update card eyebrow text to "Page X of Y"

**Files:**
- Modify: `components/ai-elements/gap-analysis-card.tsx:349`
- Modify: `components/ai-elements/form-summary-card.tsx:333`

- [ ] **Step 1: Update `gap-analysis-card.tsx`**

Replace:

```ts
const baseEyebrow = `Section ${current + 1} of ${sections.length}`;
```

With:

```ts
const baseEyebrow = `Page ${current + 1} of ${sections.length}`;
```

- [ ] **Step 2: Update `form-summary-card.tsx`**

Replace:

```ts
const baseEyebrow = `Section ${current + 1} of ${sections.length}`;
```

With:

```ts
const baseEyebrow = `Page ${current + 1} of ${sections.length}`;
```

- [ ] **Step 3: Run the existing card tests to confirm no regressions**

Run: `npx vitest run tests/client/gap-analysis-card.test.tsx tests/client/form-summary-card.test.tsx`
Expected: all tests PASS. (The fixtures pass `sections` directly to the cards and don't assert on the eyebrow text.)

- [ ] **Step 4: Commit**

```bash
git add components/ai-elements/gap-analysis-card.tsx components/ai-elements/form-summary-card.tsx
git commit -m "feat(form-cards): label modal pages 'Page X of Y' instead of 'Section'"
```

---

### Task 8: Final verification

- [ ] **Step 1: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no new errors. The pre-existing `tests/client/benefit-applications-langing.test.tsx` errors about missing `session` are unrelated and pre-date this branch's changes.

- [ ] **Step 2: Run the relevant test files**

Run: `npx vitest run tests/client/form-cards-adapter.test.ts tests/client/gap-analysis-card.test.tsx tests/client/form-summary-card.test.tsx`
Expected: all tests PASS.

- [ ] **Step 3: Manual smoke test (localhost)**

  1. Start the dev server.
  2. Pick a non-Anthropic model in the model selector (so quota isn't an issue).
  3. Trigger a benefits application that hits `gapAnalysis` with several missing fields.
  4. Confirm the card opens, shows pages of 5, eyebrow reads "Page X of Y", fields are in form display order, and submitting/skipping returns control to the agent.
  5. Trigger `formSummary` at end-of-form and verify the same.
  6. Open an old chat (pre-this-branch) that contains a `gapAnalysis` or `formSummary` tool call with the `sections` shape. Verify the card still renders without errors.

---

## Acceptance criteria (from spec)

- [x] A new gap analysis with 14 missing fields renders as 3 pages (5, 5, 4) — covered by adapter test in Task 1.
- [x] A new form summary with 22 fields renders as 5 pages — adapter test covers chunking; smoke test covers in-app behavior.
- [x] An old chat with the `sections` shape still opens and paginates without errors — covered by adapter legacy-shape test in Task 1; smoke test in Task 8 verifies the live render.
- [x] Tool descriptions and SKILL prompt no longer mention `sections` — Tasks 3, 4, 5, 6.
- [x] Eyebrow says "Page X of Y" — Task 7.
- [x] `npx tsc --noEmit` passes for touched files — Task 8 step 1.

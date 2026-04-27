# Form Cards Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the design's `MissingInfoCard` + `ReviewCard` patterns into `GapAnalysisCard` and `FormSummaryCard` — pink summary CTA → fixed-overlay modal with section navigation, progress dots, source badges, and disabled/read-only states.

**Architecture:** Tool input schemas migrate from flat field arrays to `sections: { id, title, fields }[]`. A backward-compat adapter in `message.tsx` wraps legacy inputs into a single untitled section. Both card components are rewritten to a 4-state machine (summary | detail-modal | submitted | skipped) using shared helpers (`CardShell`, `ProgressDots`, `SectionHeader`, `FieldSourceBadge`) extracted to `components/ai-elements/form-card-shared.tsx`.

**Tech Stack:** Next.js + React 19 + TypeScript (strict), Tailwind, shadcn/ui (`@/components/ui/*`), `lucide-react` icons, AI SDK tool helpers (`ai` + `zod`), vitest-browser-react for component tests.

**Spec:** `docs/superpowers/specs/2026-04-27-form-cards-redesign.md`

**Note on shared helpers:** The spec said "co-located inside each card to start". This plan extracts them to a single `form-card-shared.tsx` file upfront — duplicating 150+ lines of CardShell/ProgressDots/SectionHeader between two files would be more painful than maintaining a shared file. Behavior unchanged from the spec; only the file layout differs.

---

## Task 1: Add shared types + adapter helper

**Files:**
- Create: `lib/types/form-cards.ts`

- [ ] **Step 1: Write the type module**

Create `lib/types/form-cards.ts`:

```ts
// Shared types for the gap-analysis and form-summary cards.
// Both tools produce sections of fields; the cards render them with section
// navigation. A small adapter wraps legacy flat-field inputs as a single
// untitled section so old saved chats continue to render.

export type GapField = {
  field: string;
  options?: string[];
  inputType?: 'text' | 'select' | 'date' | 'boolean' | 'textarea';
  multiSelect?: boolean;
  condition?: string;
  required?: boolean;
  placeholder?: string;
  note?: string;
};

export type ReviewField = {
  field: string;
  value?: string;
  source: 'database' | 'caseworker' | 'inferred' | 'missing';
  inputType?: 'text' | 'select' | 'radio' | 'checkbox';
  options?: string[];
  required?: boolean;
  inferredFrom?: string;
};

export type GapSection = {
  id: string;
  title: string;
  fields: GapField[];
};

export type ReviewSection = {
  id: string;
  title: string;
  fields: ReviewField[];
};

type LegacyGapInput = {
  sections?: GapSection[];
  missingFields?: GapField[];
};

type LegacyReviewInput = {
  sections?: ReviewSection[];
  fields?: ReviewField[];
};

export function adaptGapSections(input: LegacyGapInput | undefined): GapSection[] {
  if (input?.sections?.length) return input.sections;
  if (input?.missingFields?.length) {
    return [{ id: 'missing', title: '', fields: input.missingFields }];
  }
  return [];
}

export function adaptReviewSections(input: LegacyReviewInput | undefined): ReviewSection[] {
  if (input?.sections?.length) return input.sections;
  if (input?.fields?.length) {
    return [{ id: 'fields', title: '', fields: input.fields }];
  }
  return [];
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (file is standalone — no imports yet from outside).

- [ ] **Step 3: Commit**

```bash
git add lib/types/form-cards.ts
git commit -m "feat: add shared types + adapter helpers for form cards"
```

---

## Task 2: Create shared helper components

**Files:**
- Create: `components/ai-elements/form-card-shared.tsx`

- [ ] **Step 1: Write the shared file**

Create `components/ai-elements/form-card-shared.tsx`:

```tsx
'use client';

import { useEffect, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type CardShellProps = {
  children: ReactNode;
  expanded: boolean;
  onCollapse?: () => void;
  variant: 'cta' | 'detail';
};

// CardShell renders the outer container in two visual variants.
// `cta` = pink/accent summary used on the chat thread.
// `detail` = white card used inside the modal overlay.
// When `expanded` is true, the card mounts inside a fixed full-page overlay
// with a backdrop; clicking the backdrop or pressing ESC calls onCollapse.
export function CardShell({ children, expanded, onCollapse, variant }: CardShellProps) {
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCollapse?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, onCollapse]);

  const shellCls =
    variant === 'cta'
      ? 'relative rounded-2xl border overflow-hidden bg-[hsl(318_50%_97%)] border-[hsl(320_47%_85%)]'
      : 'relative bg-white rounded-2xl border border-border overflow-hidden';

  const shell = <div className={shellCls}>{children}</div>;

  if (!expanded) return shell;

  return (
    <>
      <div aria-hidden="true" className="opacity-0 pointer-events-none">
        {shell}
      </div>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[rgba(16,24,40,0.45)]"
        onClick={onCollapse}
      >
        <div
          className="w-full max-w-[640px] max-h-full overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {shell}
        </div>
      </div>
    </>
  );
}

type SectionHeaderProps = {
  title: string;
  eyebrow?: string;
  onClose?: () => void;
};

export function SectionHeader({ title, eyebrow, onClose }: SectionHeaderProps) {
  return (
    <div className="px-5 pt-5 pb-3 border-b border-border flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            {eyebrow}
          </div>
        )}
        {title && (
          <h3 className="font-source-serif text-[22px] font-semibold text-foreground">
            {title}
          </h3>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 -mt-1 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

type ProgressDotsProps = {
  count: number;
  current: number;
  onJump: (i: number) => void;
};

export function ProgressDots({ count, current, onJump }: ProgressDotsProps) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onJump(i)}
          aria-label={`Go to section ${i + 1}`}
          aria-current={i === current ? 'step' : undefined}
          className={cn(
            'w-2 h-2 rounded-full transition-colors',
            i === current
              ? 'bg-primary'
              : 'bg-[hsl(220_13%_86%)] hover:bg-[hsl(220_13%_72%)]',
          )}
        />
      ))}
    </div>
  );
}

type FieldSourceBadgeProps = {
  source: 'database' | 'caseworker' | 'inferred' | 'missing';
  required?: boolean;
};

// Maps the existing four-value source enum to the design's pill variants.
// Database keeps the Nava-specific "Apricot 360" label.
export function FieldSourceBadge({ source, required }: FieldSourceBadgeProps) {
  if (source === 'missing') {
    if (required) {
      return (
        <span className="text-[10px] font-medium uppercase tracking-wider font-mono whitespace-nowrap px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
          Required
        </span>
      );
    }
    return (
      <span className="text-[10px] font-medium uppercase tracking-wider font-mono whitespace-nowrap px-2.5 py-1 rounded-full bg-stone-100 text-zinc-700">
        Optional
      </span>
    );
  }
  if (source === 'inferred') {
    return (
      <span className="text-[10px] font-medium uppercase tracking-wider font-mono whitespace-nowrap px-2.5 py-1 rounded-full bg-[hsl(318_50%_93%)] text-primary">
        Auto-filled
      </span>
    );
  }
  if (source === 'database') {
    return (
      <span className="text-[10px] font-medium uppercase tracking-wider font-mono whitespace-nowrap px-2.5 py-1 rounded-full bg-stone-100 text-zinc-700">
        Apricot 360
      </span>
    );
  }
  // caseworker
  return (
    <span className="text-[10px] font-medium uppercase tracking-wider font-mono whitespace-nowrap px-2.5 py-1 rounded-full bg-stone-100 text-zinc-700">
      Manual
    </span>
  );
}

type ModalNavBarProps = {
  current: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
  onJump: (i: number) => void;
  isLast: boolean;
  rightSlot?: ReactNode;
};

// Sticky bottom bar inside the detail modal: Back | dots | Next/right slot.
// `rightSlot` lets the caller render the Submit button on the last section
// (or render nothing in read-only mode).
export function ModalNavBar({ current, count, onPrev, onNext, onJump, isLast, rightSlot }: ModalNavBarProps) {
  return (
    <div className="px-5 py-4 border-t border-border grid grid-cols-3 items-center gap-3 bg-white sticky bottom-0">
      <button
        type="button"
        onClick={onPrev}
        className="justify-self-start flex items-center gap-1.5 text-[14px] font-semibold px-4 py-2.5 rounded-full border border-border hover:bg-muted"
      >
        <ChevronLeft size={14} /> Back
      </button>
      <ProgressDots count={count} current={current} onJump={onJump} />
      <div className="justify-self-end flex items-center gap-2">
        {isLast ? (
          rightSlot
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="flex items-center gap-1.5 text-[14px] font-semibold px-5 py-2.5 rounded-full border border-border hover:bg-muted"
          >
            Next <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/ai-elements/form-card-shared.tsx
git commit -m "feat: add shared CardShell + helpers for form cards"
```

---

## Task 3: Update `gapAnalysis` tool schema

**Files:**
- Modify: `lib/ai/tools/gap-analysis.ts`

- [ ] **Step 1: Replace the schema**

Replace the entire content of `lib/ai/tools/gap-analysis.ts`:

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

const gapSectionSchema = z.object({
  id: z.string().describe('Stable id for the section, e.g. "identity", "household"'),
  title: z
    .string()
    .describe(
      'Human-readable section title shown to the caseworker, e.g. "Identity & eligibility"',
    ),
  fields: z.array(gapFieldSchema).describe('Missing fields belonging to this section'),
});

export const gapAnalysis = tool({
  description:
    'Display a gap analysis card showing ONLY the missing fields the caseworker needs to provide. Group related fields into sections (e.g., "Identity & eligibility", "Household composition", "Income"). Do NOT include fields you already have data for. Do NOT write any text listing available or missing fields before or after calling this tool. No summaries, no bullet points. Just call the tool and follow with one short sentence like "Please provide the missing info above." If there are no missing fields, do not call this tool — just proceed to fill the form.',
  inputSchema: z.object({
    formName: z
      .string()
      .optional()
      .describe('Name of the form being filled, e.g. "WIC Application"'),
    clientName: z
      .string()
      .optional()
      .describe('Full name of the participant the form is being filled for'),
    sections: z
      .array(gapSectionSchema)
      .describe(
        'Missing fields grouped by section. If a form has very few missing fields a single section is fine.',
      ),
  }),
  execute: async (input) => input,
});
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: FAIL — `message.tsx` still reads `input?.missingFields`. That's fine; we'll fix it in Task 7. Note the failures and move on.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/tools/gap-analysis.ts
git commit -m "feat(tools): migrate gapAnalysis to sections schema"
```

---

## Task 4: Update `formSummary` tool schema

**Files:**
- Modify: `lib/ai/tools/form-summary.ts`

- [ ] **Step 1: Replace the schema**

Replace the entire content of `lib/ai/tools/form-summary.ts`:

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

const sectionSchema = z.object({
  id: z.string().describe('Stable id for the section, e.g. "identity", "household"'),
  title: z
    .string()
    .describe(
      'Human-readable section title shown to the caseworker, e.g. "Identity & eligibility"',
    ),
  fields: z
    .array(fieldSchema)
    .describe(
      'Fields belonging to this section, in the order they appear on the original form.',
    ),
});

export const formSummary = tool({
  description:
    'Display a form summary card showing what was filled in and where each value came from. Group fields into the same logical sections you would see on the form (e.g., "Identity & eligibility", "Household composition", "Income"). Call this INSTEAD of writing a summary message at the end of form completion. The card already displays all information — do NOT write any text listing the fields before or after calling this tool. Just call the tool, then follow with one short sentence like "Please review and submit when ready."',
  inputSchema: z.object({
    formName: z
      .string()
      .optional()
      .describe('Name of the form that was filled, e.g. "WIC Application"'),
    clientName: z
      .string()
      .optional()
      .describe('Full name of the participant the form was filled for'),
    sections: z
      .array(sectionSchema)
      .describe(
        'All form fields grouped into sections, in the order sections appear on the original form.',
      ),
  }),
  execute: async (input) => input,
});
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: FAIL — `message.tsx` still reads `input?.fields`. Fixed in Task 7.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/tools/form-summary.ts
git commit -m "feat(tools): migrate formSummary to sections schema"
```

---

## Task 5: Rewrite `GapAnalysisCard`

**Files:**
- Modify (full rewrite): `components/ai-elements/gap-analysis-card.tsx`

- [ ] **Step 1: Replace the component**

Replace the entire content of `components/ai-elements/gap-analysis-card.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';
import type { GapField, GapSection } from '@/lib/types/form-cards';
import {
  CardShell,
  ModalNavBar,
  SectionHeader,
} from './form-card-shared';

interface GapAnalysisCardProps {
  formName?: string;
  clientName?: string;
  sections: GapSection[];
  sendMessage?: UseChatHelpers<ChatMessage>['sendMessage'];
  isSubmitted?: boolean;
  isSkipped?: boolean;
  isArtifactVisible?: boolean;
  className?: string;
}

export function GapAnalysisCard({
  formName,
  clientName,
  sections,
  sendMessage,
  isSubmitted = false,
  isSkipped = false,
  isArtifactVisible = true,
  className,
}: GapAnalysisCardProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitted, setSubmitted] = useState(isSubmitted);
  const [skipped, setSkipped] = useState(isSkipped);
  const [expanded, setExpanded] = useState(false);
  const [current, setCurrent] = useState(0);

  const totalFields = sections.reduce((n, s) => n + s.fields.length, 0);
  const disabled = skipped || !isArtifactVisible;
  const firstName = clientName?.split(' ')[0];

  function updateAnswer(field: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [field]: value }));
  }

  function toggleCheckbox(field: string, option: string, checked: boolean) {
    setAnswers((prev) => {
      const cur = (prev[field] as string[]) ?? [];
      return {
        ...prev,
        [field]: checked ? [...cur, option] : cur.filter((v) => v !== option),
      };
    });
  }

  function openModal(at = 0) {
    setCurrent(at);
    setExpanded(true);
  }

  function collapse() {
    setExpanded(false);
  }

  function handleSkip() {
    if (!sendMessage) return;
    sendMessage({
      role: 'user',
      parts: [
        {
          type: 'text',
          text: 'Skipped adding more data for now. Please continue with filling in with the data you already have.',
        },
      ],
    });
    setSkipped(true);
  }

  function handleSubmit() {
    if (!sendMessage) return;
    const lines: string[] = [];
    lines.push(formName ? `Answers for ${formName}:` : 'Answers for gap analysis:');
    for (const section of sections) {
      for (const field of section.fields) {
        const answer = answers[field.field];
        if (answer === undefined || answer === '') continue;
        const value = Array.isArray(answer) ? answer.join(', ') : answer;
        if (!value) continue;
        const separator = field.field.endsWith('?') ? '' : ':';
        lines.push(`- ${field.field}${separator} ${value}`);
      }
    }
    if (lines.length <= 1) return;
    sendMessage({ role: 'user', parts: [{ type: 'text', text: lines.join('\n') }] });
    setSubmitted(true);
    collapse();
  }

  function renderField(field: GapField) {
    const { field: name, options, inputType, multiSelect, condition, note, placeholder, required } = field;
    const helperText = note ?? condition;

    const fieldLabel = (
      <div className="mb-2">
        <span className="font-source-serif text-[15px] font-semibold">{name}</span>
        {required && <span className="text-red-700 ml-0.5">*</span>}
        {helperText && (
          <div className="text-[13px] text-muted-foreground mt-0.5 font-inter">{helperText}</div>
        )}
      </div>
    );

    if (multiSelect && options && options.length > 0) {
      const selected = (answers[name] as string[]) ?? [];
      return (
        <fieldset>
          {fieldLabel}
          <div className="flex flex-col gap-2">
            {options.map((option) => (
              <div key={option} className="flex items-center gap-2">
                <Checkbox
                  id={`${name}-${option}`}
                  checked={selected.includes(option)}
                  onCheckedChange={(checked) => toggleCheckbox(name, option, !!checked)}
                />
                <Label htmlFor={`${name}-${option}`} className="text-sm font-normal cursor-pointer">
                  {option}
                </Label>
              </div>
            ))}
          </div>
        </fieldset>
      );
    }
    if (inputType === 'boolean') {
      return (
        <div>
          {fieldLabel}
          <RadioGroup
            value={(answers[name] as string) ?? ''}
            onValueChange={(value) => updateAnswer(name, value)}
            className="flex items-center gap-5"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="Yes" id={`${name}-yes`} />
              <Label htmlFor={`${name}-yes`} className="text-sm font-normal cursor-pointer">
                Yes
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="No" id={`${name}-no`} />
              <Label htmlFor={`${name}-no`} className="text-sm font-normal cursor-pointer">
                No
              </Label>
            </div>
          </RadioGroup>
        </div>
      );
    }
    if (inputType === 'select' && options && options.length > 0) {
      return (
        <div>
          {fieldLabel}
          <Select
            value={(answers[name] as string) ?? ''}
            onValueChange={(value) => updateAnswer(name, value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={placeholder ?? 'Select an option'} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (inputType === 'textarea') {
      return (
        <div>
          {fieldLabel}
          <Textarea
            value={(answers[name] as string) ?? ''}
            onChange={(e) => updateAnswer(name, e.target.value)}
            placeholder={placeholder ?? `Enter ${name.toLowerCase()}`}
          />
        </div>
      );
    }
    if (inputType === 'date') {
      return (
        <div>
          {fieldLabel}
          <Input
            type="date"
            value={(answers[name] as string) ?? ''}
            onChange={(e) => updateAnswer(name, e.target.value)}
          />
        </div>
      );
    }
    return (
      <div>
        {fieldLabel}
        <Input
          type="text"
          value={(answers[name] as string) ?? ''}
          onChange={(e) => updateAnswer(name, e.target.value)}
          placeholder={placeholder ?? `Enter ${name.toLowerCase()}`}
        />
      </div>
    );
  }

  // ---------- Submitted summary state ----------
  if (submitted && !expanded) {
    const filledCount = Object.values(answers).filter(
      (v) => v != null && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== ''),
    ).length;
    return (
      <CardShell expanded={false} variant="cta">
        <div className={cn('p-5', className)}>
          <div className="font-source-serif text-[14px]">
            <div className="flex items-center gap-1.5 mb-3 text-[hsl(142_55%_28%)]">
              <Check className="w-3.5 h-3.5" />
              <p className="font-bold">Information submitted</p>
            </div>
            <p className="mb-4 text-foreground">
              {filledCount > 0
                ? <>You filled in {filledCount} of {totalFields} field{totalFields === 1 ? '' : 's'}.{clientName ? <> I&rsquo;ll apply these to {clientName}&rsquo;s application.</> : null}</>
                : <>Your responses have been applied{clientName ? <> to {clientName}&rsquo;s application</> : null}.</>}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSubmitted(false); openModal(0); }}
            disabled={disabled}
            className="gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit responses
          </Button>
        </div>
      </CardShell>
    );
  }

  // ---------- Skipped summary state ----------
  if (skipped && !expanded) {
    return (
      <CardShell expanded={false} variant="cta">
        <div className={cn('p-5', className)}>
          <div className="font-source-serif text-[14px]">
            <p className="font-bold mb-3 text-muted-foreground">Skipped for now</p>
            <p className="mb-4 text-foreground">
              {firstName
                ? <>You can come back to fill in {firstName}&rsquo;s {totalFields} missing field{totalFields === 1 ? '' : 's'} anytime.</>
                : <>You can come back to fill in the missing fields anytime.</>}
            </p>
          </div>
          <Button size="sm" disabled className="gap-1.5">
            <Pencil className="w-3.5 h-3.5" />
            Provide info
          </Button>
        </div>
      </CardShell>
    );
  }

  // ---------- Detail modal (expanded) ----------
  if (expanded) {
    const section = sections[current];
    const isLast = current === sections.length - 1;
    return (
      <CardShell expanded variant="detail" onCollapse={collapse}>
        <SectionHeader
          title={section.title || formName || 'Missing information'}
          eyebrow={sections.length > 1 ? `Section ${current + 1} of ${sections.length}` : undefined}
          onClose={collapse}
        />
        <div className="py-3">
          {section.fields.map((f) => (
            <div key={f.field} className="px-5 py-2">
              {renderField(f)}
            </div>
          ))}
        </div>
        <ModalNavBar
          current={current}
          count={sections.length}
          onPrev={() => (current === 0 ? collapse() : setCurrent((c) => Math.max(0, c - 1)))}
          onNext={() => setCurrent((c) => Math.min(sections.length - 1, c + 1))}
          onJump={setCurrent}
          isLast={isLast}
          rightSlot={
            <button
              type="button"
              onClick={handleSubmit}
              className="text-[14px] font-semibold px-5 py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Submit updates
            </button>
          }
        />
      </CardShell>
    );
  }

  // ---------- Default summary CTA ----------
  return (
    <CardShell expanded={false} variant="cta">
      <div className={cn('p-5', className)}>
        <div className="font-source-serif text-[14px]">
          <p className="font-bold mb-3">Missing information</p>
          <p className="mb-4 text-foreground">
            {firstName ? <>{firstName} has</> : <>You have</>} {totalFields} field{totalFields === 1 ? '' : 's'} I couldn&rsquo;t fill automatically. Add what you know — you can skip sections and come back.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => openModal(0)}
            disabled={disabled || !sendMessage || sections.length === 0}
            className="gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" />
            Provide info
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSkip}
            disabled={disabled || !sendMessage}
          >
            Skip for now
          </Button>
        </div>
      </div>
    </CardShell>
  );
}
```

- [ ] **Step 2: Add a focused component test**

Create `tests/client/gap-analysis-card.test.tsx`:

```tsx
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { GapAnalysisCard } from '@/components/ai-elements/gap-analysis-card';

const SECTIONS = [
  {
    id: 'identity',
    title: 'Identity & eligibility',
    fields: [
      { field: 'Social Security Number', inputType: 'text' as const, required: true },
    ],
  },
];

test('renders the summary CTA with Provide info and Skip buttons', async () => {
  const sendMessage = vi.fn();
  const { getByRole } = render(
    <GapAnalysisCard sections={SECTIONS} sendMessage={sendMessage} />
  );
  await expect.element(getByRole('button', { name: /provide info/i })).toBeInTheDocument();
  await expect.element(getByRole('button', { name: /skip for now/i })).toBeInTheDocument();
});

test('Skip for now sends a message and locks the buttons', async () => {
  const sendMessage = vi.fn();
  const { getByRole } = render(
    <GapAnalysisCard sections={SECTIONS} sendMessage={sendMessage} />
  );
  await getByRole('button', { name: /skip for now/i }).click();
  expect(sendMessage).toHaveBeenCalledTimes(1);
  await expect.element(getByRole('button', { name: /provide info/i })).toBeDisabled();
});

test('Provide info opens the modal and Submit updates posts the answers', async () => {
  const sendMessage = vi.fn();
  const { getByRole, getByLabelText } = render(
    <GapAnalysisCard
      formName="CalFresh"
      sections={SECTIONS}
      sendMessage={sendMessage}
    />
  );
  await getByRole('button', { name: /provide info/i }).click();
  await getByLabelText(/social security number/i).fill('123-45-6789');
  await getByRole('button', { name: /submit updates/i }).click();
  expect(sendMessage).toHaveBeenCalledTimes(1);
  const args = sendMessage.mock.calls[0][0];
  expect(args.parts[0].text).toContain('Answers for CalFresh');
  expect(args.parts[0].text).toContain('123-45-6789');
});

test('artifact closed disables the CTA buttons', async () => {
  const { getByRole } = render(
    <GapAnalysisCard sections={SECTIONS} sendMessage={vi.fn()} isArtifactVisible={false} />
  );
  await expect.element(getByRole('button', { name: /provide info/i })).toBeDisabled();
  await expect.element(getByRole('button', { name: /skip for now/i })).toBeDisabled();
});
```

- [ ] **Step 3: Run the tests**

Run: `pnpm test -- gap-analysis-card --run`
Expected: 4 passing tests.

- [ ] **Step 4: Commit**

```bash
git add components/ai-elements/gap-analysis-card.tsx tests/client/gap-analysis-card.test.tsx
git commit -m "feat: rewrite GapAnalysisCard with sections + modal flow"
```

---

## Task 6: Rewrite `FormSummaryCard`

**Files:**
- Modify (full rewrite): `components/ai-elements/form-summary-card.tsx`

- [ ] **Step 1: Replace the component**

Replace the entire content of `components/ai-elements/form-summary-card.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { Check, ClipboardCheck, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';
import type { ReviewField, ReviewSection } from '@/lib/types/form-cards';
import {
  CardShell,
  FieldSourceBadge,
  ModalNavBar,
  SectionHeader,
} from './form-card-shared';

interface FormSummaryCardProps {
  formName?: string;
  clientName?: string;
  sections: ReviewSection[];
  sendMessage?: UseChatHelpers<ChatMessage>['sendMessage'];
  isArtifactVisible?: boolean;
  className?: string;
}

export function FormSummaryCard({
  formName,
  clientName,
  sections,
  sendMessage,
  isArtifactVisible = true,
  className,
}: FormSummaryCardProps) {
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [current, setCurrent] = useState(0);

  const issueIndexes = useMemo(
    () =>
      sections
        .map((s, i) => (s.fields.some((f) => f.source === 'missing' && f.required) ? i : -1))
        .filter((i) => i >= 0),
    [sections],
  );
  const totalFields = sections.reduce((n, s) => n + s.fields.length, 0);
  const missingRequiredCount = sections.reduce(
    (n, s) => n + s.fields.filter((f) => f.source === 'missing' && f.required).length,
    0,
  );
  const hasIssues = issueIndexes.length > 0;
  const hasData = sections.some((s) => s.fields.some((f) => f.value));
  const disabled = skipped || !isArtifactVisible;

  function setEdit(name: string, value: string) {
    setEditValues((prev) => ({ ...prev, [name]: value }));
  }

  function valueFor(field: ReviewField) {
    return editValues[field.field] ?? field.value ?? '';
  }

  function openEditable(at: number) {
    setReadOnly(false);
    setCurrent(at);
    setExpanded(true);
  }

  function openReadOnly(at = 0) {
    setReadOnly(true);
    setCurrent(at);
    setExpanded(true);
  }

  function collapse() {
    setExpanded(false);
  }

  function handleSkip() {
    setSkipped(true);
  }

  function handleConfirm() {
    if (sendMessage) {
      const changes: string[] = [];
      for (const section of sections) {
        for (const field of section.fields) {
          const next = editValues[field.field];
          if (next !== undefined && next !== (field.value ?? '') && next.trim() !== '') {
            changes.push(`- ${field.field}: ${next}`);
          }
        }
      }
      const formContext = formName ? ` for ${formName}` : '';
      const text =
        changes.length > 0
          ? `Please update the following form fields${formContext}:\n${changes.join('\n')}\n\nOnce updated, please ask the user to click the "Take control" button to take control and submit the form.`
          : `The form${formContext} looks good. The form is complete, please ask the user to click the "Take control" button to take control and submit the form.`;
      sendMessage({ role: 'user', parts: [{ type: 'text', text }] });
    }
    setConfirmed(true);
    collapse();
  }

  function renderEditableField(field: ReviewField) {
    const value = valueFor(field);
    const onChange = (v: string) => setEdit(field.field, v);
    const isMissingRequired = field.source === 'missing' && field.required;
    const inputClass = cn(
      'mt-1 h-9 text-sm bg-background',
      isMissingRequired && !value && 'border-[hsl(6_65%_60%)] bg-[hsl(6_80%_98%)]',
    );

    switch (field.inputType) {
      case 'select':
        return (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={inputClass}>
              <SelectValue placeholder={isMissingRequired ? 'Required — select an option' : 'Select…'} />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'radio':
        return (
          <RadioGroup value={value} onValueChange={onChange} className="mt-2 flex flex-col gap-1.5">
            {(field.options ?? []).map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <RadioGroupItem value={opt} id={`${field.field}-${opt}`} />
                <Label htmlFor={`${field.field}-${opt}`} className="text-sm font-normal cursor-pointer">
                  {opt}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );
      case 'checkbox': {
        const selected = value ? value.split(',').map((s) => s.trim()) : [];
        const toggle = (opt: string) => {
          const next = selected.includes(opt)
            ? selected.filter((s) => s !== opt)
            : [...selected, opt];
          onChange(next.join(', '));
        };
        return (
          <div className="mt-2 flex flex-col gap-1.5">
            {(field.options ?? []).map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <Checkbox
                  id={`${field.field}-${opt}`}
                  checked={selected.includes(opt)}
                  onCheckedChange={() => toggle(opt)}
                />
                <Label htmlFor={`${field.field}-${opt}`} className="text-sm font-normal cursor-pointer">
                  {opt}
                </Label>
              </div>
            ))}
          </div>
        );
      }
      default:
        return (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={isMissingRequired ? 'Required — enter a value' : ''}
            className={inputClass}
          />
        );
    }
  }

  function renderRow(field: ReviewField) {
    const value = valueFor(field);
    const isMissingRequired = field.source === 'missing' && field.required;
    return (
      <div key={field.field} className="px-5 py-3 border-b border-border last:border-b-0">
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="font-source-serif text-[15px] font-semibold text-foreground">
            {field.field}
            {field.required && <span className="text-red-700 ml-0.5">*</span>}
          </span>
          <FieldSourceBadge source={field.source} required={field.required} />
        </div>
        {readOnly ? (
          value ? (
            <p className="text-sm text-foreground font-inter">{value}</p>
          ) : (
            <p className={cn('text-sm font-inter', isMissingRequired ? 'text-red-700' : 'text-muted-foreground')}>
              Not provided
            </p>
          )
        ) : (
          renderEditableField(field)
        )}
      </div>
    );
  }

  // ---------- Confirmed summary ----------
  if (confirmed && !expanded) {
    return (
      <CardShell expanded={false} variant="cta">
        <div className={cn('p-5', className)}>
          <div className="font-source-serif text-[14px]">
            <div className="flex items-center gap-1.5 mb-3 text-[hsl(142_55%_28%)]">
              <Check className="w-3.5 h-3.5" />
              <p className="font-bold">Application submitted</p>
            </div>
            <p className="mb-4 text-foreground">
              {clientName ? <>{clientName}&rsquo;s</> : <>The</>} {formName ? `${formName} ` : ''}application has been submitted.
            </p>
          </div>
          {hasData && (
            <Button variant="outline" size="sm" onClick={() => openReadOnly(0)} className="gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              View submitted
            </Button>
          )}
        </div>
      </CardShell>
    );
  }

  // ---------- Skipped summary ----------
  if (skipped && !expanded) {
    return (
      <CardShell expanded={false} variant="cta">
        <div className={cn('p-5', className)}>
          <div className="font-source-serif text-[14px]">
            <p className="font-bold mb-3 text-muted-foreground">Review skipped</p>
            <p className="mb-4 text-foreground">
              You can come back to review {clientName ? `${clientName}'s ` : ''}application before submitting.
            </p>
          </div>
          {hasData ? (
            <Button variant="outline" size="sm" onClick={() => openReadOnly(0)} className="gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              View submitted
            </Button>
          ) : (
            <Button size="sm" disabled className="gap-1.5">
              <ClipboardCheck className="w-3.5 h-3.5" />
              Start review
            </Button>
          )}
        </div>
      </CardShell>
    );
  }

  // ---------- Detail modal ----------
  if (expanded) {
    const section = sections[current];
    const isLast = current === sections.length - 1;
    const submitButton =
      readOnly || disabled ? null : (
        <button
          type="button"
          onClick={handleConfirm}
          className="text-[14px] font-semibold px-5 py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Submit updates
        </button>
      );
    return (
      <CardShell expanded variant="detail" onCollapse={collapse}>
        <SectionHeader
          title={section.title || formName || 'Review'}
          eyebrow={sections.length > 1 ? `Section ${current + 1} of ${sections.length}` : undefined}
          onClose={collapse}
        />
        <div>
          {section.fields.map((f) => renderRow(f))}
          {section.fields.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground">No fields in this section.</p>
          )}
        </div>
        <ModalNavBar
          current={current}
          count={sections.length}
          onPrev={() => (current === 0 ? collapse() : setCurrent((c) => Math.max(0, c - 1)))}
          onNext={() => setCurrent((c) => Math.min(sections.length - 1, c + 1))}
          onJump={setCurrent}
          isLast={isLast}
          rightSlot={submitButton}
        />
      </CardShell>
    );
  }

  // ---------- Default summary CTA ----------
  // When disabled with captured data, swap the primary action for "View submitted".
  if (disabled && hasData) {
    return (
      <CardShell expanded={false} variant="cta">
        <div className={cn('p-5', className)}>
          <div className="font-source-serif text-[14px]">
            <p className="font-bold mb-3">Application ready for review</p>
            <p className="mb-4 text-foreground">
              {hasIssues
                ? <>I filled in {totalFields - missingRequiredCount} of {totalFields} fields{clientName ? <> for {clientName}</> : null}. {missingRequiredCount} required field{missingRequiredCount === 1 ? ' is' : 's are'} still missing.</>
                : <>I filled in all {totalFields} fields{clientName ? <> for {clientName}</> : null}.</>}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => openReadOnly(issueIndexes[0] ?? 0)} className="gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            View submitted
          </Button>
        </div>
      </CardShell>
    );
  }

  return (
    <CardShell expanded={false} variant="cta">
      <div className={cn('p-5', className)}>
        <div className="font-source-serif text-[14px]">
          <p className="font-bold mb-3">Application ready for review</p>
          <p className="mb-4 text-foreground">
            {hasIssues
              ? <>I filled in {totalFields - missingRequiredCount} of {totalFields} fields{clientName ? <> for {clientName}</> : null}. {missingRequiredCount} required field{missingRequiredCount === 1 ? ' is' : 's are'} still missing — review and fill them in before submitting.</>
              : <>I filled in all {totalFields} fields{clientName ? <> for {clientName}</> : null}. Review the answers before submitting.</>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => openEditable(hasIssues ? issueIndexes[0] : 0)}
            disabled={disabled || sections.length === 0}
            className="gap-1.5"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            {hasIssues ? 'Start review' : 'Review & submit'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSkip} disabled={disabled}>
            Skip for now
          </Button>
        </div>
      </div>
    </CardShell>
  );
}
```

- [ ] **Step 2: Add a focused component test**

Create `tests/client/form-summary-card.test.tsx`:

```tsx
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { FormSummaryCard } from '@/components/ai-elements/form-summary-card';

const SECTIONS = [
  {
    id: 'identity',
    title: 'Identity & eligibility',
    fields: [
      { field: 'Full name', value: 'Rosa Martinez', source: 'database' as const },
      { field: 'SSN', value: '', source: 'missing' as const, required: true, inputType: 'text' as const },
    ],
  },
];

test('renders summary with Start review and Skip buttons', async () => {
  const { getByRole } = render(
    <FormSummaryCard formName="CalFresh" sections={SECTIONS} sendMessage={vi.fn()} />
  );
  await expect.element(getByRole('button', { name: /start review/i })).toBeInTheDocument();
  await expect.element(getByRole('button', { name: /skip for now/i })).toBeInTheDocument();
});

test('Start review opens the editable modal at the first missing-required section', async () => {
  const { getByRole, getByText } = render(
    <FormSummaryCard formName="CalFresh" sections={SECTIONS} sendMessage={vi.fn()} />
  );
  await getByRole('button', { name: /start review/i }).click();
  await expect.element(getByText('Identity & eligibility')).toBeInTheDocument();
  await expect.element(getByRole('button', { name: /submit updates/i })).toBeInTheDocument();
});

test('artifact closed with data shows View submitted', async () => {
  const { getByRole } = render(
    <FormSummaryCard
      formName="CalFresh"
      sections={SECTIONS}
      sendMessage={vi.fn()}
      isArtifactVisible={false}
    />
  );
  await expect.element(getByRole('button', { name: /view submitted/i })).toBeInTheDocument();
});

test('View submitted opens a read-only modal (no Submit updates button)', async () => {
  const { getByRole } = render(
    <FormSummaryCard
      formName="CalFresh"
      sections={SECTIONS}
      sendMessage={vi.fn()}
      isArtifactVisible={false}
    />
  );
  await getByRole('button', { name: /view submitted/i }).click();
  // Submit button must not be present in read-only mode
  const submit = getByRole('button', { name: /submit updates/i });
  await expect.element(submit).not.toBeInTheDocument();
});

test('Submit updates posts changed values back to sendMessage', async () => {
  const sendMessage = vi.fn();
  const { getByRole, getByPlaceholderText } = render(
    <FormSummaryCard formName="CalFresh" sections={SECTIONS} sendMessage={sendMessage} />
  );
  await getByRole('button', { name: /start review/i }).click();
  await getByPlaceholderText(/required — enter a value/i).fill('123-45-6789');
  await getByRole('button', { name: /submit updates/i }).click();
  expect(sendMessage).toHaveBeenCalledTimes(1);
  const text = sendMessage.mock.calls[0][0].parts[0].text;
  expect(text).toContain('Please update the following form fields for CalFresh');
  expect(text).toContain('SSN: 123-45-6789');
});
```

- [ ] **Step 3: Run the tests**

Run: `pnpm test -- form-summary-card --run`
Expected: 5 passing tests.

- [ ] **Step 4: Commit**

```bash
git add components/ai-elements/form-summary-card.tsx tests/client/form-summary-card.test.tsx
git commit -m "feat: rewrite FormSummaryCard with sections + read-only modal"
```

---

## Task 7: Wire `message.tsx` integration

**Files:**
- Modify: `components/message.tsx` lines 492–521

- [ ] **Step 1: Add the adapter import**

In `components/message.tsx`, add an import near the existing imports (after the `'./ai-elements'` import on line 21):

```tsx
import { adaptGapSections, adaptReviewSections } from '@/lib/types/form-cards';
```

- [ ] **Step 2: Update the gap analysis render branch**

Replace lines 492–505 in `components/message.tsx`:

```tsx
              if ((type as string) === 'tool-gapAnalysis') {
                const { toolCallId, state, input } = part as any;

                if (state === 'input-available' || state === 'output-available') {
                  return (
                    <GapAnalysisCard
                      key={toolCallId}
                      formName={input?.formName}
                      clientName={input?.clientName}
                      sections={adaptGapSections(input)}
                      sendMessage={sendMessage}
                      isArtifactVisible={isArtifactVisible}
                    />
                  );
                }
              }
```

- [ ] **Step 3: Update the form summary render branch**

Replace lines 507–521 in `components/message.tsx`:

```tsx
              if ((type as string) === 'tool-formSummary') {
                const { toolCallId, state, input } = part as any;

                if (state === 'input-available' || state === 'output-available') {
                  return (
                    <FormSummaryCard
                      key={toolCallId}
                      formName={input?.formName}
                      clientName={input?.clientName}
                      sections={adaptReviewSections(input)}
                      sendMessage={sendMessage}
                      isArtifactVisible={isArtifactVisible}
                    />
                  );
                }
              }
```

- [ ] **Step 4: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS — gapAnalysis/formSummary call sites now satisfy both the new tool input shape and the new card props.

- [ ] **Step 5: Commit**

```bash
git add components/message.tsx
git commit -m "feat: wire form cards to sectioned inputs with backward-compat adapter"
```

---

## Task 8: Update the `application-protocol` skill prompt

**Files:**
- Modify: `lib/ai/skills/application-protocol/SKILL.md` lines ~115–149

- [ ] **Step 1: Update the Gap Analysis Protocol section**

In `lib/ai/skills/application-protocol/SKILL.md`, replace step 5 in the "Gap Analysis Protocol" section (around line 122–125):

OLD:
```
5. Call the `gapAnalysis` tool with:
   - `formName`: the name of the form (e.g. "WIC Application")
   - `missingFields`: array of `{ field, options?, inputType?, condition? }` for data you need from the caseworker
   - Do NOT include fields you already have data for. The caseworker only needs to see what's missing.
```

NEW:
```
5. Call the `gapAnalysis` tool with:
   - `formName`: the name of the form (e.g. "WIC Application")
   - `clientName` (optional): the participant's full name, so the card can address them by name
   - `sections`: an array of `{ id, title, fields }` grouping the missing fields. Use the form's natural sections (e.g. "Identity & eligibility", "Household composition", "Income", "Expenses & assets", "Preferences & legal"). For each field include `{ field, options?, inputType?, multiSelect?, condition?, required?, placeholder?, note? }`. If only a few fields are missing, a single section titled after the form area is fine.
   - Do NOT include fields you already have data for. The caseworker only needs to see what's missing.
```

- [ ] **Step 2: Update the Form Completion Summary section**

Replace the "Pass a single `fields` array..." paragraph in the "Form Completion Summary" section (around line 138):

OLD:
```
Pass a single `fields` array in the order fields appear on the original form. For each field, set `source` to one of:
```

NEW:
```
Pass a `sections` array grouping fields by the form's natural sections. Within each section, list fields in the order they appear on the original form. Optionally pass `clientName` so the card can name the participant. For each field, set `source` to one of:
```

Also replace the "Field order" paragraph (around line 145):

OLD:
```
**Field order**: Always list fields in the order they appear on the original form. Do NOT group by source.
```

NEW:
```
**Field order**: Within each section, list fields in the order they appear on the original form. Group fields into the same logical sections you would see on the form (e.g. "Identity & eligibility", "Household composition", "Income"). Do NOT group by source.
```

- [ ] **Step 3: Commit**

```bash
git add lib/ai/skills/application-protocol/SKILL.md
git commit -m "docs(skill): teach gapAnalysis and formSummary the sections shape"
```

---

## Task 9: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Type-check the whole project**

Run: `pnpm exec tsc --noEmit`
Expected: PASS with zero errors.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: PASS (or only auto-fixed style noise).

- [ ] **Step 3: Run all client tests**

Run: `pnpm test -- --run`
Expected: PASS for `gap-analysis-card.test.tsx` (4) and `form-summary-card.test.tsx` (5), plus existing passing tests.

- [ ] **Step 4: Manual smoke check (if dev server is running)**

Spin up `pnpm dev`, open a chat that triggers `gapAnalysis` and `formSummary`, and verify by hand:

  1. Pink summary CTA renders inline
  2. `Provide info` / `Start review` opens the modal with section navigation
  3. ESC + backdrop click + × all collapse the modal
  4. Submitting from the last section sends the expected message
  5. Closing the artifact while a confirmed review card is on screen swaps the primary CTA for `View submitted` and opens a read-only modal
  6. Replaying an old saved chat (with the legacy `missingFields` / `fields` shape) renders the cards without errors

- [ ] **Step 5: No-op commit if any auto-fix lint changes were applied**

```bash
git status
# If lint touched files, stage + commit:
git add -A
git commit -m "chore: lint auto-fix"
```

---

## Self-review against the spec

| Spec requirement | Plan task |
|---|---|
| Tool schema: `gapAnalysis` accepts `sections` + `clientName` | Task 3 |
| Tool schema: `formSummary` accepts `sections` + `clientName` | Task 4 |
| Source enum unchanged (`database \| caseworker \| inferred \| missing`) | Task 4 |
| Backward-compat adapter wraps legacy inputs as one untitled section | Tasks 1, 7 |
| Skill prompt updated for sections | Task 8 |
| `CardShell`, `SectionHeader`, `ProgressDots`, `FieldSourceBadge` shared | Task 2 |
| `GapAnalysisCard` 4-state machine + modal | Task 5 |
| `FormSummaryCard` 4-state machine + modal | Task 6 |
| Disabled state for skipped + artifact-closed (gap card) | Tasks 5 + tests |
| `View submitted` + read-only modal for disabled review card with data | Tasks 6 + tests |
| `GapAnalysisCard` now receives `isArtifactVisible` from `message.tsx` | Tasks 5, 7 |
| `message.tsx` passes `sections` + `clientName` + `isArtifactVisible` | Task 7 |
| Map `database` → "Apricot 360", `caseworker` → "Manual", `inferred` → "Auto-filled", `missing+req` → "Required", `missing+!req` → "Optional" | Task 2 (`FieldSourceBadge`) |
| Required-but-empty rows get red border + tinted bg in editable mode | Task 6 (`renderEditableField`) |
| Issue-index auto-jump to first section with `missing+required` | Task 6 (`openEditable` + `issueIndexes`) |
| Test plan: legacy adapter, disabled states | Tests in Tasks 5, 6 + manual step 9.4.6 |

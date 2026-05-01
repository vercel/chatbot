// Shared types for the gap-analysis and form-summary cards.
// Tools emit a flat ordered field list; this module chunks that list
// into pages of PAGE_SIZE so the modal can paginate. Old chats that
// still carry a `sections` shape are flattened in order then re-chunked,
// so original section titles are discarded.

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

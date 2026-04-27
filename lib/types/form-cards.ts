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

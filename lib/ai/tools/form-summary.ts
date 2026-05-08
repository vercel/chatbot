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
    .describe(
      'REQUIRED for select/radio/checkbox fields. Every available choice exactly as the form labels it (e.g. ["Yes", "No"], ["Male", "Female", "Non-binary"]). The `value` you pass MUST match one of these strings character-for-character or the dropdown will render empty. Re-snapshot the form to read the real options — never guess.',
    ),
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
    'Display a form summary card showing what was filled in and where each value came from. Call this INSTEAD of writing a summary message at the end of form completion. List fields in the order they appear on the original form. NEVER include CAPTCHA, reCAPTCHA, Turnstile, "I\'m not a robot", or any bot-challenge widget — they are not form fields. Also exclude submit buttons, hidden inputs, and decorative text. The card already displays all information — do NOT write any text listing the fields before or after calling this tool. Just call the tool, then follow with one short sentence like "Please review and submit when ready."',
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

import { tool } from 'ai';
import { z } from 'zod';

const summaryFieldSchema = z.object({
  field: z.string().describe('Field label'),
  value: z.string().describe('Value that was entered'),
  inputType: z
    .enum(['text', 'select', 'radio', 'checkbox'])
    .optional()
    .describe(
      'Type of input the form field uses. Use "select" for dropdowns, "radio" for single-choice radio buttons, "checkbox" for multi-select checkboxes, or omit for plain text.',
    ),
  options: z
    .array(z.string())
    .optional()
    .describe('Available choices for select, radio, or checkbox fields'),
  required: z
    .boolean()
    .optional()
    .describe('Whether the field is required to submit the form'),
});

export const formSummary = tool({
  description:
    'Display a form summary card showing what was filled in and where each value came from. Call this INSTEAD of writing a summary message at the end of form completion. The card already displays all information — do NOT write any text listing the fields before or after calling this tool. Just call the tool, then follow with one short sentence like "Please review and submit when ready."',
  inputSchema: z.object({
    formName: z
      .string()
      .optional()
      .describe('Name of the form that was filled, e.g. "WIC Application"'),
    fromDatabase: z
      .array(summaryFieldSchema)
      .describe('Fields filled using data from the participant database'),
    fromCaseworker: z
      .array(summaryFieldSchema)
      .describe('Fields filled using data provided by the caseworker during this session'),
    inferred: z
      .array(summaryFieldSchema)
      .describe('Fields where the agent made a reasonable inference (e.g. deduced clinic location from address, assumed living alone from no household members listed)'),
    missing: z
      .array(
        z.object({
          field: z.string().describe('Field label'),
          inputType: z
            .enum(['text', 'select', 'radio', 'checkbox'])
            .optional()
            .describe('Type of input the form field uses'),
          options: z.array(z.string()).optional().describe('Available choices for select, radio, or checkbox fields'),
          required: z.boolean().optional().describe('Whether the field is required to submit the form'),
        }),
      )
      .optional()
      .describe('Fields that could not be filled (e.g. "File upload required", "CAPTCHA blocked submission"). Include inputType, options, and required if you observed them on the form.'),
    notes: z
      .string()
      .optional()
      .describe('Any important notes, caveats, or fields that could not be filled'),
  }),
  execute: async (input) => input,
});

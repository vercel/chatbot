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
    'Shows the caseworker a card listing ONLY the missing fields, grouped into sections (e.g., "Identity & eligibility", "Household composition", "Income"). Calling this tool ends your turn — do not call any other tools after it; wait for the caseworker\'s reply. Include only missing fields, no fields you already have. After calling, write one short sentence like "Please provide the missing info above." and stop. If nothing is missing, do not call this tool.',
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

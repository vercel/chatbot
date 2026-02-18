import { tool } from 'ai';
import { z } from 'zod';

const summaryFieldSchema = z.object({
  field: z.string().describe('Field label'),
  value: z.string().describe('Value that was entered'),
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
      .array(z.string())
      .optional()
      .describe('Field labels that could not be filled (e.g. "File upload required", "CAPTCHA blocked submission")'),
    notes: z
      .string()
      .optional()
      .describe('Any important notes, caveats, or fields that could not be filled'),
  }),
  execute: async (input) => input,
});

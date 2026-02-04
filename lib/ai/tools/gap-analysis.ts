import { tool } from 'ai';
import { z } from 'zod';

export const gapAnalysis = tool({
  description:
    'Display a gap analysis card showing which participant fields are available from the database and which fields the caseworker needs to provide before filling a form. Call this BEFORE filling any form fields.',
  inputSchema: z.object({
    formName: z
      .string()
      .optional()
      .describe('Name of the form being filled, e.g. "WIC Application"'),
    availableFields: z
      .array(
        z.object({
          field: z.string().describe('Field label'),
          value: z.string().describe('Value from the database'),
        }),
      )
      .describe('Fields we already have data for from the database'),
    missingFields: z
      .array(
        z.object({
          field: z.string().describe('Field label'),
          options: z
            .array(z.string())
            .optional()
            .describe('Possible answer options, if applicable'),
          inputType: z
            .enum(['text', 'select', 'date', 'boolean', 'textarea'])
            .optional()
            .describe('Expected input type'),
          multiSelect: z
            .boolean()
            .optional()
            .describe('Whether multiple options can be selected'),
          condition: z
            .string()
            .optional()
            .describe(
              'Condition under which this field is required, e.g. "if pregnant"',
            ),
        }),
      )
      .describe('Fields that need caseworker input'),
  }),
  execute: async (input) => input,
});

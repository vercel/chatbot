import { tool } from 'ai';
import { z } from 'zod';

export const gapAnalysis = tool({
  description:
    'Shows the caseworker a card listing ONLY the missing fields. Calling this tool ends your turn — do not call any other tools after it; wait for the caseworker\'s reply. Include only missing fields, no fields you already have. After calling, write one short sentence like "Please provide the missing info above." and stop. If nothing is missing, do not call this tool.',
  inputSchema: z.object({
    formName: z
      .string()
      .optional()
      .describe('Name of the form being filled, e.g. "WIC Application"'),
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

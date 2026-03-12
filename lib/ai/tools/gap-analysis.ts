import { tool } from 'ai';
import { z } from 'zod';

export const gapAnalysis = tool({
  description:
    'Display a gap analysis card showing ONLY the missing fields the caseworker needs to provide. Do NOT include fields you already have data for — the caseworker does not need to see them. Do NOT write any text listing available or missing fields before or after calling this tool. No summaries, no bullet points. Just call the tool and follow with one short sentence like "Please provide the missing info above." If there are no missing fields, do not call this tool — just proceed to fill the form.',
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

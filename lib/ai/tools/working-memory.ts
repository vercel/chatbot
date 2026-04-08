import { tool } from 'ai';
import { z } from 'zod';

export const updateWorkingMemory = tool({
  description:
    'Update the working memory with participant data, caseworker inputs, or form state. ' +
    'Call this after retrieving Apricot records, when the caseworker provides gap analysis answers, ' +
    'or when form state changes significantly. ' +
    'Each call REPLACES the entire working memory — always include the COMPLETE current state.',
  inputSchema: z.object({
    participant: z
      .record(z.unknown())
      .optional()
      .describe(
        'All participant fields from Apricot database records (name, DOB, SSN, address, etc.)',
      ),
    household: z
      .array(z.record(z.unknown()))
      .optional()
      .describe('Household members with their fields'),
    caseworkerInputs: z
      .record(z.unknown())
      .optional()
      .describe(
        'Answers the caseworker provided during this session (gap analysis responses, corrections)',
      ),
    formState: z
      .object({
        formName: z.string().optional(),
        currentUrl: z.string().optional(),
        currentStep: z.string().optional(),
        completedFields: z.record(z.string()).optional(),
        pendingFields: z.array(z.string()).optional(),
      })
      .optional()
      .describe('Current form-filling progress'),
  }),
  execute: async (input) => input,
});

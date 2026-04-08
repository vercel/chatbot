import { tool } from 'ai';
import { z } from 'zod';
import {
  getForms,
  getRecordById,
  getFormFields,
  authenticate,
} from '@/lib/apricot-api';

export const getApricotRecord = tool({
  description:
    'Get a participant/client record from Apricot360 by record ID. Use this to fetch participant data for form filling.',
  inputSchema: z.object({
    recordId: z.number().describe('The unique record ID of the participant'),
  }),
  execute: async ({ recordId }: { recordId: number }) => {
    try {
      const response = await getRecordById(recordId);
      if (response.data.length === 0) {
        return { record: null, found: false };
      }
      return { record: response.data[0], found: true };
    } catch (error) {
      return {
        record: null,
        found: false,
        error: error instanceof Error ? error.message : 'Failed to fetch record',
      };
    }
  },
});

export const getApricotForms = tool({
  description:
    'Fetch forms from Apricot360 with optional pagination and filtering.',
  inputSchema: z.object({
    pageSize: z
      .number()
      .optional()
      .describe('Number of forms to return per page (default: 25)'),
    pageNumber: z
      .number()
      .optional()
      .describe('Page number to retrieve (default: 1)'),
    sort: z
      .string()
      .optional()
      .describe('Field to sort by (e.g., "name", "-name" for descending)'),
    filters: z.record(z.string()).optional().describe('Filters to apply'),
  }),
  execute: async ({
    pageSize,
    pageNumber,
    sort,
    filters,
  }: {
    pageSize?: number;
    pageNumber?: number;
    sort?: string;
    filters?: Record<string, string>;
  }) => {
    try {
      const response = await getForms({ pageSize, pageNumber, sort, filters });
      return {
        forms: response.data,
        count: response.meta.count,
        success: true,
      };
    } catch (error) {
      return {
        forms: [],
        count: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch forms',
      };
    }
  },
});

export const getApricotForm = tool({
  description: 'Get a specific form from Apricot360 by form ID.',
  inputSchema: z.object({
    formId: z.number().describe('The unique ID of the form in Apricot360'),
  }),
  execute: async ({ formId }: { formId: number }) => {
    try {
      const response = await getForms({
        filters: { id: formId.toString() },
      });
      if (response.data.length === 0) {
        return { form: null, found: false };
      }
      return { form: response.data[0], found: true };
    } catch (error) {
      return {
        form: null,
        found: false,
        error: error instanceof Error ? error.message : 'Failed to fetch form',
      };
    }
  },
});

export const getApricotFormFields = tool({
  description:
    'Get all fields for a specific form from Apricot360. Returns field definitions including labels, types, options, and validation requirements.',
  inputSchema: z.object({
    formId: z.number().describe('The unique ID of the form in Apricot360'),
  }),
  execute: async ({ formId }: { formId: number }) => {
    try {
      const response = await getFormFields(formId);
      return {
        fields: response.data,
        count: response.meta.count,
        success: true,
      };
    } catch (error) {
      return {
        fields: [],
        count: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch form fields',
      };
    }
  },
});

export const testApricotAuth = tool({
  description:
    'Test authentication with Apricot360 API. Use this to verify API credentials are working.',
  inputSchema: z.object({}),
  execute: async (_: Record<string, never>) => {
    try {
      await authenticate();
      return { success: true, message: 'Authentication successful' };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  },
});

export const apricotTools = {
  getApricotRecord,
  getApricotForms,
  getApricotForm,
  getApricotFormFields,
  testApricotAuth,
};

import { tool } from 'ai';
import { z } from 'zod';
import {
  getUsers,
  getForms,
  getRecordById,
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

export const getApricotUsers = tool({
  description:
    'Fetch case worker users from Apricot360 with optional pagination and filtering.',
  inputSchema: z.object({
    pageSize: z
      .number()
      .optional()
      .describe('Number of users to return per page (default: 25)'),
    pageNumber: z
      .number()
      .optional()
      .describe('Page number to retrieve (default: 1)'),
    sort: z
      .string()
      .optional()
      .describe(
        'Field to sort by (e.g., "username", "-username" for descending)'
      ),
    filters: z
      .record(z.string())
      .optional()
      .describe('Filters to apply (e.g., {"active": "1"})'),
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
      const response = await getUsers({ pageSize, pageNumber, sort, filters });
      return {
        users: response.data,
        count: response.meta.count,
        success: true,
      };
    } catch (error) {
      return {
        users: [],
        count: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch users',
      };
    }
  },
});

export const searchApricotUsers = tool({
  description:
    'Search for case worker users in Apricot360 by first name, last name, or username.',
  inputSchema: z.object({
    firstName: z.string().optional().describe('First name to search for'),
    lastName: z.string().optional().describe('Last name to search for'),
    username: z.string().optional().describe('Username to search for'),
  }),
  execute: async ({
    firstName,
    lastName,
    username,
  }: {
    firstName?: string;
    lastName?: string;
    username?: string;
  }) => {
    try {
      const filters: Record<string, string> = {};
      if (firstName) filters['name_first'] = firstName;
      if (lastName) filters['name_last'] = lastName;
      if (username) filters['username'] = username;

      const response = await getUsers({ filters });
      return {
        users: response.data,
        count: response.meta.count,
        success: true,
      };
    } catch (error) {
      return {
        users: [],
        count: 0,
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to search users',
      };
    }
  },
});

export const getApricotUser = tool({
  description: 'Get a specific case worker user from Apricot360 by user ID.',
  inputSchema: z.object({
    userId: z.number().describe('The unique ID of the user in Apricot360'),
  }),
  execute: async ({ userId }: { userId: number }) => {
    try {
      const response = await getUsers({
        filters: { id: userId.toString() },
      });
      if (response.data.length === 0) {
        return { user: null, found: false };
      }
      return { user: response.data[0], found: true };
    } catch (error) {
      return {
        user: null,
        found: false,
        error: error instanceof Error ? error.message : 'Failed to fetch user',
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
  getApricotUsers,
  searchApricotUsers,
  getApricotUser,
  getApricotForms,
  getApricotForm,
  testApricotAuth,
};

import { z } from 'zod';

// ===== Input Schemas for Tools =====

export const getUsersSchema = z.object({
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
});

export const searchUsersByNameSchema = z.object({
  firstName: z.string().optional().describe('First name to search for'),
  lastName: z.string().optional().describe('Last name to search for'),
  username: z.string().optional().describe('Username to search for'),
});

export const getUserByIdSchema = z.object({
  userId: z.number().describe('The unique ID of the user in Apricot360'),
});

export const getFormsSchema = z.object({
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
  filters: z
    .record(z.string())
    .optional()
    .describe('Filters to apply (e.g., {"field_123": "value"})'),
});

export const getFormByIdSchema = z.object({
  formId: z.number().describe('The unique ID of the form in Apricot360'),
});

export const getRecordByIdSchema = z.object({
  recordId: z.number().describe('The unique ID of the record in Apricot360'),
});

// ===== Output Schemas for Tools =====

export const userSchema = z.object({
  id: z.number(),
  type: z.string(),
  attributes: z.object({
    org_id: z.number(),
    username: z.string(),
    user_type: z.string(),
    name_first: z.string(),
    name_middle: z.string(),
    name_last: z.string(),
    login_attempts: z.number(),
    mod_time: z.string(),
    mod_user: z.number(),
    active: z.number(),
    password_reset: z.string(),
    additionalProp1: z.string().optional(),
    additionalProp2: z.string().optional(),
    additionalProp3: z.string().optional(),
  }),
  links: z.object({
    additionalProp1: z.string().optional(),
    additionalProp2: z.string().optional(),
    additionalProp3: z.string().optional(),
  }),
});

export const getUsersResponseSchema = z.object({
  users: z.array(userSchema),
  count: z.number(),
  success: z.boolean(),
  error: z.string().optional(),
});

export const getUserByIdResponseSchema = z.object({
  user: userSchema.nullable(),
  found: z.boolean(),
  error: z.string().optional(),
});

export const formSchema = z.object({
  id: z.number(),
  type: z.string(),
  attributes: z.object({
    name: z.string(),
    parent_id: z.number(),
    description: z.string(),
    active: z.number(),
    creation_time: z.string(),
    creation_user: z.string(),
    mod_time: z.string(),
    mod_user: z.string(),
    sort_order: z.number(),
    reference_tag: z.string(),
    program_assignment_type: z.number(),
    form_logic_enabled: z.number(),
    guid: z.string(),
    parent_guid: z.string(),
  }),
});

export const getFormsResponseSchema = z.object({
  forms: z.array(formSchema),
  count: z.number(),
  success: z.boolean(),
  error: z.string().optional(),
});

export const getFormByIdResponseSchema = z.object({
  form: formSchema.nullable(),
  found: z.boolean(),
  error: z.string().optional(),
});

// ===== Record Schemas =====

export const recordSchema = z.object({
  id: z.number(),
  type: z.string(),
  attributes: z
    .object({
      form_id: z.number(),
      parent_id: z.number(),
      active: z.number(),
      name: z.string(),
      creation_time: z.string(),
      creation_user: z.number(),
      mod_time: z.string(),
      mod_user: z.number(),
      owner: z.number(),
      additionalProp1: z.string().optional(),
      additionalProp2: z.string().optional(),
      additionalProp3: z.string().optional(),
    })
    .passthrough(), // Allow additional dynamic fields
  links: z
    .object({
      additionalProp1: z.string().optional(),
      additionalProp2: z.string().optional(),
      additionalProp3: z.string().optional(),
    })
    .passthrough(), // Allow additional links
});

export const getRecordByIdResponseSchema = z.object({
  record: recordSchema.nullable(),
  found: z.boolean(),
  error: z.string().optional(),
});

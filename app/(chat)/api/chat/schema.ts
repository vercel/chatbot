import { z } from 'zod';

const textPartSchema = z.object({
  type: z.enum(['text']),
  text: z.string().min(1).max(2000),
});

const filePartSchema = z.object({
  type: z.enum(['file']),
  mediaType: z.enum(['image/jpeg', 'image/png']),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(['user']),
    parts: z.array(partSchema),
  }),
  selectedChatModel: z.enum([
    'chat-model',
    'chat-model-reasoning',
    'web-automation-model',
  ]),
  // Dev-only: overrides the actual LLM used without changing the routing logic.
  // Ignored in production environments.
  modelOverride: z.enum([
    'gpt-4o',
    'gpt-4o-mini',
    'o1-mini',
    'claude-sonnet-4-6',
    'claude-haiku-4-5',
    'grok-2-1212',
    'gemini-2.5-flash',
    'gemini-3.1',
    'gemini-3.1-flash',
  ]).optional(),
  selectedVisibilityType: z.enum(['public', 'private']),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;

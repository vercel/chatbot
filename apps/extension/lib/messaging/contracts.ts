import { z } from 'zod';
import type { ActivePageContext } from '@/lib/types';

export const backgroundRequestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('auth/get-token'),
    interactive: z.boolean(),
  }),
  z.object({
    type: z.literal('auth/invalidate-token'),
    token: z.string(),
  }),
  z.object({
    type: z.literal('auth/clear'),
  }),
  z.object({
    type: z.literal('auth/profile'),
  }),
  z.object({
    type: z.literal('page/get-active-context'),
  }),
]);

export type BackgroundRequest = z.infer<typeof backgroundRequestSchema>;

const authTokenResponseSchema = z.object({
  ok: z.literal(true),
  type: z.literal('auth/token'),
  token: z.string(),
});

const authInvalidateTokenResultSchema = z.object({
  ok: z.literal(true),
  type: z.literal('auth/invalidate-token-result'),
});

const authClearResultSchema = z.object({
  ok: z.literal(true),
  type: z.literal('auth/clear-result'),
});

const authProfileSchema = z.object({
  ok: z.literal(true),
  type: z.literal('auth/profile'),
  profile: z
    .object({
      email: z.string(),
      id: z.string(),
    })
    .nullable(),
});

const pageContextSchema = z.object({
  ok: z.literal(true),
  type: z.literal('page/context'),
  context: z
    .object({
      url: z.string(),
      title: z.string(),
      selection: z.string().nullable(),
      textPreview: z.string(),
      tokenEstimate: z.number(),
    })
    .nullable(),
});

const backgroundErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export const backgroundResponseSchema = z.union([
  authTokenResponseSchema,
  authInvalidateTokenResultSchema,
  authClearResultSchema,
  authProfileSchema,
  pageContextSchema,
  backgroundErrorResponseSchema,
]);

export type BackgroundResponse = z.infer<typeof backgroundResponseSchema>;
export type BackgroundSuccessResponse = Exclude<BackgroundResponse, { ok: false }>;
export type BackgroundResponseType = BackgroundSuccessResponse['type'];

export type TypedBackgroundResponse<T extends BackgroundResponseType> = Extract<
  BackgroundSuccessResponse,
  { type: T }
>;

export const pageContextResponseToActiveContext = (
  response: TypedBackgroundResponse<'page/context'>,
): ActivePageContext | null => {
  if (!response.context) return null;
  return {
    url: response.context.url,
    title: response.context.title,
    selection: response.context.selection,
    textPreview: response.context.textPreview,
    tokenEstimate: response.context.tokenEstimate,
  };
};

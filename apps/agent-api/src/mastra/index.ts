import { chatRoute } from '@mastra/ai-sdk';
import { Mastra } from '@mastra/core/mastra';
import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import { registerApiRoute } from '@mastra/core/server';
import { PinoLogger } from '@mastra/loggers';
import { z } from 'zod';
import { heliosAgent } from './agents/weather-agent';

const UserInfoSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  hd: z.string().optional(),
});

const verifyGoogleAccessToken = async (token: string) => {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Google userinfo rejected token with ${response.status}`);
  }

  const json = await response.json();
  return UserInfoSchema.parse(json);
};

const authMiddleware = async (
  c: {
    req: { header: (name: string) => string | undefined };
    get: (name: string) => {
      set: (key: string, value: unknown) => void;
    };
    json: (body: unknown, status?: number) => Response;
  },
  next: () => Promise<void>,
) => {
  const authHeader = c.req.header('Authorization') ?? c.req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(
      {
        error: 'missing_bearer_token',
      },
      401,
    );
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return c.json(
      {
        error: 'missing_bearer_token',
      },
      401,
    );
  }

  try {
    const principal = await verifyGoogleAccessToken(token);
    const requestContext = c.get('requestContext');
    requestContext.set(MASTRA_RESOURCE_ID_KEY, principal.sub);
    requestContext.set('googleSub', principal.sub);
    requestContext.set('email', principal.email);
    if (principal.hd) {
      requestContext.set('hd', principal.hd);
    }
    await next();
  } catch (_error) {
    return c.json(
      {
        error: 'invalid_token',
      },
      401,
    );
  }
};

export const mastra = new Mastra({
  agents: { heliosAgent },
  logger: new PinoLogger({
    name: 'helios-agent-api',
    level: 'info',
  }),
  server: {
    apiRoutes: [
      registerApiRoute('/v1/healthz', {
        method: 'GET',
        handler: async (c) =>
          c.json({
            status: 'ok',
          }),
        requiresAuth: false,
      }),
      registerApiRoute('/v1/readyz', {
        method: 'GET',
        handler: async (c) =>
          c.json({
            status: 'ready',
          }),
        requiresAuth: false,
      }),
      chatRoute({
        path: '/v1/chat/stream',
        agent: 'helios-agent',
        version: 'v6',
        sendReasoning: true,
      }),
      registerApiRoute('/v1/tools/execute', {
        method: 'POST',
        handler: async (c) =>
          c.json({
            ok: false,
            message:
              'No explicit side-action tools are enabled in v1. Use /v1/chat/stream.',
          }),
      }),
    ],
    middleware: [
      {
        path: '/v1/chat/stream',
        handler: authMiddleware,
      },
      {
        path: '/v1/tools/execute',
        handler: authMiddleware,
      },
    ],
  },
});

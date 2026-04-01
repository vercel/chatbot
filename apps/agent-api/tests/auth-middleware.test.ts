import { describe, expect, it, vi } from 'vitest';
import { authMiddleware } from '../src/mastra/index';

type MockContext = {
  req: { header: (name: string) => string | undefined };
  get: (name: string) => { set: (key: string, value: unknown) => void };
  json: (body: unknown, status?: number) => { body: unknown; status: number };
};

const createContext = (authorization?: string) => {
  const requestContextSet = vi.fn();

  const ctx: MockContext = {
    req: {
      header: (name: string) =>
        name.toLowerCase() === 'authorization' ? authorization : undefined,
    },
    get: () => ({
      set: requestContextSet,
    }),
    json: (body: unknown, status = 200) => ({ body, status }),
  };

  return { ctx, requestContextSet };
};

describe('authMiddleware', () => {
  it('returns 401 when bearer token is missing', async () => {
    const { ctx, requestContextSet } = createContext();
    const next = vi.fn();

    const response = await authMiddleware(
      ctx as Parameters<typeof authMiddleware>[0],
      next,
    );

    expect(response).toEqual({
      body: { error: 'missing_bearer_token' },
      status: 401,
    });
    expect(next).not.toHaveBeenCalled();
    expect(requestContextSet).not.toHaveBeenCalled();
  });

  it('returns 401 when token validation fails', async () => {
    const { ctx, requestContextSet } = createContext('Bearer bad-token');
    const next = vi.fn();

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: false, status: 401 } as Response);

    const response = await authMiddleware(
      ctx as Parameters<typeof authMiddleware>[0],
      next,
    );

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(response).toEqual({
      body: { error: 'invalid_token' },
      status: 401,
    });
    expect(next).not.toHaveBeenCalled();
    expect(requestContextSet).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});

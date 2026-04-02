import { beforeEach, describe, expect, it, vi } from 'vitest';

type IdentityMock = {
  getAuthToken: (...args: any[]) => Promise<{ token: string }>;
  removeCachedAuthToken: (...args: any[]) => Promise<void>;
  clearAllCachedAuthTokens: (...args: any[]) => Promise<void>;
  getProfileUserInfo: (...args: any[]) => Promise<{ email?: string; id?: string }>;
};

const createChromeMock = (identity: IdentityMock) => ({
  identity,
});

describe('chrome identity auth helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('requests non-interactive token by default', async () => {
    const identity: IdentityMock = {
      getAuthToken: vi.fn(async () => ({ token: 'silent-token' })),
      removeCachedAuthToken: vi.fn(async () => undefined),
      clearAllCachedAuthTokens: vi.fn(async () => undefined),
      getProfileUserInfo: vi.fn(async () => ({ email: '', id: '' })),
    };

    vi.stubGlobal('chrome', createChromeMock(identity));

    const { getAuthTokenSilent } = await import('../lib/auth/chrome-identity');
    const token = await getAuthTokenSilent();

    expect(token).toBe('silent-token');
    expect(vi.mocked(identity.getAuthToken)).toHaveBeenCalledWith({
      interactive: false,
      scopes: ['openid', 'email', 'profile'],
    });
  });

  it('retries once with a fresh token on 401', async () => {
    const identity: IdentityMock = {
      getAuthToken: vi
        .fn()
        .mockResolvedValueOnce({ token: 'stale-token' })
        .mockResolvedValueOnce({ token: 'fresh-token' }),
      removeCachedAuthToken: vi.fn(async () => undefined),
      clearAllCachedAuthTokens: vi.fn(async () => undefined),
      getProfileUserInfo: vi.fn(async () => ({ email: '', id: '' })),
    };

    vi.stubGlobal('chrome', createChromeMock(identity));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { fetchWithGoogleAuth } = await import('../lib/auth/chrome-identity');
    const response = await fetchWithGoogleAuth('https://api.test.dev/v1/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ hello: 'world' }),
    });

    expect(response.status).toBe(200);
    expect(vi.mocked(identity.removeCachedAuthToken)).toHaveBeenCalledWith({
      token: 'stale-token',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    const secondHeaders = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);

    expect(firstHeaders.get('Authorization')).toBe('Bearer stale-token');
    expect(secondHeaders.get('Authorization')).toBe('Bearer fresh-token');
  });
});

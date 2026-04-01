import { describe, expect, it, vi } from 'vitest';
import { verifyGoogleAccessToken } from '../src/mastra/index';

describe('verifyGoogleAccessToken', () => {
  it('returns parsed principal for a valid userinfo response', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        sub: 'sub-42',
        email: 'valid@example.com',
        hd: 'example.com',
      }),
    } as Response);

    const principal = await verifyGoogleAccessToken('token-abc');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://openidconnect.googleapis.com/v1/userinfo',
      {
        headers: { Authorization: 'Bearer token-abc' },
      },
    );
    expect(principal).toEqual({
      sub: 'sub-42',
      email: 'valid@example.com',
      hd: 'example.com',
    });

    fetchSpy.mockRestore();
  });

  it('throws when google userinfo rejects token', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: false, status: 401 } as Response);

    await expect(verifyGoogleAccessToken('invalid-token')).rejects.toThrow(
      'Google userinfo rejected token with 401',
    );

    fetchSpy.mockRestore();
  });

  it('throws when google payload fails schema validation', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        sub: 'sub-42',
      }),
    } as Response);

    await expect(verifyGoogleAccessToken('token-missing-email')).rejects.toThrow();

    fetchSpy.mockRestore();
  });
});

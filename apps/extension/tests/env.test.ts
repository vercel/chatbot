import { describe, expect, it } from 'vitest';

describe('extension env module', () => {
  it('loads module and exposes defaults in test env', async () => {
    const mod = await import('../lib/config/env');
    expect(mod.extensionEnv).toBeDefined();
    expect(typeof mod.extensionEnv.apiBaseUrl).toBe('string');
    expect(typeof mod.extensionEnv.googleClientId).toBe('string');
  });
});

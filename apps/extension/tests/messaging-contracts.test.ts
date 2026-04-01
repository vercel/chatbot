import { describe, expect, it } from 'vitest';
import {
  backgroundRequestSchema,
  backgroundResponseSchema,
  pageContextResponseToActiveContext,
} from '../lib/messaging/contracts';

describe('background messaging contracts', () => {
  it('parses supported request messages', () => {
    expect(
      backgroundRequestSchema.parse({
        type: 'auth/get-token',
        interactive: true,
      }),
    ).toEqual({ type: 'auth/get-token', interactive: true });

    expect(
      backgroundRequestSchema.parse({
        type: 'page/get-active-context',
      }),
    ).toEqual({ type: 'page/get-active-context' });
  });

  it('parses and maps page context responses', () => {
    const parsed = backgroundResponseSchema.parse({
      ok: true,
      type: 'page/context',
      context: {
        url: 'https://example.com',
        title: 'Example',
        selection: 'hello',
        textPreview: 'hello world',
        tokenEstimate: 3,
      },
    });

    if (!parsed.ok || parsed.type !== 'page/context') {
      throw new Error('Expected page/context response');
    }

    expect(pageContextResponseToActiveContext(parsed)).toEqual({
      url: 'https://example.com',
      title: 'Example',
      selection: 'hello',
      textPreview: 'hello world',
      tokenEstimate: 3,
    });
  });

  it('rejects invalid response payloads', () => {
    expect(() =>
      backgroundResponseSchema.parse({
        ok: true,
        type: 'auth/token',
      }),
    ).toThrow();
  });
});

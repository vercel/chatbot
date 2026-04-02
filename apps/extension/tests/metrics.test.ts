import { describe, expect, it } from 'vitest';
import { extractUsageFromMetadata } from '../lib/runtime/metrics';

describe('extractUsageFromMetadata', () => {
  it('returns null for missing usage object', () => {
    expect(extractUsageFromMetadata(undefined)).toBeNull();
    expect(extractUsageFromMetadata({})).toBeNull();
  });

  it('parses numeric usage values', () => {
    const usage = extractUsageFromMetadata({
      usage: {
        inputTokens: 12,
        outputTokens: '34',
        totalTokens: 46,
        tokensPerSecond: '1.5',
        ttftMs: 210,
      },
    });

    expect(usage).toEqual({
      inputTokens: 12,
      outputTokens: 34,
      totalTokens: 46,
      tokensPerSecond: 1.5,
      ttftMs: 210,
    });
  });
});

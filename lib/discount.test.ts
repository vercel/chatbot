import { describe, expect, it } from 'vitest';
import { applyDiscount } from './discount';

describe('applyDiscount', () => {
  it('applies a 20% discount', () => {
    expect(applyDiscount(100, 20)).toBe(80);
  });

  it('applies a 0% discount (no change)', () => {
    expect(applyDiscount(50, 0)).toBe(50);
  });

  it('applies a 100% discount (free)', () => {
    expect(applyDiscount(42, 100)).toBe(0);
  });
});

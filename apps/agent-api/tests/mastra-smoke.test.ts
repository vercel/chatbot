import { describe, expect, it } from 'vitest';
import { mastra } from '../src/mastra';

describe('mastra bootstrap', () => {
  it('exports a mastra instance', () => {
    expect(mastra).toBeTruthy();
  });
});

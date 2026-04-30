import { describe, expect, test } from 'vitest';
import {
  adaptGapSections,
  adaptReviewSections,
} from '@/lib/types/form-cards';

describe('adaptGapSections', () => {
  test('returns empty array when input is undefined', () => {
    expect(adaptGapSections(undefined)).toEqual([]);
  });

  test('returns empty array when no fields are provided', () => {
    expect(adaptGapSections({})).toEqual([]);
    expect(adaptGapSections({ missingFields: [] })).toEqual([]);
  });

  test('chunks a flat missingFields list into pages of 5 in order', () => {
    const fields = Array.from({ length: 14 }, (_, i) => ({ field: `f${i + 1}` }));
    const pages = adaptGapSections({ missingFields: fields });
    expect(pages).toHaveLength(3);
    expect(pages[0]).toEqual({
      id: 'page-0',
      title: '',
      fields: fields.slice(0, 5),
    });
    expect(pages[1]).toEqual({
      id: 'page-1',
      title: '',
      fields: fields.slice(5, 10),
    });
    expect(pages[2]).toEqual({
      id: 'page-2',
      title: '',
      fields: fields.slice(10, 14),
    });
  });

  test('flattens legacy sections shape preserving order, then chunks by 5', () => {
    const pages = adaptGapSections({
      sections: [
        { id: 's1', title: 'Identity', fields: [{ field: 'a' }, { field: 'b' }, { field: 'c' }] },
        { id: 's2', title: 'Income', fields: [{ field: 'd' }, { field: 'e' }, { field: 'f' }, { field: 'g' }] },
      ],
    });
    expect(pages).toHaveLength(2);
    expect(pages[0].fields.map((f) => f.field)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(pages[1].fields.map((f) => f.field)).toEqual(['f', 'g']);
    // Original section titles are discarded; pages have empty titles.
    expect(pages.every((p) => p.title === '')).toBe(true);
  });
});

describe('adaptReviewSections', () => {
  test('returns empty array when input is undefined', () => {
    expect(adaptReviewSections(undefined)).toEqual([]);
  });

  test('chunks a flat fields list into pages of 5 in order', () => {
    const fields = Array.from({ length: 12 }, (_, i) => ({
      field: `r${i + 1}`,
      source: 'database' as const,
    }));
    const pages = adaptReviewSections({ fields });
    expect(pages).toHaveLength(3);
    expect(pages.map((p) => p.fields.length)).toEqual([5, 5, 2]);
    expect(pages[0].id).toBe('page-0');
    expect(pages[2].id).toBe('page-2');
  });

  test('flattens legacy sections shape preserving order, then chunks by 5', () => {
    const pages = adaptReviewSections({
      sections: [
        {
          id: 's1',
          title: 'Identity',
          fields: [
            { field: 'a', source: 'database' as const },
            { field: 'b', source: 'database' as const },
            { field: 'c', source: 'database' as const },
          ],
        },
        {
          id: 's2',
          title: 'Income',
          fields: [
            { field: 'd', source: 'database' as const },
            { field: 'e', source: 'database' as const },
            { field: 'f', source: 'database' as const },
          ],
        },
      ],
    });
    expect(pages).toHaveLength(2);
    expect(pages[0].fields.map((f) => f.field)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(pages[1].fields.map((f) => f.field)).toEqual(['f']);
  });
});

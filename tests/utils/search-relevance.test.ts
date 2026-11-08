import { SearchResult } from '@/types/api';
import { compareByRelevance, withoutQualityPattern } from '@/utils/search-relevance';

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    fileName: 'Some.Title.2024.1080p',
    fileSize: 1000,
    fileUrl: 'magnet:?xt=urn:btih:abc',
    nbLeechers: 1,
    nbSeeders: 10,
    siteUrl: 'https://example-tracker.com',
    descrLink: '',
    ...overrides,
  };
}

function sortNames(names: string[], query: string): string[] {
  return names
    .map((fileName) => makeResult({ fileName }))
    .sort((a, b) => compareByRelevance(a, b, query))
    .map((r) => r.fileName);
}

describe('compareByRelevance', () => {
  it('ranks an exact title match above an unrelated result', () => {
    expect(sortNames(['Other.Thing.2020', 'Breaking.Bad.S01'], 'breaking bad')).toEqual([
      'Breaking.Bad.S01',
      'Other.Thing.2020',
    ]);
  });

  it('tolerates a typo and an adjacent letter swap', () => {
    expect(sortNames(['Unrelated.Movie', 'Breaking.Bad.S01'], 'braeking bda')[0]).toBe(
      'Breaking.Bad.S01',
    );
  });

  it('weights title words above quality words', () => {
    expect(sortNames(['Other.Show.2160p', 'The.Expanse.720p'], 'expanse 2160p')[0]).toBe(
      'The.Expanse.720p',
    );
  });

  it('prefers the requested quality among equal titles', () => {
    expect(sortNames(['The.Expanse.720p', 'The.Expanse.2160p'], 'expanse 2160p')[0]).toBe(
      'The.Expanse.2160p',
    );
  });

  it('ignores accents and case', () => {
    expect(sortNames(['Zzz', 'POKÉMON.Movie'], 'pokemon')[0]).toBe('POKÉMON.Movie');
  });

  it('breaks ties by seeders descending, treating -1 as 0', () => {
    const a = makeResult({ fileName: 'Same.Title', nbSeeders: -1, fileUrl: 'a' });
    const b = makeResult({ fileName: 'Same.Title', nbSeeders: 5, fileUrl: 'b' });
    const c = makeResult({ fileName: 'Same.Title', nbSeeders: 0, fileUrl: 'c' });
    expect([a, c, b].sort((x, y) => compareByRelevance(x, y, 'same title'))[0].fileUrl).toBe('b');
    expect(compareByRelevance(a, c, 'same title')).toBe(0);
  });

  it('handles a missing fileName', () => {
    const missing = makeResult({ fileName: undefined as unknown as string });
    const named = makeResult({ fileName: 'Title' });
    expect(compareByRelevance(missing, named, 'title')).toBeGreaterThan(0);
  });
});

describe('withoutQualityPattern', () => {
  it.each([
    ['expanse 2160p', 'expanse'],
    ['Show S01 1080p HDR10', 'show s01'],
    ['movie 4K', 'movie'],
  ])('strips quality terms from %p', (query, expected) => {
    expect(withoutQualityPattern(query)).toBe(expected);
  });

  it('returns null when there is no quality term to drop', () => {
    expect(withoutQualityPattern('breaking bad')).toBeNull();
  });

  it('returns null when the query is only quality terms', () => {
    expect(withoutQualityPattern('1080p')).toBeNull();
  });
});

import {
  EMPTY_SEARCH_FILTER_DRAFT,
  getDefaultSearchFilterDraft,
  draftToFilterOptions,
  filterSearchResults,
  hasActiveFilters,
  isDraftDirty,
  matchesAllTerms,
  parseSeedersInput,
  parseSizeInput,
  tokenizeTerms,
} from '@/utils/search-filters';
import { SearchResult } from '@/types/api';

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

describe('filterSearchResults', () => {
  describe('hideZeroSeeders', () => {
    it('hides results with exactly 0 seeders', () => {
      const dead = makeResult({ fileUrl: 'dead', nbSeeders: 0 });
      const alive = makeResult({ fileUrl: 'alive', nbSeeders: 5 });
      expect(filterSearchResults([dead, alive], { hideZeroSeeders: true })).toEqual([alive]);
    });

    it('keeps results with positive seeders', () => {
      const results = [
        makeResult({ fileUrl: 'a', nbSeeders: 1 }),
        makeResult({ fileUrl: 'b', nbSeeders: 9999 }),
      ];
      expect(filterSearchResults(results, { hideZeroSeeders: true })).toEqual(results);
    });

    it('keeps -1 (qBittorrent "unknown seeders" sentinel)', () => {
      const unknown = makeResult({ nbSeeders: -1 });
      expect(filterSearchResults([unknown], { hideZeroSeeders: true })).toEqual([unknown]);
    });

    it('keeps results whose seeders are undefined or null', () => {
      const missing = makeResult({ fileUrl: 'u' });
      delete (missing as Partial<SearchResult>).nbSeeders;
      const nulled = makeResult({ fileUrl: 'n', nbSeeders: null as unknown as number });
      expect(filterSearchResults([missing, nulled], { hideZeroSeeders: true })).toEqual([
        missing,
        nulled,
      ]);
    });

    it('returns an empty array when every result has 0 seeders', () => {
      const results = [
        makeResult({ fileUrl: 'a', nbSeeders: 0 }),
        makeResult({ fileUrl: 'b', nbSeeders: 0 }),
      ];
      expect(filterSearchResults(results, { hideZeroSeeders: true })).toEqual([]);
    });

    it('preserves the original order of surviving results', () => {
      const a = makeResult({ fileUrl: 'a', nbSeeders: 3 });
      const b = makeResult({ fileUrl: 'b', nbSeeders: 0 });
      const c = makeResult({ fileUrl: 'c', nbSeeders: 7 });
      expect(filterSearchResults([a, b, c], { hideZeroSeeders: true })).toEqual([a, c]);
    });

    it('does not mutate the input array', () => {
      const results = [makeResult({ fileUrl: 'a', nbSeeders: 0 }), makeResult({ fileUrl: 'b' })];
      const snapshot = [...results];
      filterSearchResults(results, { hideZeroSeeders: true });
      expect(results).toEqual(snapshot);
      expect(results).toHaveLength(2);
    });
  });

  describe('flag off', () => {
    const results = [
      makeResult({ fileUrl: 'a', nbSeeders: 0 }),
      makeResult({ fileUrl: 'b', nbSeeders: -1 }),
      makeResult({ fileUrl: 'c', nbSeeders: 4 }),
    ];

    it('returns everything when hideZeroSeeders is false', () => {
      expect(filterSearchResults(results, { hideZeroSeeders: false })).toEqual(results);
    });

    it('returns everything when hideZeroSeeders is omitted', () => {
      expect(filterSearchResults(results, {})).toEqual(results);
    });

    it('returns everything when no options are passed', () => {
      expect(filterSearchResults(results)).toEqual(results);
    });
  });

  describe('nameTerms ("names only")', () => {
    const matrix = makeResult({ fileUrl: 'm', fileName: 'The.Matrix.1999.1080p.BluRay' });
    const reloaded = makeResult({ fileUrl: 'r', fileName: 'The Matrix Reloaded 2003' });
    const other = makeResult({ fileUrl: 'o', fileName: 'Unrelated Documentary' });
    const all = [matrix, reloaded, other];

    it('keeps results whose name contains every term', () => {
      expect(filterSearchResults(all, { nameTerms: 'matrix reloaded' })).toEqual([reloaded]);
    });

    it('is case-insensitive in both the pattern and the name', () => {
      expect(filterSearchResults(all, { nameTerms: 'MATRIX bluray' })).toEqual([matrix]);
    });

    it('matches substrings, not whole words', () => {
      expect(filterSearchResults(all, { nameTerms: 'matri' })).toEqual([matrix, reloaded]);
    });

    it('ignores extra and leading/trailing whitespace between terms', () => {
      expect(filterSearchResults(all, { nameTerms: '  matrix    reloaded \t' })).toEqual([
        reloaded,
      ]);
    });

    it('drops everything when no result contains all terms', () => {
      expect(filterSearchResults(all, { nameTerms: 'matrix cats' })).toEqual([]);
    });

    it('applies the WebUI "+term" (required) and "-term" (excluded) prefixes', () => {
      expect(filterSearchResults(all, { nameTerms: 'matrix -reloaded' })).toEqual([matrix]);
      expect(filterSearchResults(all, { nameTerms: '+matrix +2003' })).toEqual([reloaded]);
    });

    it('ignores lone "+" and "-" tokens', () => {
      expect(filterSearchResults(all, { nameTerms: 'matrix - +' })).toEqual([matrix, reloaded]);
    });

    it('does not support quoted phrases (parity with the WebUI)', () => {
      // The quotes are part of the terms, so a quoted phrase never matches a
      // name that merely contains the words.
      expect(filterSearchResults(all, { nameTerms: '"the matrix"' })).toEqual([]);
    });

    it('matches non-ASCII names case-insensitively without folding accents', () => {
      const cafe = makeResult({ fileUrl: 'c', fileName: 'CAFÉ Société 2020' });
      const cyrillic = makeResult({ fileUrl: 'k', fileName: 'Фильм Москва 2021' });
      expect(filterSearchResults([cafe, cyrillic], { nameTerms: 'café' })).toEqual([cafe]);
      expect(filterSearchResults([cafe, cyrillic], { nameTerms: 'cafe' })).toEqual([]);
      expect(filterSearchResults([cafe, cyrillic], { nameTerms: 'МОСКВА фильм' })).toEqual([
        cyrillic,
      ]);
    });

    it('is inactive for an undefined, empty, or whitespace-only pattern', () => {
      expect(filterSearchResults(all, { nameTerms: undefined })).toBe(all);
      expect(filterSearchResults(all, { nameTerms: '' })).toBe(all);
      expect(filterSearchResults(all, { nameTerms: '   ' })).toBe(all);
    });

    it('treats a missing fileName as an empty name', () => {
      const nameless = makeResult({ fileUrl: 'n', fileName: undefined as unknown as string });
      expect(filterSearchResults([nameless], { nameTerms: 'matrix' })).toEqual([]);
      expect(filterSearchResults([nameless], { nameTerms: '-matrix' })).toEqual([nameless]);
    });
  });

  describe('filterText', () => {
    const a = makeResult({ fileUrl: 'a', fileName: 'Ubuntu 24.04 Desktop amd64' });
    const b = makeResult({ fileUrl: 'b', fileName: 'Ubuntu 24.04 Server arm64' });
    const c = makeResult({ fileUrl: 'c', fileName: 'Debian 12 Desktop amd64' });

    it('requires every term to appear in the name', () => {
      expect(filterSearchResults([a, b, c], { filterText: 'desktop amd64' })).toEqual([a, c]);
      expect(filterSearchResults([a, b, c], { filterText: 'ubuntu desktop' })).toEqual([a]);
    });

    it('is case-insensitive and supports "-term" exclusion', () => {
      expect(filterSearchResults([a, b, c], { filterText: 'UBUNTU -server' })).toEqual([a]);
    });

    it('is inactive when blank', () => {
      const results = [a, b, c];
      expect(filterSearchResults(results, { filterText: '' })).toBe(results);
      expect(filterSearchResults(results, { filterText: '  ' })).toBe(results);
    });
  });

  describe('seeders range', () => {
    const results = [
      makeResult({ fileUrl: 'zero', nbSeeders: 0 }),
      makeResult({ fileUrl: 'five', nbSeeders: 5 }),
      makeResult({ fileUrl: 'fifty', nbSeeders: 50 }),
      makeResult({ fileUrl: 'unknown', nbSeeders: -1 }),
    ];
    const urls = (list: SearchResult[]) => list.map((r) => r.fileUrl);

    it('applies an inclusive minimum', () => {
      expect(urls(filterSearchResults(results, { minSeeders: 5 }))).toEqual([
        'five',
        'fifty',
        'unknown',
      ]);
    });

    it('applies an inclusive maximum', () => {
      expect(urls(filterSearchResults(results, { maxSeeders: 5 }))).toEqual([
        'zero',
        'five',
        'unknown',
      ]);
    });

    it('applies min and max together', () => {
      expect(urls(filterSearchResults(results, { minSeeders: 1, maxSeeders: 10 }))).toEqual([
        'five',
        'unknown',
      ]);
    });

    it('never excludes unknown (-1, null, undefined) seeders by a range', () => {
      const missing = makeResult({ fileUrl: 'missing' });
      delete (missing as Partial<SearchResult>).nbSeeders;
      const nulled = makeResult({ fileUrl: 'nulled', nbSeeders: null as unknown as number });
      const unknowns = [results[3], missing, nulled];
      expect(filterSearchResults(unknowns, { minSeeders: 100 })).toEqual(unknowns);
      expect(filterSearchResults(unknowns, { maxSeeders: 1 })).toEqual(unknowns);
    });

    it('treats 0, negative, NaN and undefined bounds as "no bound"', () => {
      expect(filterSearchResults(results, { minSeeders: 0, maxSeeders: 0 })).toBe(results);
      expect(filterSearchResults(results, { minSeeders: -3 })).toBe(results);
      expect(filterSearchResults(results, { minSeeders: NaN })).toBe(results);
      expect(filterSearchResults(results, { minSeeders: undefined })).toBe(results);
    });

    it('swaps a min greater than max, like the WebUI', () => {
      expect(urls(filterSearchResults(results, { minSeeders: 10, maxSeeders: 1 }))).toEqual([
        'five',
        'unknown',
      ]);
    });
  });

  describe('size range', () => {
    const MiB = 1024 * 1024;
    const GiB = 1024 * MiB;
    const results = [
      makeResult({ fileUrl: 'small', fileSize: 100 * MiB }),
      makeResult({ fileUrl: 'medium', fileSize: 700 * MiB }),
      makeResult({ fileUrl: 'large', fileSize: 4 * GiB }),
      makeResult({ fileUrl: 'unknown', fileSize: -1 }),
      makeResult({ fileUrl: 'zero', fileSize: 0 }),
    ];
    const urls = (list: SearchResult[]) => list.map((r) => r.fileUrl);

    it('applies an inclusive minimum in bytes', () => {
      expect(urls(filterSearchResults(results, { minSize: 700 * MiB }))).toEqual([
        'medium',
        'large',
        'unknown',
        'zero',
      ]);
    });

    it('applies an inclusive maximum in bytes', () => {
      expect(urls(filterSearchResults(results, { maxSize: 700 * MiB }))).toEqual([
        'small',
        'medium',
        'unknown',
        'zero',
      ]);
    });

    it('applies min and max together', () => {
      expect(urls(filterSearchResults(results, { minSize: 200 * MiB, maxSize: GiB }))).toEqual([
        'medium',
        'unknown',
        'zero',
      ]);
    });

    it('never excludes unknown (-1 / 0) sizes by a range', () => {
      const unknowns = [results[3], results[4]];
      expect(filterSearchResults(unknowns, { minSize: 10 * GiB })).toEqual(unknowns);
      expect(filterSearchResults(unknowns, { maxSize: 1 })).toEqual(unknowns);
    });

    it('swaps a min greater than max', () => {
      expect(urls(filterSearchResults(results, { minSize: GiB, maxSize: 200 * MiB }))).toEqual([
        'medium',
        'unknown',
        'zero',
      ]);
    });

    it('works end to end with parseSizeInput units', () => {
      const opts = {
        minSize: parseSizeInput('500', 'MiB'),
        maxSize: parseSizeInput('1.5', 'GiB'),
      };
      expect(urls(filterSearchResults(results, opts))).toEqual(['medium', 'unknown', 'zero']);
    });
  });

  describe('combined filters', () => {
    const base = { fileSize: 2000, nbSeeders: 20 };
    const a = makeResult({ ...base, fileUrl: 'a', fileName: 'Linux ISO Alpha' });
    const b = makeResult({ ...base, fileUrl: 'b', fileName: 'Linux ISO Beta', nbSeeders: 0 });
    const c = makeResult({ ...base, fileUrl: 'c', fileName: 'Linux ISO Gamma', fileSize: 9000 });
    const d = makeResult({ ...base, fileUrl: 'd', fileName: 'Windows Alpha' });

    it('ANDs every active filter', () => {
      expect(
        filterSearchResults([a, b, c, d], {
          nameTerms: 'linux iso',
          filterText: 'alpha',
          minSeeders: 5,
          maxSize: 5000,
        }),
      ).toEqual([a]);
    });

    it('still honors hideZeroSeeders alongside the others', () => {
      expect(
        filterSearchResults([a, b, c, d], { hideZeroSeeders: true, nameTerms: 'linux' }),
      ).toEqual([a, c]);
      expect(filterSearchResults([a, b, c, d], { nameTerms: 'linux', maxSeeders: 5 })).toEqual([b]);
    });

    it('returns the same array when no filter is active', () => {
      const results = [a, b, c, d];
      expect(
        filterSearchResults(results, {
          hideZeroSeeders: false,
          nameTerms: '',
          filterText: '',
          minSeeders: 0,
          maxSize: undefined,
        }),
      ).toBe(results);
    });
  });

  describe('tokenizeTerms', () => {
    it('lowercases and splits on any whitespace run', () => {
      expect(tokenizeTerms('  Foo\tBAR   baz\n')).toEqual(['foo', 'bar', 'baz']);
    });

    it('drops empty input and lone +/- tokens but keeps prefixed terms', () => {
      expect(tokenizeTerms('')).toEqual([]);
      expect(tokenizeTerms(undefined)).toEqual([]);
      expect(tokenizeTerms(null)).toEqual([]);
      expect(tokenizeTerms('- + -x +y')).toEqual(['-x', '+y']);
    });
  });

  describe('matchesAllTerms', () => {
    it('vacuously matches an empty term list', () => {
      expect(matchesAllTerms('anything', [])).toBe(true);
    });
  });

  describe('parseSizeInput', () => {
    it('converts using 1024-based units', () => {
      expect(parseSizeInput('1', 'B')).toBe(1);
      expect(parseSizeInput('1', 'KiB')).toBe(1024);
      expect(parseSizeInput('2', 'MiB')).toBe(2 * 1024 ** 2);
      expect(parseSizeInput('1.5', 'GiB')).toBe(1.5 * 1024 ** 3);
      expect(parseSizeInput('3', 'TiB')).toBe(3 * 1024 ** 4);
    });

    it('accepts a decimal comma and surrounding whitespace', () => {
      expect(parseSizeInput(' 1,5 ', 'MiB')).toBe(1.5 * 1024 ** 2);
    });

    it('returns undefined for blank, non-numeric, zero, or negative input', () => {
      expect(parseSizeInput('', 'MiB')).toBeUndefined();
      expect(parseSizeInput('   ', 'MiB')).toBeUndefined();
      expect(parseSizeInput('abc', 'MiB')).toBeUndefined();
      expect(parseSizeInput('1.2.3', 'MiB')).toBeUndefined();
      expect(parseSizeInput('0', 'MiB')).toBeUndefined();
      expect(parseSizeInput('-5', 'MiB')).toBeUndefined();
      expect(parseSizeInput(undefined, 'MiB')).toBeUndefined();
      expect(parseSizeInput(null, 'MiB')).toBeUndefined();
    });

    it('rounds to whole bytes and drops sub-byte amounts', () => {
      expect(parseSizeInput('0.3', 'B')).toBeUndefined();
      expect(parseSizeInput('1.5', 'B')).toBe(2);
    });
  });

  describe('parseSeedersInput', () => {
    it('parses positive whole numbers', () => {
      expect(parseSeedersInput('25')).toBe(25);
      expect(parseSeedersInput(' 7 ')).toBe(7);
    });

    it('floors fractions and rejects blank, zero, negative, or non-numeric input', () => {
      expect(parseSeedersInput('3.9')).toBe(3);
      expect(parseSeedersInput('0.5')).toBeUndefined();
      expect(parseSeedersInput('')).toBeUndefined();
      expect(parseSeedersInput('0')).toBeUndefined();
      expect(parseSeedersInput('-2')).toBeUndefined();
      expect(parseSeedersInput('x')).toBeUndefined();
      expect(parseSeedersInput(undefined)).toBeUndefined();
    });
  });

  describe('hasActiveFilters', () => {
    it('is false for no options and for inert values', () => {
      expect(hasActiveFilters()).toBe(false);
      expect(hasActiveFilters({})).toBe(false);
      expect(
        hasActiveFilters({
          nameTerms: '  ',
          filterText: '-',
          minSeeders: 0,
          maxSeeders: -1,
          minSize: NaN,
          maxSize: undefined,
        }),
      ).toBe(false);
    });

    it('ignores hideZeroSeeders (it has its own toggle)', () => {
      expect(hasActiveFilters({ hideZeroSeeders: true })).toBe(false);
    });

    it('is true when any single filter is set', () => {
      expect(hasActiveFilters({ nameTerms: 'foo' })).toBe(true);
      expect(hasActiveFilters({ filterText: 'foo' })).toBe(true);
      expect(hasActiveFilters({ minSeeders: 1 })).toBe(true);
      expect(hasActiveFilters({ maxSeeders: 1 })).toBe(true);
      expect(hasActiveFilters({ minSize: 1 })).toBe(true);
      expect(hasActiveFilters({ maxSize: 1 })).toBe(true);
    });
  });

  describe('codec and source filters (#304, #302)', () => {
    const named = (fileName: string) => ({ fileName, nbSeeders: 5, fileSize: 1e9 }) as never;
    const results = [
      named('Show.S01E01.1080p.WEB-DL.H.265-GRP'),
      named('Movie.2024.1080p.BluRay.x264-GRP'),
      named('Movie.2024.2160p.BluRay.REMUX.HEVC-GRP'),
      named('Show.S01E02.720p.WEBRip.x264-GRP'),
      named('Show.S01E03.1080p.WEB.AV1-GRP'),
      named('Untagged release name'),
    ];
    const names = (opts: object) =>
      filterSearchResults(results, opts).map((r) => (r as { fileName: string }).fileName);

    it('matches codec spellings (H.265 / HEVC / x265) and hides untagged names', () => {
      expect(names({ codecs: ['x265'] })).toEqual([
        'Show.S01E01.1080p.WEB-DL.H.265-GRP',
        'Movie.2024.2160p.BluRay.REMUX.HEVC-GRP',
      ]);
      expect(names({ codecs: ['av1'] })).toEqual(['Show.S01E03.1080p.WEB.AV1-GRP']);
    });

    it('tells WEB-DL (incl. bare WEB) from WEBRip, and a REMUX is also BluRay', () => {
      expect(names({ sources: ['web-dl'] })).toEqual([
        'Show.S01E01.1080p.WEB-DL.H.265-GRP',
        'Show.S01E03.1080p.WEB.AV1-GRP',
      ]);
      expect(names({ sources: ['webrip'] })).toEqual(['Show.S01E02.720p.WEBRip.x264-GRP']);
      expect(names({ sources: ['remux'] })).toEqual(['Movie.2024.2160p.BluRay.REMUX.HEVC-GRP']);
      expect(names({ sources: ['bluray'] })).toHaveLength(2);
    });

    it('combines groups with AND (1080p + x265)', () => {
      expect(names({ qualities: ['1080p'], codecs: ['x265'] })).toEqual([
        'Show.S01E01.1080p.WEB-DL.H.265-GRP',
      ]);
    });

    it('counts as an active filter and a dirty draft', () => {
      expect(hasActiveFilters({ codecs: ['av1'] })).toBe(true);
      expect(isDraftDirty({ ...EMPTY_SEARCH_FILTER_DRAFT, sources: ['remux'] })).toBe(true);
    });
  });

  describe('default minimum seeders draft (#305)', () => {
    it('pre-fills the min seeders from the setting, and stays empty at 0', () => {
      expect(getDefaultSearchFilterDraft(2).minSeeders).toBe('2');
      expect(getDefaultSearchFilterDraft(0)).toEqual(EMPTY_SEARCH_FILTER_DRAFT);
      expect(getDefaultSearchFilterDraft(undefined)).toEqual(EMPTY_SEARCH_FILTER_DRAFT);
      expect(getDefaultSearchFilterDraft(Number.NaN)).toEqual(EMPTY_SEARCH_FILTER_DRAFT);
    });
  });

  describe('filter draft helpers', () => {
    it('an empty draft yields no active filters and is not dirty', () => {
      expect(hasActiveFilters(draftToFilterOptions(EMPTY_SEARCH_FILTER_DRAFT))).toBe(false);
      expect(isDraftDirty(EMPTY_SEARCH_FILTER_DRAFT)).toBe(false);
    });

    it('defaults the units to MiB (min) and GiB (max), like the WebUI', () => {
      expect(EMPTY_SEARCH_FILTER_DRAFT.minSizeUnit).toBe('MiB');
      expect(EMPTY_SEARCH_FILTER_DRAFT.maxSizeUnit).toBe('GiB');
    });

    it("parses the typed strings using each side's unit", () => {
      const opts = draftToFilterOptions({
        filterText: 'x265',
        minSeeders: '10',
        maxSeeders: '',
        minSize: '500',
        minSizeUnit: 'MiB',
        maxSize: '2',
        maxSizeUnit: 'TiB',
        qualities: [],
        codecs: ['x265'],
        sources: [],
      });
      expect(opts).toEqual({
        filterText: 'x265',
        minSeeders: 10,
        maxSeeders: undefined,
        minSize: 500 * 1024 ** 2,
        maxSize: 2 * 1024 ** 4,
        qualities: [],
        codecs: ['x265'],
        sources: [],
      });
    });

    it('is dirty once any field has text, but not from a unit change alone', () => {
      expect(isDraftDirty({ ...EMPTY_SEARCH_FILTER_DRAFT, filterText: 'a' })).toBe(true);
      expect(isDraftDirty({ ...EMPTY_SEARCH_FILTER_DRAFT, minSeeders: '1' })).toBe(true);
      expect(isDraftDirty({ ...EMPTY_SEARCH_FILTER_DRAFT, maxSize: '1' })).toBe(true);
      expect(isDraftDirty({ ...EMPTY_SEARCH_FILTER_DRAFT, minSizeUnit: 'KiB' })).toBe(false);
    });
  });
});

describe('video quality filter (#268)', () => {
  const make = (fileName: string): SearchResult =>
    ({ fileName, fileUrl: fileName, fileSize: 1, nbSeeders: 1, nbLeechers: 0 }) as SearchResult;
  const results = [
    make('Show.S01.720p.WEB-DL'),
    make('Show.S01.1080p.BluRay.x264'),
    make('Show.S01.2160p.UHD.HDR'),
    make('Show.S01.1440p'),
    make('Show.S01.DVDRip'),
    make('Show.S01.Complete'),
  ];

  it('keeps everything when no quality is selected', () => {
    expect(filterSearchResults(results, { qualities: [] })).toBe(results);
  });

  it('keeps only the selected qualities', () => {
    const out = filterSearchResults(results, { qualities: ['1080p'] });
    expect(out.map((r) => r.fileName)).toEqual(['Show.S01.1080p.BluRay.x264']);
  });

  it('supports several qualities at once', () => {
    const out = filterSearchResults(results, { qualities: ['1080p', '2160p'] });
    expect(out.map((r) => r.fileName)).toEqual([
      'Show.S01.1080p.BluRay.x264',
      'Show.S01.2160p.UHD.HDR',
    ]);
  });

  it('hides results with no recognizable (or an unoffered) quality while one is selected', () => {
    const out = filterSearchResults(results, { qualities: ['720p', '1080p', '2160p'] });
    expect(out.map((r) => r.fileName)).not.toContain('Show.S01.1440p');
    expect(out.map((r) => r.fileName)).not.toContain('Show.S01.DVDRip');
    expect(out.map((r) => r.fileName)).not.toContain('Show.S01.Complete');
  });

  it('combines with the other filters', () => {
    const out = filterSearchResults(results, {
      qualities: ['720p', '1080p'],
      filterText: 'bluray',
    });
    expect(out.map((r) => r.fileName)).toEqual(['Show.S01.1080p.BluRay.x264']);
  });

  it('counts as an active filter and as a dirty draft', () => {
    expect(hasActiveFilters({ qualities: ['720p'] })).toBe(true);
    expect(hasActiveFilters({ qualities: [] })).toBe(false);
    expect(isDraftDirty({ ...EMPTY_SEARCH_FILTER_DRAFT, qualities: ['2160p'] })).toBe(true);
    expect(
      draftToFilterOptions({ ...EMPTY_SEARCH_FILTER_DRAFT, qualities: ['2160p'] }).qualities,
    ).toEqual(['2160p']);
  });
});

import { siteHost, extractBracketTag, resultTrackerLabel } from '@/utils/searchResult';
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

describe('siteHost', () => {
  it('strips protocol and path from a URL', () => {
    expect(siteHost('https://example.com/foo/bar')).toBe('example.com');
  });

  it('returns empty string for empty input', () => {
    expect(siteHost('')).toBe('');
  });
});

describe('extractBracketTag', () => {
  it('extracts a prefix bracket tag', () => {
    expect(extractBracketTag('[1337x] Some.Title.2024')).toBe('1337x');
  });

  it('extracts a suffix bracket tag', () => {
    expect(extractBracketTag('Some.Title.2024 [ThePirateBay]')).toBe('ThePirateBay');
  });

  it('skips a junk suffix tag and falls back to the prefix tag', () => {
    expect(extractBracketTag('[RARBG] Some.Title.2024 [1080p]')).toBe('RARBG');
  });

  it('prefers a valid suffix tag over a prefix tag (aggregator default is suffix)', () => {
    expect(extractBracketTag('[REQ] Some.Title.2024 [MyIndexer]')).toBe('MyIndexer');
  });

  it('returns null when the only bracket tags are quality/codec markers', () => {
    expect(extractBracketTag('Some.Title.2024 [1080p]')).toBeNull();
    expect(extractBracketTag('[x265] Some.Title.2024 [HEVC]')).toBeNull();
    expect(extractBracketTag('Some.Title.2024 [WEB-DL]')).toBeNull();
  });

  it('returns null when there is no bracket tag', () => {
    expect(extractBracketTag('Some.Title.2024.1080p')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(extractBracketTag('')).toBeNull();
  });
});

describe('resultTrackerLabel', () => {
  it('uses siteHost when not aggregated', () => {
    const result = makeResult({ fileName: '[1337x] Title', siteUrl: 'https://example.com' });
    expect(resultTrackerLabel(result, false)).toBe('example.com');
  });

  it('prefers the bracketed title tag when aggregated', () => {
    const result = makeResult({ fileName: '[1337x] Title', siteUrl: 'https://prowlarr.local:9696' });
    expect(resultTrackerLabel(result, true)).toBe('1337x');
  });

  it('falls back to siteHost when aggregated but no bracket tag exists', () => {
    const result = makeResult({ fileName: 'Plain Title', siteUrl: 'https://prowlarr.local:9696' });
    expect(resultTrackerLabel(result, true)).toBe('prowlarr.local:9696');
  });
});

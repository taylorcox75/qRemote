import { parseTagsCsv, torrentHasAnyTag, UNTAGGED_FILTER } from '@/utils/tags';

describe('parseTagsCsv', () => {
  it('returns [] for empty or missing csv', () => {
    expect(parseTagsCsv('')).toEqual([]);
  });

  it('splits, trims, and drops empty entries', () => {
    expect(parseTagsCsv('linux, iso ,,seedbox')).toEqual(['linux', 'iso', 'seedbox']);
  });
});

describe('torrentHasAnyTag', () => {
  it('matches everything when no filter tags are selected', () => {
    expect(torrentHasAnyTag('linux,iso', [])).toBe(true);
    expect(torrentHasAnyTag('', [])).toBe(true);
  });

  it('matches when any selected tag is present (OR semantics)', () => {
    expect(torrentHasAnyTag('linux,iso', ['iso', 'movies'])).toBe(true);
    expect(torrentHasAnyTag('linux,iso', ['movies'])).toBe(false);
  });

  it('UNTAGGED_FILTER matches only torrents without tags', () => {
    expect(torrentHasAnyTag('', [UNTAGGED_FILTER])).toBe(true);
    expect(torrentHasAnyTag('linux', [UNTAGGED_FILTER])).toBe(false);
  });

  it('UNTAGGED_FILTER combines with real tags using OR semantics', () => {
    expect(torrentHasAnyTag('', [UNTAGGED_FILTER, 'linux'])).toBe(true);
    expect(torrentHasAnyTag('linux', [UNTAGGED_FILTER, 'linux'])).toBe(true);
    expect(torrentHasAnyTag('iso', [UNTAGGED_FILTER, 'linux'])).toBe(false);
  });
});

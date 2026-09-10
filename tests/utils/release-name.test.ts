import { parseReleaseName, rowTitle, type ParsedReleaseName } from '@/utils/release-name';

describe('parseReleaseName', () => {
  it('keeps a plain title with no metadata untouched', () => {
    const p = parseReleaseName('Big Buck Bunny');
    expect(p.title).toBe('Big Buck Bunny');
    expect(p.year).toBeUndefined();
    expect(p.season).toBeUndefined();
    expect(p.episode).toBeUndefined();
    expect(p.looksLikeTV).toBe(false);
    expect(p.languages).toEqual([]);
  });

  it('parses a dotted TV release with SxxExx, quality, codec and group', () => {
    const p = parseReleaseName('Show.Name.S02E03.1080p.WEB-DL.x264-GRP');
    expect(p.title).toBe('Show Name');
    expect(p.season).toBe(2);
    expect(p.episode).toBe(3);
    expect(p.looksLikeTV).toBe(true);
    expect(p.resolution).toBe('1080p');
    expect(p.source).toBe('WEB');
    expect(p.codec).toBe('x264');
    expect(p.group).toBe('GRP');
  });

  it('parses the 1x03 season/episode form', () => {
    const p = parseReleaseName('Show.Name.1x03.HDTV-TEAM');
    expect(p.title).toBe('Show Name');
    expect(p.season).toBe(1);
    expect(p.episode).toBe(3);
    expect(p.looksLikeTV).toBe(true);
    expect(p.source).toBe('HDTV');
    expect(p.group).toBe('TEAM');
  });

  it('parses a season-only marker with no episode', () => {
    const p = parseReleaseName('Show.Name.S05.Complete.1080p');
    expect(p.title).toBe('Show Name');
    expect(p.season).toBe(5);
    expect(p.episode).toBeUndefined();
    expect(p.looksLikeTV).toBe(true);
  });

  it('parses a 3-digit episode number', () => {
    const p = parseReleaseName('LongRunning.Show.S05E123.WEB.x264-GRP');
    expect(p.title).toBe('LongRunning Show');
    expect(p.season).toBe(5);
    expect(p.episode).toBe(123);
  });

  it('extracts a year from spaced and bracketed metadata', () => {
    const p = parseReleaseName('The Matrix (1999) [1080p]');
    expect(p.title).toBe('The Matrix');
    expect(p.year).toBe(1999);
    expect(p.resolution).toBe('1080p');
    expect(p.looksLikeTV).toBe(false);
  });

  it('keeps a sensible title for a Linux ISO name with no spurious year', () => {
    const p = parseReleaseName('ubuntu-26.04-desktop-arm64.iso');
    expect(p.title.length).toBeGreaterThan(0);
    expect(p.title.toLowerCase()).toContain('ubuntu');
    expect(p.year).toBeUndefined();
  });

  it('does not choke on a second Linux ISO shape', () => {
    const p = parseReleaseName('debian-13.0-amd64-netinst.iso');
    expect(p.title.length).toBeGreaterThan(0);
    expect(p.title.toLowerCase()).toContain('debian');
    expect(p.year).toBeUndefined();
  });

  it('strips a trailing .mkv extension', () => {
    const p = parseReleaseName('Movie.Title.2020.720p.mkv');
    expect(p.title).toBe('Movie Title');
    expect(p.year).toBe(2020);
    expect(p.resolution).toBe('720p');
    expect(p.title.toLowerCase()).not.toContain('mkv');
  });

  it('handles underscore separators', () => {
    const p = parseReleaseName('Movie_Title_2015_1080p_BluRay');
    expect(p.title).toBe('Movie Title');
    expect(p.year).toBe(2015);
    expect(p.source).toBe('BluRay');
  });

  it('resolves UHD/2160p to the 4K resolution label', () => {
    const p = parseReleaseName('Planet.Earth.II.2016.2160p.UHD.BluRay.x265-TEAM');
    expect(p.title).toBe('Planet Earth II');
    expect(p.year).toBe(2016);
    expect(p.resolution).toBe('4K');
    expect(p.source).toBe('BluRay');
    expect(p.codec).toBe('x265');
    expect(p.group).toBe('TEAM');
  });

  it('picks up bracketed resolution and source tags', () => {
    const p = parseReleaseName('Sample.Video.[720p].[HDTV]');
    expect(p.title).toBe('Sample Video');
    expect(p.resolution).toBe('720p');
    expect(p.source).toBe('HDTV');
  });

  it('parses French scene language tags (MULTI, VFF) as metadata, not title', () => {
    const p = parseReleaseName('Movie.Title.MULTI.VFF.1080p.BluRay.x264-GRP');
    expect(p.title).toBe('Movie Title');
    expect(p.languages).toEqual(expect.arrayContaining(['MULTI', 'VFF']));
    expect(p.looksLikeTV).toBe(false);
  });

  it('collects multiple distinct language tags in encounter order', () => {
    const p = parseReleaseName('Anime.Title.VOSTFR.MULTI.1080p.WEB-DL');
    expect(p.title).toBe('Anime Title');
    expect(p.languages).toEqual(['VOSTFR', 'MULTI']);
  });

  it('does not duplicate a repeated language tag', () => {
    const p = parseReleaseName('Movie.Title.VFF.VFF.1080p');
    expect(p.languages).toEqual(['VFF']);
  });

  it('preserves a leading numeric title like "9 1 1 Nashville"', () => {
    const p = parseReleaseName('9.1.1.Nashville.S01E15.1080p.WEB.x264-FW');
    expect(p.title).toBe('9 1 1 Nashville');
    expect(p.season).toBe(1);
    expect(p.episode).toBe(15);
    expect(p.group).toBe('FW');
  });

  it('falls back to the first raw tokens when the whole name is junk', () => {
    const p = parseReleaseName('1080p.WEB.x264');
    expect(p.title.length).toBeGreaterThan(0);
  });

  it('never returns an empty title for a non-empty input', () => {
    const names = ['1080p.WEB.x264', 'BluRay.x264-GRP', 'S01E01', '2020'];
    for (const name of names) {
      expect(parseReleaseName(name).title.length).toBeGreaterThan(0);
    }
  });

  it('handles an empty string without throwing', () => {
    const p = parseReleaseName('');
    expect(p.title).toBe('');
    expect(p.looksLikeTV).toBe(false);
    expect(p.languages).toEqual([]);
  });

  it('is a pure function with no shared state across calls', () => {
    const a = parseReleaseName('Show.Name.S01E01.1080p');
    const b = parseReleaseName('Other.Show.S02E02.720p');
    expect(a.title).toBe('Show Name');
    expect(b.title).toBe('Other Show');
    expect(a.season).toBe(1);
    expect(b.season).toBe(2);
  });
});

describe('rowTitle', () => {
  it('formats a TV row as "Title · SxxExx"', () => {
    const p = parseReleaseName('Nashville.S01E15.1080p.WEB.x264-FW');
    expect(rowTitle(p)).toBe('Nashville · S01E15');
  });

  it('formats a season-only row as "Title · Sxx"', () => {
    const p = parseReleaseName('Show.Name.S05.Complete');
    expect(rowTitle(p)).toBe('Show Name · S05');
  });

  it('formats a movie row as "Title · Year"', () => {
    const p = parseReleaseName('The Matrix (1999) [1080p]');
    expect(rowTitle(p)).toBe('The Matrix · 1999');
  });

  it('falls back to the bare title with no year and no season', () => {
    const p = parseReleaseName('Big Buck Bunny');
    expect(rowTitle(p)).toBe('Big Buck Bunny');
  });

  it('prefers the season/episode suffix over year when both are present', () => {
    const p: ParsedReleaseName = {
      title: 'Nashville',
      year: 2012,
      season: 1,
      episode: 15,
      looksLikeTV: true,
      languages: [],
    };
    expect(rowTitle(p)).toBe('Nashville · S01E15');
  });
});

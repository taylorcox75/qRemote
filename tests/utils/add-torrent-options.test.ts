import {
  buildDownloadPathOptions,
  getDownloadPathPrefill,
  parseKibLimitInput,
  supportsAddTorrentCookie,
} from '@/utils/add-torrent-options';

describe('parseKibLimitInput', () => {
  it('converts KiB/s to bytes/s', () => {
    expect(parseKibLimitInput('100')).toBe(102400);
    expect(parseKibLimitInput(' 1.5 ')).toBe(1536);
    expect(parseKibLimitInput('1,5')).toBe(1536);
  });

  it('keeps 0 (unlimited)', () => {
    expect(parseKibLimitInput('0')).toBe(0);
  });

  it('ignores empty, non-numeric and negative input', () => {
    expect(parseKibLimitInput('')).toBeUndefined();
    expect(parseKibLimitInput('   ')).toBeUndefined();
    expect(parseKibLimitInput('abc')).toBeUndefined();
    expect(parseKibLimitInput('-5')).toBeUndefined();
  });
});

describe('supportsAddTorrentCookie', () => {
  it('is true up to qBit 5.0.x (WebAPI 2.11.2)', () => {
    expect(supportsAddTorrentCookie('2.2.0')).toBe(true);
    expect(supportsAddTorrentCookie('2.8.3')).toBe(true);
    expect(supportsAddTorrentCookie('2.11.2')).toBe(true);
  });

  it('is false from qBit 5.1 (WebAPI 2.11.4)', () => {
    expect(supportsAddTorrentCookie('2.11.4')).toBe(false);
    expect(supportsAddTorrentCookie('2.11.9')).toBe(false);
    expect(supportsAddTorrentCookie('2.13.1')).toBe(false);
    expect(supportsAddTorrentCookie('3.0')).toBe(false);
  });

  it('is true for an unknown version', () => {
    expect(supportsAddTorrentCookie(null)).toBe(true);
    expect(supportsAddTorrentCookie('garbage')).toBe(true);
  });
});

describe('buildDownloadPathOptions', () => {
  const base = { fieldVisible: true, manualTmm: true, useDownloadPath: true, downloadPath: '/tmp' };

  it('sends the path when on', () => {
    expect(buildDownloadPathOptions({ ...base, downloadPath: ' /inc ' })).toEqual({
      useDownloadPath: true,
      downloadPath: '/inc',
    });
  });

  it('sends useDownloadPath=false when off', () => {
    expect(buildDownloadPathOptions({ ...base, useDownloadPath: false })).toEqual({
      useDownloadPath: false,
    });
  });

  it('sends nothing when on with an empty path', () => {
    expect(buildDownloadPathOptions({ ...base, downloadPath: '  ' })).toEqual({});
  });

  it('sends nothing in automatic TMM or when the field is hidden', () => {
    expect(buildDownloadPathOptions({ ...base, manualTmm: false })).toEqual({});
    expect(buildDownloadPathOptions({ ...base, fieldVisible: false })).toEqual({});
    expect(
      buildDownloadPathOptions({ ...base, fieldVisible: false, useDownloadPath: false }),
    ).toEqual({});
  });
});

describe('getDownloadPathPrefill', () => {
  it("prefers the user's last choice for this server", () => {
    expect(
      getDownloadPathPrefill(
        { useDownloadPath: false, downloadPath: '/mine' },
        { temp_path_enabled: true, temp_path: '/srv' },
      ),
    ).toEqual({ useDownloadPath: false, downloadPath: '/mine' });
  });

  it("falls back to the server's temp-path setting", () => {
    expect(
      getDownloadPathPrefill(undefined, { temp_path_enabled: true, temp_path: '/srv' }),
    ).toEqual({ useDownloadPath: true, downloadPath: '/srv' });
    expect(getDownloadPathPrefill(undefined, { temp_path_enabled: false })).toEqual({
      useDownloadPath: false,
      downloadPath: '',
    });
  });

  it('is off and empty with nothing to go on', () => {
    expect(getDownloadPathPrefill(undefined, null)).toEqual({
      useDownloadPath: false,
      downloadPath: '',
    });
  });
});

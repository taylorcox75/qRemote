import {
  buildAddOptionPrefill,
  buildDownloadPathOptions,
  formatKibLimitHint,
  getDownloadPathPrefill,
  parseKibLimitInput,
  resolveDefaultSavePath,
  supportsAddTorrentCookie,
  withoutTouchedFields,
  type PrefillableAddField,
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

describe('getDownloadPathPrefill legacy fallback', () => {
  const server = { temp_path_enabled: false, temp_path: '/srv' };
  const legacy = { lastUseDownloadPath: true, lastDownloadPath: '/old', serverCount: 1 };

  it('uses the legacy device-wide choice when exactly one server is saved', () => {
    expect(getDownloadPathPrefill(undefined, server, legacy)).toEqual({
      useDownloadPath: true,
      downloadPath: '/old',
    });
  });

  it('ignores the legacy choice with several servers (no cross-server leak)', () => {
    expect(getDownloadPathPrefill(undefined, server, { ...legacy, serverCount: 2 })).toEqual({
      useDownloadPath: false,
      downloadPath: '/srv',
    });
  });

  it('ignores a legacy choice that was off or had no path', () => {
    expect(
      getDownloadPathPrefill(undefined, server, { ...legacy, lastUseDownloadPath: false }),
    ).toEqual({ useDownloadPath: false, downloadPath: '/srv' });
    expect(
      getDownloadPathPrefill(undefined, server, { ...legacy, lastDownloadPath: '  ' }),
    ).toEqual({ useDownloadPath: false, downloadPath: '/srv' });
  });

  it('a per-server entry always wins over the legacy keys', () => {
    expect(
      getDownloadPathPrefill({ useDownloadPath: false, downloadPath: '' }, server, legacy),
    ).toEqual({ useDownloadPath: false, downloadPath: '' });
  });
});

describe('resolveDefaultSavePath', () => {
  it("prefers the server's save_path", () => {
    expect(
      resolveDefaultSavePath({
        serverSavePath: '/srv',
        serverPrefsLoaded: true,
        defaultSavePathResult: undefined,
        localDefaultSavePath: '/local',
      }),
    ).toBe('/srv');
  });

  it('falls back to app/defaultSavePath, then the local default only when both fail', () => {
    expect(
      resolveDefaultSavePath({
        serverSavePath: undefined,
        serverPrefsLoaded: false,
        defaultSavePathResult: '/default',
        localDefaultSavePath: '/local',
      }),
    ).toBe('/default');
    expect(
      resolveDefaultSavePath({
        serverSavePath: undefined,
        serverPrefsLoaded: false,
        defaultSavePathResult: null,
        localDefaultSavePath: '/local',
      }),
    ).toBe('/local');
    expect(
      resolveDefaultSavePath({
        serverSavePath: undefined,
        serverPrefsLoaded: false,
        defaultSavePathResult: null,
        localDefaultSavePath: undefined,
      }),
    ).toBe('');
  });
});

describe('add dialogue prefill', () => {
  const serverPrefs = {
    save_path: '/srv/save',
    auto_tmm_enabled: false,
    temp_path_enabled: true,
    temp_path: '/srv/tmp',
  };
  const full = buildAddOptionPrefill({
    localPrefs: { pauseOnAdd: true, defaultPriority: 1 },
    savedDownloadPath: undefined,
    serverPrefs,
    defaultSavePath: '/srv/save',
  });

  it('builds every editable field from local and server defaults', () => {
    expect(full).toEqual({
      savePath: '/srv/save',
      useDownloadPath: true,
      downloadPath: '/srv/tmp',
      tmmMode: 'manual',
      stopped: true,
      firstLastPiecePrio: true,
    });
  });

  it('automatic TMM turns the download path off; missing prefs leave fields alone', () => {
    const p = buildAddOptionPrefill({
      localPrefs: null,
      savedDownloadPath: undefined,
      serverPrefs: { ...serverPrefs, auto_tmm_enabled: true },
      defaultSavePath: '/srv/save',
    });
    expect(p.tmmMode).toBe('automatic');
    expect(p.useDownloadPath).toBe(false);
    expect('stopped' in p).toBe(false);
    expect('firstLastPiecePrio' in p).toBe(false);
    const noServer = buildAddOptionPrefill({
      localPrefs: null,
      savedDownloadPath: undefined,
      serverPrefs: null,
      defaultSavePath: 42,
    });
    expect(noServer.savePath).toBe('');
    expect('tmmMode' in noServer).toBe(false);
  });

  it("a late server prefill doesn't overwrite a typed save path", () => {
    const touched = new Set<PrefillableAddField>(['savePath']);
    const p = withoutTouchedFields(full, touched);
    expect('savePath' in p).toBe(false);
    expect(p.downloadPath).toBe('/srv/tmp');
  });

  it('keeps every edited field when the prefill runs again', () => {
    const touched = new Set<PrefillableAddField>([
      'savePath',
      'useDownloadPath',
      'downloadPath',
      'tmmMode',
      'stopped',
      'firstLastPiecePrio',
    ]);
    expect(withoutTouchedFields(full, touched)).toEqual({});
    expect(withoutTouchedFields(full, new Set())).toEqual(full);
  });
});

describe('formatKibLimitHint', () => {
  it('converts typed KiB/s to a readable speed', () => {
    expect(formatKibLimitHint('1024')).toMatch(/MiB\/s|MB\/s/);
    expect(formatKibLimitHint('512')).toMatch(/KiB\/s|KB\/s/);
  });

  it('shows nothing for empty, invalid or unlimited input', () => {
    expect(formatKibLimitHint('')).toBeNull();
    expect(formatKibLimitHint('0')).toBeNull();
    expect(formatKibLimitHint('abc')).toBeNull();
    expect(formatKibLimitHint('-5')).toBeNull();
  });
});

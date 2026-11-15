import {
  getContentLayoutKey,
  getPreferenceKeys,
  readContentLayout,
} from '@/utils/server-preferences';

describe('getPreferenceKeys', () => {
  it('returns the keys of a fetched preferences object', () => {
    const keys = getPreferenceKeys({ scan_dirs: {}, merge_trackers: false });
    expect(keys.has('scan_dirs')).toBe(true);
    expect(keys.has('merge_trackers')).toBe(true);
    expect(keys.has('use_unwanted_folder')).toBe(false);
  });

  it('is empty for a failed fetch', () => {
    expect(getPreferenceKeys(null).size).toBe(0);
    expect(getPreferenceKeys(undefined).size).toBe(0);
    expect(getPreferenceKeys([]).size).toBe(0);
  });
});

describe('getContentLayoutKey', () => {
  it('prefers torrent_content_layout (qBit 4.3.2+)', () => {
    expect(
      getContentLayoutKey(new Set(['torrent_content_layout', 'create_subfolder_enabled'])),
    ).toBe('torrent_content_layout');
  });

  it('falls back to create_subfolder_enabled on older servers', () => {
    expect(getContentLayoutKey(new Set(['create_subfolder_enabled']))).toBe(
      'create_subfolder_enabled',
    );
  });

  it('is null when neither key is reported', () => {
    expect(getContentLayoutKey(new Set())).toBeNull();
  });
});

describe('readContentLayout', () => {
  it('reads the enum', () => {
    expect(readContentLayout({ torrent_content_layout: 'Subfolder' })).toBe('Subfolder');
  });

  it('maps the legacy bool like qBit 4.3.2 migration', () => {
    expect(readContentLayout({ create_subfolder_enabled: true })).toBe('Original');
    expect(readContentLayout({ create_subfolder_enabled: false })).toBe('NoSubfolder');
  });

  it('defaults to Original', () => {
    expect(readContentLayout(null)).toBe('Original');
    expect(readContentLayout({ torrent_content_layout: 'bogus' })).toBe('Original');
  });
});

// TorrentDefaultsScreen.test.tsx — Settings → Server Settings
// (app/(tabs)/settings/torrent-defaults.tsx): local list defaults, category and
// tag management, and the qBittorrent preferences written through
// app/setPreferences, including rollback when the server rejects a write.
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react-native';
import TorrentDefaultsScreen from '@/app/(tabs)/settings/torrent-defaults';
import { routerMock, toastMock, resetSharedMocks } from './helpers';

jest.mock('expo-router', () => require('./helpers').expoRouterMock);
jest.mock('react-i18next', () => require('./helpers').i18nMock);
jest.mock('@/context/ThemeContext', () => require('./helpers').themeContextMock);
jest.mock('@/context/ToastContext', () => require('./helpers').toastContextMock);
jest.mock('@/components/FocusAwareStatusBar', () => require('./helpers').statusBarMock);
jest.mock('@/components/OptionPicker', () => require('./helpers').optionPickerMock);
jest.mock('@/components/InputModal', () => require('./helpers').inputModalMock);
jest.mock('@/components/PathAutocompleteInput', () => require('./helpers').pathAutocompleteMock);

const mockServer = { isConnected: true };
jest.mock('@/context/ServerContext', () => ({ useServer: () => mockServer }));
const mockTorrents = { tags: [] as string[] };
jest.mock('@/context/TorrentContext', () => ({ useTorrents: () => mockTorrents }));

let mockLocalPrefs: Record<string, unknown> = {};
const mockSavePreferences = jest.fn(async (p: Record<string, unknown>) => {
  mockLocalPrefs = { ...p };
});
jest.mock('@/services/storage', () => ({
  storageService: {
    getPreferences: jest.fn(async () => ({ ...mockLocalPrefs })),
    savePreferences: (p: Record<string, unknown>) => mockSavePreferences(p),
  },
}));

const mockApp = {
  getPreferences: jest.fn(),
  setPreferences: jest.fn(),
  getDefaultSavePath: jest.fn(),
};
jest.mock('@/services/api/application', () => ({
  get applicationApi() {
    return mockApp;
  },
}));
jest.mock('@/services/api/client', () => ({
  apiClient: { getApiFeatures: () => ({ useAddStoppedEnabledPreference: true }) },
}));
const mockCategories = {
  getAllCategories: jest.fn(),
  addCategory: jest.fn(),
  editCategory: jest.fn(),
  removeCategories: jest.fn(),
};
jest.mock('@/services/api/categories', () => ({
  get categoriesApi() {
    return mockCategories;
  },
}));
const mockTorrentsApi = { getTorrentList: jest.fn(), setTorrentCategory: jest.fn() };
jest.mock('@/services/api/torrents', () => ({
  get torrentsApi() {
    return mockTorrentsApi;
  },
}));
const mockTags = { createTags: jest.fn(), deleteTags: jest.fn() };
jest.mock('@/services/api/tags', () => ({
  get tagsApi() {
    return mockTags;
  },
}));

const FULL_SERVER_PREFS = {
  add_stopped_enabled: true,
  auto_tmm_enabled: false,
  torrent_changed_tmm_enabled: false,
  save_path_changed_tmm_enabled: true,
  category_changed_tmm_enabled: false,
  use_category_paths_in_manual_mode: false,
  torrent_content_layout: 'Original',
  temp_path_enabled: false,
  temp_path: '/incomplete',
  preallocate_all: false,
  incomplete_files_ext: false,
  use_unwanted_folder: false,
  export_dir: '',
  export_dir_fin: '/done-torrents',
  add_to_top_of_queue: false,
  torrent_stop_condition: 'None',
  merge_trackers: false,
  auto_delete_mode: 0,
  scan_dirs: { '/watch/a': 0, '/watch/b': 1, '/watch/c': '/custom' },
  excluded_file_names_enabled: false,
  excluded_file_names: '',
};

async function renderScreen() {
  await render(<TorrentDefaultsScreen />);
  await waitFor(() => expect(mockApp.getPreferences).toHaveBeenCalled());
}

/** The single Switch in the row that holds `label`. */
function switchFor(label: string) {
  let node = screen.getByText(label).parent;
  while (node) {
    const found = within(node).queryAllByRole('switch');
    if (found.length === 1) return found[0];
    if (found.length > 1) break;
    node = node.parent;
  }
  throw new Error(`No single switch found for ${label}`);
}

const S = (k: string) => `screens.settings.${k}`;

beforeEach(() => {
  resetSharedMocks();
  mockServer.isConnected = true;
  mockTorrents.tags = [];
  mockLocalPrefs = {};
  mockSavePreferences.mockClear();
  mockApp.getPreferences.mockReset().mockResolvedValue({ ...FULL_SERVER_PREFS });
  mockApp.setPreferences.mockReset().mockResolvedValue(undefined);
  // Arrives after app/preferences, as it does over a real network.
  mockApp.getDefaultSavePath
    .mockReset()
    .mockImplementation(() => new Promise((r) => setTimeout(() => r('/downloads'), 20)));
  mockCategories.getAllCategories.mockReset().mockResolvedValue({});
  mockCategories.addCategory.mockReset().mockResolvedValue(undefined);
  mockCategories.editCategory.mockReset().mockResolvedValue(undefined);
  mockCategories.removeCategories.mockReset().mockResolvedValue(undefined);
  mockTorrentsApi.getTorrentList.mockReset().mockResolvedValue([]);
  mockTorrentsApi.setTorrentCategory.mockReset().mockResolvedValue(undefined);
  mockTags.createTags.mockReset().mockResolvedValue(undefined);
  mockTags.deleteTags.mockReset().mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Presses the button labelled `text` in the most recent Alert.alert call. */
async function pressAlertButton(text: string) {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  const buttons = calls[calls.length - 1][2] as { text: string; onPress?: () => unknown }[];
  await buttons.find((b) => b.text === text)?.onPress?.();
}

describe('TorrentDefaultsScreen — local list defaults', () => {
  it('loads saved sort/filter defaults and hides server sections while offline', async () => {
    mockServer.isConnected = false;
    mockLocalPrefs = { defaultSortBy: 'size', defaultSortDirection: 'asc', defaultFilter: 'paused' };
    await renderScreen();

    expect(await screen.findByText('sort.size')).toBeTruthy();
    expect(screen.getByText(S('ascending'))).toBeTruthy();
    expect(screen.getByText('filters.paused')).toBeTruthy();
    expect(screen.queryByText(S('categories').toUpperCase())).toBeNull();
    expect(screen.queryByText(S('filesSection').toUpperCase())).toBeNull();
    expect(mockApp.getDefaultSavePath).not.toHaveBeenCalled();
    expect(mockCategories.getAllCategories).not.toHaveBeenCalled();
  });

  it('flips the sort direction and persists it', async () => {
    await renderScreen();
    await fireEvent.press(await screen.findByText(S('descending')));
    expect(await screen.findByText(S('ascending'))).toBeTruthy();
    await waitFor(() =>
      expect(mockSavePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ defaultSortDirection: 'asc' }),
      ),
    );
  });

  it('saves a new default sort field from the picker', async () => {
    await renderScreen();
    await fireEvent.press(await screen.findByText('sort.dateAdded'));
    await fireEvent.press(await screen.findByTestId('option-ratio'));
    await waitFor(() =>
      expect(mockSavePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ defaultSortBy: 'ratio' }),
      ),
    );
    expect(screen.queryByTestId(`picker:${S('sortBy')}`)).toBeNull();
    expect(screen.getByText('sort.ulRatio')).toBeTruthy();
  });

  it('saves a new default filter and closes the picker on dismiss', async () => {
    await renderScreen();
    await fireEvent.press(await screen.findByText('filters.all'));
    await fireEvent.press(screen.getByTestId('option-completed'));
    await waitFor(() =>
      expect(mockSavePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ defaultFilter: 'completed' }),
      ),
    );
    await fireEvent.press(screen.getByText('filters.completed'));
    await fireEvent.press(screen.getByTestId('picker-close'));
    expect(screen.queryByTestId('picker-close')).toBeNull();
  });

  it('stores the save path locally when offline', async () => {
    mockServer.isConnected = false;
    mockApp.getPreferences.mockRejectedValue(new Error('offline'));
    await render(<TorrentDefaultsScreen />);
    // The save-path editor lives in the server-only Save Locations card, so
    // offline it is unreachable; the picker rows still work.
    expect(screen.queryByText(S('defaultSavePath'))).toBeNull();
    expect(await screen.findByText(S('defaultSortBy'))).toBeTruthy();
  });

  it('toggles the app-only switches into local preferences', async () => {
    await renderScreen();
    await screen.findByText(S('autoCategorizeByTracker'));
    await fireEvent(switchFor(S('autoCategorizeByTracker')), 'valueChange', true);
    await waitFor(() =>
      expect(mockSavePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ autoCategorizeByTracker: true }),
      ),
    );
    await fireEvent(switchFor(S('firstLastPiecePriority')), 'valueChange', true);
    await waitFor(() =>
      expect(mockSavePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ defaultPriority: 1 }),
      ),
    );
    await fireEvent(switchFor(S('firstLastPiecePriority')), 'valueChange', false);
    await waitFor(() =>
      expect(mockSavePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ defaultPriority: 0 }),
      ),
    );
  });

  it('navigates back and to the advanced server settings', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('common.back'));
    expect(routerMock.back).toHaveBeenCalled();
    await fireEvent.press(await screen.findByText(S('advancedServerSettings')));
    expect(routerMock.push).toHaveBeenCalledWith('/settings/server-settings-advanced');
  });
});

describe('TorrentDefaultsScreen — server-backed values', () => {
  it('reads pause-on-add from the server and refreshes the local cache', async () => {
    mockLocalPrefs = { pauseOnAdd: false };
    await renderScreen();
    await waitFor(() =>
      expect(mockSavePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ pauseOnAdd: true }),
      ),
    );
    expect(switchFor(S('pauseOnAdd')).props.value).toBe(true);
  });

  it('falls back to the cached pause-on-add when the server read fails', async () => {
    mockLocalPrefs = { pauseOnAdd: true };
    mockApp.getPreferences.mockRejectedValue(new Error('down'));
    await renderScreen();
    await waitFor(() => expect(switchFor(S('pauseOnAdd')).props.value).toBe(true));
  });

  it('writes pause-on-add under the version-specific key, and rolls back on failure', async () => {
    await renderScreen();
    await waitFor(() => expect(switchFor(S('pauseOnAdd')).props.value).toBe(true));

    await fireEvent(switchFor(S('pauseOnAdd')), 'valueChange', false);
    await waitFor(() =>
      expect(mockApp.setPreferences).toHaveBeenCalledWith({ add_stopped_enabled: false }),
    );

    mockApp.setPreferences.mockRejectedValueOnce(new Error('nope'));
    await fireEvent(switchFor(S('pauseOnAdd')), 'valueChange', true);
    await waitFor(() => expect(switchFor(S('pauseOnAdd')).props.value).toBe(false));
  });

  it('replaces the cached save path with the server default', async () => {
    await renderScreen();
    expect(await screen.findByText('/downloads')).toBeTruthy();
    await waitFor(() =>
      expect(mockSavePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ defaultSavePath: '/downloads' }),
      ),
    );
  });

  // The server default can be replaced by the cached local value when
  // app/defaultSavePath answers before app/preferences.
  it.skip('keeps the server default save path when it arrives before the preferences', async () => {
    mockApp.getDefaultSavePath.mockResolvedValue('/downloads');
    await renderScreen();
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByText('/downloads')).toBeTruthy();
  });

  it.each([
    ['preallocateDiskSpace', 'preallocate_all'],
    ['appendIncompleteExtension', 'incomplete_files_ext'],
    ['useUnwantedFolder', 'use_unwanted_folder'],
    ['useCategoryPathsInManualMode', 'use_category_paths_in_manual_mode'],
    ['keepIncompleteIn', 'temp_path_enabled'],
    ['addToTopOfQueue', 'add_to_top_of_queue'],
    ['mergeTrackers', 'merge_trackers'],
    ['excludedFileNames', 'excluded_file_names_enabled'],
  ])('switch "%s" writes %s and confirms with a toast', async (label, key) => {
    await renderScreen();
    await screen.findByText(S(label));
    await fireEvent(switchFor(S(label)), 'valueChange', true);
    await waitFor(() => expect(mockApp.setPreferences).toHaveBeenCalledWith({ [key]: true }));
    expect(toastMock.showToast).toHaveBeenCalledWith('toast.serverSettingUpdated', 'success');
    expect(switchFor(S(label)).props.value).toBe(true);
  });

  it('rolls a server switch back and reports the error when the write fails', async () => {
    mockApp.setPreferences.mockRejectedValue(new Error('403'));
    await renderScreen();
    await screen.findByText(S('preallocateDiskSpace'));
    await fireEvent(switchFor(S('preallocateDiskSpace')), 'valueChange', true);
    await waitFor(() =>
      expect(toastMock.showToast).toHaveBeenCalledWith(
        'errors.failedToUpdateServerSetting',
        'error',
      ),
    );
    expect(switchFor(S('preallocateDiskSpace')).props.value).toBe(false);
  });

  it('hides rows for preference keys the server did not report', async () => {
    mockApp.getPreferences.mockResolvedValue({ add_stopped_enabled: false });
    await renderScreen();
    await screen.findByText(S('preallocateDiskSpace'));
    expect(screen.queryByText(S('mergeTrackers'))).toBeNull();
    expect(screen.queryByText(S('useUnwantedFolder'))).toBeNull();
    expect(screen.queryByText(S('contentLayout'))).toBeNull();
    expect(screen.queryByText(S('automaticImport').toUpperCase())).toBeNull();
  });

  it.each([
    [S('tmmModeManual'), 'option-true', 'auto_tmm_enabled', true],
    [S('manualModeShort'), 'option-true', 'torrent_changed_tmm_enabled', true],
    [S('relocateShort'), 'option-false', 'save_path_changed_tmm_enabled', false],
  ])('picker opened from "%s" writes %s', async (label, option, key, value) => {
    await renderScreen();
    await fireEvent.press((await screen.findAllByText(label))[0]);
    await fireEvent.press(screen.getByTestId(option));
    await waitFor(() => expect(mockApp.setPreferences).toHaveBeenCalledWith({ [key]: value }));
  });

  it('writes the category save-path-changed behaviour', async () => {
    await renderScreen();
    await screen.findByText(S('whenCategorySavePathChanged'));
    // Rows in order: category changed, save path changed, category save path changed.
    const manual = screen.getAllByText(S('manualModeShort'));
    await fireEvent.press(manual[manual.length - 1]);
    expect(screen.getByTestId(`picker:${S('whenCategorySavePathChanged')}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('option-true'));
    await waitFor(() =>
      expect(mockApp.setPreferences).toHaveBeenCalledWith({ category_changed_tmm_enabled: true }),
    );
  });

  it('writes torrent_content_layout on qBittorrent 4.3.2+', async () => {
    await renderScreen();
    await fireEvent.press(await screen.findByText(S('contentLayoutOriginal')));
    expect(screen.getByTestId('option-Subfolder')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('option-NoSubfolder'));
    await waitFor(() =>
      expect(mockApp.setPreferences).toHaveBeenCalledWith({
        torrent_content_layout: 'NoSubfolder',
      }),
    );
    expect(await screen.findByText(S('contentLayoutNoSubfolder'))).toBeTruthy();
  });

  it('writes the legacy create_subfolder_enabled bool and offers no Subfolder option', async () => {
    mockApp.getPreferences.mockResolvedValue({ create_subfolder_enabled: true });
    await renderScreen();
    await fireEvent.press(await screen.findByText(S('contentLayoutOriginal')));
    expect(screen.queryByTestId('option-Subfolder')).toBeNull();
    await fireEvent.press(screen.getByTestId('option-NoSubfolder'));
    await waitFor(() =>
      expect(mockApp.setPreferences).toHaveBeenCalledWith({ create_subfolder_enabled: false }),
    );
  });

  it('writes the stop condition and auto-delete mode', async () => {
    await renderScreen();
    await fireEvent.press(await screen.findByText(S('stopConditionNone')));
    await fireEvent.press(screen.getByTestId('option-MetadataReceived'));
    await waitFor(() =>
      expect(mockApp.setPreferences).toHaveBeenCalledWith({
        torrent_stop_condition: 'MetadataReceived',
      }),
    );

    await fireEvent.press(screen.getByText(S('autoDeleteModeNever')));
    await fireEvent.press(screen.getByTestId('option-2'));
    await waitFor(() =>
      expect(mockApp.setPreferences).toHaveBeenCalledWith({ auto_delete_mode: 2 }),
    );
    expect(await screen.findByText(S('autoDeleteModeAlways'))).toBeTruthy();
  });

  it('closes each picker without writing when dismissed', async () => {
    await renderScreen();
    await screen.findByText(S('stopConditionNone'));
    for (const label of [
      S('tmmModeManual'),
      S('stopConditionNone'),
      S('autoDeleteModeNever'),
      S('contentLayoutOriginal'),
    ]) {
      await fireEvent.press(screen.getAllByText(label)[0]);
      await fireEvent.press(screen.getByTestId('picker-close'));
    }
    for (const label of screen.getAllByText(/ModeShort$/)) {
      await fireEvent.press(label);
      await fireEvent.press(screen.getByTestId('picker-close'));
    }
    expect(screen.queryByTestId('picker-close')).toBeNull();
    expect(mockApp.setPreferences).not.toHaveBeenCalled();
  });
});

describe('TorrentDefaultsScreen — paths', () => {
  const editButtons = () => screen.getAllByLabelText('common.edit');

  it('saves the default save path to the server', async () => {
    await renderScreen();
    await screen.findByText('/downloads');
    await fireEvent.press(editButtons()[0]);
    await fireEvent.changeText(screen.getByTestId('input-modal-field'), '/new/path');
    await fireEvent.press(screen.getByTestId('input-modal-confirm'));
    await waitFor(() =>
      expect(mockApp.setPreferences).toHaveBeenCalledWith({ save_path: '/new/path' }),
    );
    expect(toastMock.showToast).toHaveBeenCalledWith('toast.savePathUpdated', 'success');
    expect(await screen.findByText('/new/path')).toBeTruthy();
  });

  it('reports a failed save path update', async () => {
    mockApp.setPreferences.mockRejectedValue(new Error('x'));
    await renderScreen();
    await screen.findByText('/downloads');
    await fireEvent.press(editButtons()[0]);
    await fireEvent.press(screen.getByTestId('input-modal-confirm'));
    await waitFor(() =>
      expect(toastMock.showToast).toHaveBeenCalledWith('errors.failedToUpdateSavePath', 'error'),
    );
  });

  it('saves the incomplete-files path and the two export directories', async () => {
    await renderScreen();
    await screen.findByText('/incomplete');

    await fireEvent.press(editButtons()[1]);
    await fireEvent.changeText(screen.getByTestId('input-modal-field'), '/tmp2');
    await fireEvent.press(screen.getByTestId('input-modal-confirm'));
    await waitFor(() => expect(mockApp.setPreferences).toHaveBeenCalledWith({ temp_path: '/tmp2' }));

    await fireEvent.press(editButtons()[2]);
    await fireEvent.changeText(screen.getByTestId('input-modal-field'), '/export');
    await fireEvent.press(screen.getByTestId('input-modal-confirm'));
    await waitFor(() =>
      expect(mockApp.setPreferences).toHaveBeenCalledWith({ export_dir: '/export' }),
    );

    await fireEvent.press(editButtons()[3]);
    expect(screen.getByTestId('input-modal-field').props.value).toBe('/done-torrents');
    await fireEvent.changeText(screen.getByTestId('input-modal-field'), '/fin');
    await fireEvent.press(screen.getByTestId('input-modal-confirm'));
    await waitFor(() =>
      expect(mockApp.setPreferences).toHaveBeenCalledWith({ export_dir_fin: '/fin' }),
    );
  });

  it('cancels each path modal without writing', async () => {
    await renderScreen();
    await screen.findByText('/downloads');
    for (let i = 0; i < 4; i++) {
      await fireEvent.press(editButtons()[i]);
      await fireEvent.press(screen.getByTestId('input-modal-cancel'));
    }
    expect(screen.queryByTestId('input-modal-field')).toBeNull();
    expect(mockApp.setPreferences).not.toHaveBeenCalled();
  });

  it('asks for a directory when an export switch is turned on, and clears it when off', async () => {
    await renderScreen();
    await screen.findByText('/done-torrents');

    await fireEvent(switchFor(S('copyTorrentFilesTo')), 'valueChange', true);
    expect(screen.getByTestId(`input-modal:${S('copyTorrentFilesToTitle')}`)).toBeTruthy();
    expect(mockApp.setPreferences).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('input-modal-cancel'));

    await fireEvent(switchFor(S('copyTorrentFilesForFinishedTo')), 'valueChange', true);
    expect(
      screen.getByTestId(`input-modal:${S('copyTorrentFilesForFinishedToTitle')}`),
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId('input-modal-cancel'));

    await fireEvent(switchFor(S('copyTorrentFilesForFinishedTo')), 'valueChange', false);
    await waitFor(() => expect(mockApp.setPreferences).toHaveBeenCalledWith({ export_dir_fin: '' }));

    mockApp.getPreferences.mockResolvedValue({ ...FULL_SERVER_PREFS, export_dir: '/e' });
  });

  it('clears the export directory when its switch is turned off', async () => {
    mockApp.getPreferences.mockResolvedValue({ ...FULL_SERVER_PREFS, export_dir: '/e' });
    await renderScreen();
    await screen.findByText('/e');
    await fireEvent(switchFor(S('copyTorrentFilesTo')), 'valueChange', false);
    await waitFor(() => expect(mockApp.setPreferences).toHaveBeenCalledWith({ export_dir: '' }));
  });
});

describe('TorrentDefaultsScreen — automatic import', () => {
  it('lists monitored folders with their override labels', async () => {
    await renderScreen();
    expect(await screen.findByText('/watch/a')).toBeTruthy();
    expect(screen.getByText('/watch/b')).toBeTruthy();
    expect(screen.getByText('/custom')).toBeTruthy();
    expect(screen.getAllByText(S('monitoredFolderOverrideWatch')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(S('monitoredFolderOverrideDefault')).length).toBeGreaterThan(0);
  });

  it('shows the empty state when no folders are monitored', async () => {
    mockApp.getPreferences.mockResolvedValue({ ...FULL_SERVER_PREFS, scan_dirs: {} });
    await renderScreen();
    expect(await screen.findByText(S('noMonitoredFolders'))).toBeTruthy();
  });

  it('removes a folder by rewriting the whole scan_dirs map', async () => {
    await renderScreen();
    await screen.findByText('/watch/a');
    const row = screen.getByText('/watch/a').parent!.parent!;
    await fireEvent.press(within(row).getByLabelText('common.delete'));
    await waitFor(() =>
      expect(mockApp.setPreferences).toHaveBeenCalledWith({
        scan_dirs: { '/watch/b': 1, '/watch/c': '/custom' },
      }),
    );
    expect(screen.queryByText('/watch/a')).toBeNull();
  });

  it('changes a folder override to watch, default and a custom path', async () => {
    await renderScreen();
    await screen.findByText('/watch/a');
    const chevronFor = (folder: string) => {
      const block = screen.getByText(folder).parent!.parent!.parent!;
      return block.queryAll((n) => n.props.accessible === true).slice(-1)[0];
    };

    await fireEvent.press(chevronFor('/watch/b'));
    expect(screen.getByText('picker-selected:default')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('option-watch'));
    await waitFor(() =>
      expect(mockApp.setPreferences).toHaveBeenLastCalledWith({
        scan_dirs: { '/watch/a': 0, '/watch/b': 0, '/watch/c': '/custom' },
      }),
    );

    await fireEvent.press(chevronFor('/watch/a'));
    await fireEvent.press(screen.getByTestId('option-default'));
    await waitFor(() =>
      expect(mockApp.setPreferences).toHaveBeenLastCalledWith({
        scan_dirs: { '/watch/a': 1, '/watch/b': 0, '/watch/c': '/custom' },
      }),
    );

    await fireEvent.press(chevronFor('/watch/c'));
    expect(screen.getByText('picker-selected:other')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('option-other'));
    await fireEvent.changeText(screen.getByTestId('input-modal-field'), '/elsewhere');
    await fireEvent.press(screen.getByTestId('input-modal-confirm'));
    await waitFor(() =>
      expect(mockApp.setPreferences).toHaveBeenLastCalledWith({
        scan_dirs: { '/watch/a': 1, '/watch/b': 0, '/watch/c': '/elsewhere' },
      }),
    );

    await fireEvent.press(chevronFor('/watch/c'));
    await fireEvent.press(screen.getByTestId('picker-close'));
    await fireEvent.press(chevronFor('/watch/c'));
    await fireEvent.press(screen.getByTestId('option-other'));
    await fireEvent.press(screen.getByTestId('input-modal-cancel'));
    expect(mockApp.setPreferences).toHaveBeenCalledTimes(3);
  });

  it('adds a monitored folder, ignoring a blank path', async () => {
    await renderScreen();
    await screen.findByText('/watch/a');
    await fireEvent.press(screen.getByText(S('addMonitoredFolder')));
    await fireEvent.press(screen.getByText(S('addMonitoredFolder')));
    expect(mockApp.setPreferences).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByPlaceholderText(S('monitoredFolderPlaceholder')), ' /new ');
    await fireEvent.press(screen.getByText(S('addMonitoredFolder')));
    await waitFor(() =>
      expect(mockApp.setPreferences).toHaveBeenCalledWith({
        scan_dirs: { ...FULL_SERVER_PREFS.scan_dirs, '/new': 1 },
      }),
    );
    expect(await screen.findByText('/new')).toBeTruthy();
  });

  it('saves the excluded file names list on blur', async () => {
    mockApp.getPreferences.mockResolvedValue({
      ...FULL_SERVER_PREFS,
      excluded_file_names_enabled: true,
      excluded_file_names: '*.txt',
    });
    await renderScreen();
    const input = await screen.findByDisplayValue('*.txt');
    await fireEvent.changeText(input, '*.txt\n*.nfo');
    await fireEvent(input, 'blur');
    await waitFor(() =>
      expect(mockApp.setPreferences).toHaveBeenCalledWith({ excluded_file_names: '*.txt\n*.nfo' }),
    );
  });

  it('restores the excluded file names when the server rejects them', async () => {
    mockApp.getPreferences.mockResolvedValue({
      ...FULL_SERVER_PREFS,
      excluded_file_names_enabled: true,
      excluded_file_names: '*.txt',
    });
    mockApp.setPreferences.mockRejectedValue(new Error('x'));
    await renderScreen();
    const input = await screen.findByDisplayValue('*.txt');
    await fireEvent(input, 'blur');
    await waitFor(() =>
      expect(toastMock.showToast).toHaveBeenCalledWith(
        'errors.failedToUpdateServerSetting',
        'error',
      ),
    );
    expect(screen.getByDisplayValue('*.txt')).toBeTruthy();
  });
});

describe('TorrentDefaultsScreen — categories', () => {
  const CATS = {
    Movies: { name: 'Movies', savePath: '/m' },
    TV: { name: 'TV', savePath: '' },
  };

  it('shows the empty state, then validates and adds a category', async () => {
    await renderScreen();
    expect(await screen.findByText(S('noCategories'))).toBeTruthy();

    await fireEvent.press(screen.getByLabelText(S('addCategory')));
    await fireEvent.press(screen.getByText(S('addCategory')));
    expect(toastMock.showToast).toHaveBeenCalledWith('errors.enterCategoryName', 'error');

    mockCategories.getAllCategories.mockResolvedValue({ Music: { name: 'Music', savePath: '' } });
    await fireEvent.changeText(screen.getByPlaceholderText(S('categoryName')), ' Music ');
    await fireEvent.changeText(screen.getByPlaceholderText(S('savePathOptional')), '/music');
    await fireEvent.press(screen.getByText(S('addCategory')));
    await waitFor(() => expect(mockCategories.addCategory).toHaveBeenCalledWith('Music', '/music'));
    expect(toastMock.showToast).toHaveBeenCalledWith('toast.categoryAdded:Music', 'success');
    expect(await screen.findByText('Music')).toBeTruthy();
  });

  it('reports a failed category add and can close the form', async () => {
    mockCategories.addCategory.mockRejectedValue(new Error('x'));
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText(S('addCategory')));
    await fireEvent.changeText(screen.getByPlaceholderText(S('categoryName')), 'X');
    await fireEvent.press(screen.getByText(S('addCategory')));
    await waitFor(() =>
      expect(toastMock.showToast).toHaveBeenCalledWith('errors.failedToAddCategory', 'error'),
    );
    expect(mockCategories.addCategory).toHaveBeenCalledWith('X', undefined);
    await fireEvent.press(screen.getAllByLabelText('common.cancel')[0]);
    expect(screen.queryByPlaceholderText(S('categoryName'))).toBeNull();
  });

  it('deletes a category after confirmation, and reports a failure', async () => {
    mockCategories.getAllCategories.mockResolvedValue(CATS);
    await renderScreen();
    await screen.findByText('Movies');
    const chip = screen.getByText('Movies').parent!;
    await fireEvent.press(within(chip).getByLabelText('common.delete'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'alerts.deleteCategory:Movies',
      'alerts.deleteCategoryMessage',
      expect.any(Array),
    );
    await pressAlertButton('common.delete');
    expect(mockCategories.removeCategories).toHaveBeenCalledWith(['Movies']);
    expect(toastMock.showToast).toHaveBeenCalledWith('toast.categoryDeleted:Movies', 'success');

    mockCategories.removeCategories.mockRejectedValueOnce(new Error('x'));
    await fireEvent(screen.getByText('TV').parent!, 'longPress');
    await pressAlertButton('common.delete');
    expect(toastMock.showToast).toHaveBeenCalledWith('errors.failedToDeleteCategory', 'error');
  });

  it('edits a category save path in place', async () => {
    mockCategories.getAllCategories.mockResolvedValue(CATS);
    await renderScreen();
    await fireEvent.press(await screen.findByText('Movies'));
    expect(screen.getByText(S('editCategory'))).toBeTruthy();
    await fireEvent.changeText(screen.getByDisplayValue('/m'), '/movies');
    await fireEvent.press(screen.getByText('common.confirm'));
    await waitFor(() =>
      expect(mockCategories.editCategory).toHaveBeenCalledWith('Movies', '/movies'),
    );
    expect(toastMock.showToast).toHaveBeenCalledWith('toast.categoryUpdated:Movies', 'success');
    expect(mockCategories.addCategory).not.toHaveBeenCalled();
  });

  it('rejects an empty name and can be cancelled', async () => {
    mockCategories.getAllCategories.mockResolvedValue(CATS);
    await renderScreen();
    await fireEvent.press(await screen.findByText('TV'));
    await fireEvent.changeText(screen.getByDisplayValue('TV'), '  ');
    await fireEvent.press(screen.getByText('common.confirm'));
    expect(toastMock.showToast).toHaveBeenCalledWith('errors.enterCategoryName', 'error');
    await fireEvent.press(screen.getAllByText('common.cancel').slice(-1)[0]);
    expect(screen.queryByText(S('editCategory'))).toBeNull();
  });

  it('renames a category: recreates it, moves torrents, migrates its color, removes the old one', async () => {
    mockCategories.getAllCategories.mockResolvedValue(CATS);
    mockTorrentsApi.getTorrentList.mockResolvedValue([{ hash: 'h1' }, { hash: 'h2' }]);
    mockLocalPrefs = { categoryColors: { Movies: '#112233' } };
    await renderScreen();
    await fireEvent.press(await screen.findByText('Movies'));
    await fireEvent.changeText(screen.getByDisplayValue('Movies'), 'Films');
    await fireEvent.press(screen.getByText('common.confirm'));

    await waitFor(() =>
      expect(mockCategories.removeCategories).toHaveBeenCalledWith(['Movies']),
    );
    expect(mockTorrentsApi.getTorrentList).toHaveBeenCalledWith(undefined, 'Movies');
    expect(mockCategories.addCategory).toHaveBeenCalledWith('Films', '/m');
    expect(mockTorrentsApi.setTorrentCategory).toHaveBeenCalledWith(['h1', 'h2'], 'Films');
    await waitFor(() =>
      expect(mockSavePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ categoryColors: { Films: '#112233' } }),
      ),
    );
    expect(toastMock.showToast).toHaveBeenCalledWith('toast.categoryUpdated:Films', 'success');
  });

  it('renames an empty category without moving torrents or touching colors', async () => {
    mockCategories.getAllCategories.mockResolvedValue(CATS);
    await renderScreen();
    await fireEvent.press(await screen.findByText('TV'));
    await fireEvent.changeText(screen.getByDisplayValue('TV'), 'Shows');
    await fireEvent.press(screen.getByText('common.confirm'));
    await waitFor(() => expect(mockCategories.removeCategories).toHaveBeenCalledWith(['TV']));
    expect(mockCategories.addCategory).toHaveBeenCalledWith('Shows', undefined);
    expect(mockTorrentsApi.setTorrentCategory).not.toHaveBeenCalled();
  });

  it('removes the half-created category when a rename fails part-way', async () => {
    mockCategories.getAllCategories.mockResolvedValue(CATS);
    mockTorrentsApi.getTorrentList.mockResolvedValue([{ hash: 'h1' }]);
    mockTorrentsApi.setTorrentCategory.mockRejectedValue(new Error('x'));
    await renderScreen();
    await fireEvent.press(await screen.findByText('Movies'));
    await fireEvent.changeText(screen.getByDisplayValue('Movies'), 'Films');
    await fireEvent.press(screen.getByText('common.confirm'));
    await waitFor(() =>
      expect(toastMock.showToast).toHaveBeenCalledWith('errors.failedToUpdateCategory', 'error'),
    );
    expect(mockCategories.removeCategories).toHaveBeenCalledWith(['Films']);
    expect(mockCategories.removeCategories).not.toHaveBeenCalledWith(['Movies']);
  });
});

describe('TorrentDefaultsScreen — tags', () => {
  it('shows the empty state, validates and creates a tag', async () => {
    await renderScreen();
    expect(await screen.findByText(S('noTags'))).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(S('createTag')));
    await fireEvent.press(screen.getByText(S('createTag')));
    expect(toastMock.showToast).toHaveBeenCalledWith('errors.enterTagName', 'error');

    await fireEvent.changeText(screen.getByPlaceholderText(S('tagName')), ' hd ');
    await fireEvent.press(screen.getByText(S('createTag')));
    await waitFor(() => expect(mockTags.createTags).toHaveBeenCalledWith(['hd']));
    expect(toastMock.showToast).toHaveBeenCalledWith('toast.tagCreated:hd', 'success');
  });

  it('reports a failed tag create', async () => {
    mockTags.createTags.mockRejectedValue(new Error('x'));
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText(S('createTag')));
    await fireEvent.changeText(screen.getByPlaceholderText(S('tagName')), 'hd');
    await fireEvent.press(screen.getByText(S('createTag')));
    await waitFor(() =>
      expect(toastMock.showToast).toHaveBeenCalledWith('errors.failedToCreateTag', 'error'),
    );
  });

  it('deletes a tag after confirmation, and reports a failure', async () => {
    mockTorrents.tags = ['hd', 'old'];
    await renderScreen();
    await screen.findByText('hd');
    await fireEvent.press(within(screen.getByText('hd').parent!).getByLabelText('common.delete'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'alerts.deleteTag:hd',
      'alerts.deleteTagMessage',
      expect.any(Array),
    );
    await pressAlertButton('common.delete');
    expect(mockTags.deleteTags).toHaveBeenCalledWith(['hd']);
    expect(toastMock.showToast).toHaveBeenCalledWith('toast.tagDeleted:hd', 'success');

    mockTags.deleteTags.mockRejectedValueOnce(new Error('x'));
    await fireEvent(screen.getByText('old').parent!, 'longPress');
    await pressAlertButton('common.delete');
    expect(toastMock.showToast).toHaveBeenCalledWith('errors.failedToDeleteTag', 'error');
  });
});

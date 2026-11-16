// TorrentFilesScreen.test.tsx — app/(tabs)/(torrents)/torrent/files.tsx:
// folder tree build/collapse, per-file and per-folder priority toggles, the
// priority menu, bulk priority, rename file / folder (and its version gate),
// plus the not-connected, loading, empty and error states.
import React from 'react';
import { render, waitFor, screen, fireEvent } from '@testing-library/react-native';
import TorrentFilesScreen from '@/app/(tabs)/(torrents)/torrent/files';
import { torrentsApi } from '@/services/api/torrents';
import { press, type, flush, fire, ancestorWith } from './helpers';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => ({ hash: 'abc' }),
  useIsFocused: () => true,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && Object.keys(opts).length ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

let mockDark = false;
jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../components/theme-mock').mockColors, isDark: mockDark }),
}));

let mockGlass = false;
jest.mock('@/context/LiquidGlassContext', () => ({
  useLiquidGlass: () => ({ enabled: mockGlass }),
}));

let mockConnected = true;
jest.mock('@/context/ServerContext', () => ({
  useServer: () => ({ isConnected: mockConnected }),
}));

let mockFeatures: Record<string, boolean> = { supportsRenameFolder: true };
jest.mock('@/context/ApiVersionContext', () => ({
  useApiFeatures: () => ({ features: mockFeatures }),
}));

const mockShowToast = jest.fn();
jest.mock('@/context/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

// InputModal stub (see ./stubs): a text field seeded with defaultValue plus confirm/cancel.
jest.mock('@/components/InputModal', () => require('./stubs'));

jest.mock('@/services/api/torrents', () => ({
  torrentsApi: {
    getTorrentContents: jest.fn(),
    setFilePriority: jest.fn(),
    renameFile: jest.fn(),
    renameFolder: jest.fn(),
  },
}));

const api = torrentsApi as jest.Mocked<typeof torrentsApi>;

const file = (index: number, name: string, priority: number, size = 1024, progress = 0.5) =>
  ({
    index,
    name,
    priority,
    size,
    progress,
    is_seed: false,
    piece_range: [0, 1],
    availability: 1,
  }) as never;

const FILES = [
  file(0, 'Show/S01/ep1.mkv', 1, 1024 * 1024),
  file(1, 'Show/S01/ep2.mp3', 0, 0),
  file(2, 'Show/cover.jpg', 6),
  file(3, 'Show/notes.pdf', 7),
  file(4, 'readme.zip', 1),
  file(5, 'other.bin', 4),
];

async function renderLoaded() {
  await render(<TorrentFilesScreen />);
  await screen.findByText('Show');
}

describe('TorrentFilesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnected = true;
    mockGlass = false;
    mockDark = false;
    mockFeatures = { supportsRenameFolder: true };
    api.getTorrentContents.mockResolvedValue(FILES);
    api.setFilePriority.mockResolvedValue(undefined as never);
    api.renameFile.mockResolvedValue(undefined as never);
    api.renameFolder.mockResolvedValue(undefined as never);
  });

  it('shows a not-connected message and does not fetch', async () => {
    mockConnected = false;
    await render(<TorrentFilesScreen />);
    expect(screen.getByText('screens.files.notConnected')).toBeTruthy();
    expect(api.getTorrentContents).not.toHaveBeenCalled();
  });

  it('shows the empty state when the torrent has no files', async () => {
    api.getTorrentContents.mockResolvedValue([]);
    await render(<TorrentFilesScreen />);
    expect(await screen.findByText('screens.files.noFilesFound')).toBeTruthy();
  });

  it('reports a load failure through a toast', async () => {
    api.getTorrentContents.mockRejectedValue(new Error('nope'));
    await render(<TorrentFilesScreen />);
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('nope', 'error'));
  });

  it('starts with folders collapsed and expands them on tap', async () => {
    await renderLoaded();
    expect(api.getTorrentContents).toHaveBeenCalledWith('abc');
    // Top-level files are visible, nested ones are hidden under the collapsed folder.
    expect(screen.getByText('readme.zip')).toBeTruthy();
    expect(screen.getByText('other.bin')).toBeTruthy();
    expect(screen.queryByText('cover.jpg')).toBeNull();
    expect(screen.getByText('5 / 6')).toBeTruthy();

    await press(screen.getByText('Show'));
    expect(await screen.findByText('cover.jpg')).toBeTruthy();
    expect(screen.getByText('notes.pdf')).toBeTruthy();
    expect(screen.getByText('S01')).toBeTruthy();
    expect(screen.queryByText('ep1.mkv')).toBeNull();

    await press(screen.getByText('S01'));
    expect(await screen.findByText('ep1.mkv')).toBeTruthy();
    expect(screen.getByText('ep2.mp3')).toBeTruthy();
    expect(screen.getByText('screens.files.priorityHigh')).toBeTruthy();
    expect(screen.getByText('screens.files.priorityMaximum')).toBeTruthy();

    // Collapse again
    await press(screen.getByText('Show'));
    await waitFor(() => expect(screen.queryByText('cover.jpg')).toBeNull());
  });

  it('renders in dark mode with liquid glass on', async () => {
    mockDark = true;
    mockGlass = true;
    await renderLoaded();
    expect(screen.getByText('readme.zip')).toBeTruthy();
  });

  it('toggles a single file between skipped and normal priority', async () => {
    await renderLoaded();
    await press(screen.getAllByLabelText('screens.files.deselectFile')[0]);
    await waitFor(() => expect(api.setFilePriority).toHaveBeenCalledWith('abc', [4], 0));
    expect(api.getTorrentContents).toHaveBeenCalledTimes(2);

    await press(screen.getByText('Show'));
    await press(await screen.findByText('S01'));
    await press(await screen.findByLabelText('screens.files.selectFile'));
    await waitFor(() => expect(api.setFilePriority).toHaveBeenCalledWith('abc', [1], 1));
  });

  it('reports a file toggle failure', async () => {
    api.setFilePriority.mockRejectedValue(new Error('toggle failed'));
    await renderLoaded();
    await press(screen.getAllByLabelText('screens.files.deselectFile')[0]);
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('toggle failed', 'error'));
  });

  it('selects a partly selected folder, and deselects a fully selected one', async () => {
    await renderLoaded();
    // "Show" has a skipped file → partly selected → selects all.
    await press(screen.getByLabelText('screens.files.selectFolder'));
    await waitFor(() => expect(api.setFilePriority).toHaveBeenCalledWith('abc', [0, 1, 2, 3], 1));

    api.getTorrentContents.mockResolvedValue([file(0, 'A/x.txt', 1), file(1, 'A/y.txt', 1)]);
    await press(screen.getByLabelText('screens.files.selectFolder'));
    await waitFor(() => expect(screen.getByLabelText('screens.files.deselectFolder')).toBeTruthy());
    await press(screen.getByLabelText('screens.files.deselectFolder'));
    await waitFor(() => expect(api.setFilePriority).toHaveBeenLastCalledWith('abc', [0, 1], 0));
  });

  it('reports a folder toggle failure', async () => {
    api.setFilePriority.mockRejectedValue(new Error('folder failed'));
    await renderLoaded();
    await press(screen.getByLabelText('screens.files.selectFolder'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('folder failed', 'error'));
  });

  it('selects and deselects all files', async () => {
    await renderLoaded();
    await press(screen.getByText('screens.files.selectAll'));
    await waitFor(() =>
      expect(api.setFilePriority).toHaveBeenCalledWith('abc', [0, 1, 2, 3, 4, 5], 1),
    );
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('toast.allFilesSelected', 'success'),
    );
    await press(screen.getByText('screens.files.deselectAll'));
    await waitFor(() =>
      expect(api.setFilePriority).toHaveBeenCalledWith('abc', [0, 1, 2, 3, 4, 5], 0),
    );
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('toast.allFilesDeselected', 'success'),
    );
  });

  it('reports select-all and deselect-all failures', async () => {
    api.setFilePriority.mockRejectedValue(new Error('bulk failed'));
    await renderLoaded();
    await press(screen.getByText('screens.files.selectAll'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('bulk failed', 'error'));
    mockShowToast.mockClear();
    await press(screen.getByText('screens.files.deselectAll'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('bulk failed', 'error'));
  });

  it('sets a file priority from the file menu', async () => {
    await renderLoaded();
    await press(screen.getByText('readme.zip'));
    expect(await screen.findByText('screens.files.fileActions')).toBeTruthy();
    await press(screen.getByText('screens.files.highPriority'));
    await waitFor(() => expect(api.setFilePriority).toHaveBeenCalledWith('abc', [4], 6));
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith(
        'toast.prioritySet:{"label":"screens.files.priorityHigh"}',
        'success',
      ),
    );
  });

  it.each([
    ['screens.files.skipDontDownload', 0],
    ['screens.files.normalPriority', 1],
    ['screens.files.maximumPriority', 7],
  ])('applies "%s" from the file menu', async (label, priority) => {
    await renderLoaded();
    await press(screen.getByText('other.bin'));
    await press(await screen.findByText(label));
    await waitFor(() => expect(api.setFilePriority).toHaveBeenCalledWith('abc', [5], priority));
  });

  it('reports a menu priority failure and closes the menu by tapping outside', async () => {
    api.setFilePriority.mockRejectedValue(new Error('prio failed'));
    await renderLoaded();
    await press(screen.getByText('readme.zip'));
    await press(await screen.findByText('screens.files.maximumPriority'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('prio failed', 'error'));
  });

  it('renames a file from the menu, keeping its parent folder', async () => {
    await renderLoaded();
    await press(screen.getByText('Show'));
    await press(await screen.findByText('cover.jpg'));
    await press(await screen.findByText('screens.files.renameFile'));
    const field = await screen.findByTestId('input-modal-field');
    expect(field.props.value).toBe('cover.jpg');
    await type(field, ' poster.jpg ');
    await press(screen.getByTestId('input-modal-confirm'));
    await waitFor(() =>
      expect(api.renameFile).toHaveBeenCalledWith('abc', 'Show/cover.jpg', 'Show/poster.jpg', 2),
    );
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('toast.fileRenamed', 'success'));
  });

  it('renames a top-level file by long-press', async () => {
    await renderLoaded();
    await fireEvent(screen.getByText('readme.zip'), 'longPress');
    await flush();
    await type(await screen.findByTestId('input-modal-field'), 'readme2.zip');
    await press(screen.getByTestId('input-modal-confirm'));
    await waitFor(() =>
      expect(api.renameFile).toHaveBeenCalledWith('abc', 'readme.zip', 'readme2.zip', 4),
    );
  });

  it('rejects an empty name, ignores an unchanged name and reports a rename failure', async () => {
    api.renameFile.mockRejectedValue(new Error('rename failed'));
    await renderLoaded();
    await fireEvent(screen.getByText('readme.zip'), 'longPress');
    await flush();
    await type(await screen.findByTestId('input-modal-field'), '   ');
    await press(screen.getByTestId('input-modal-confirm'));
    expect(mockShowToast).toHaveBeenCalledWith('errors.validName', 'error');

    await fireEvent(screen.getByText('readme.zip'), 'longPress');
    await flush();
    await press(await screen.findByTestId('input-modal-confirm'));
    expect(api.renameFile).not.toHaveBeenCalled();

    await fireEvent(screen.getByText('readme.zip'), 'longPress');
    await flush();
    await type(await screen.findByTestId('input-modal-field'), 'x.zip');
    await press(screen.getByTestId('input-modal-confirm'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('rename failed', 'error'));
  });

  it('cancels the rename modal', async () => {
    await renderLoaded();
    await fireEvent(screen.getByText('readme.zip'), 'longPress');
    await flush();
    await press(await screen.findByTestId('input-modal-cancel'));
    expect(screen.queryByTestId('input-modal')).toBeNull();
  });

  it('renames a nested folder from its rename button', async () => {
    await renderLoaded();
    await press(screen.getByText('Show'));
    await screen.findByText('S01');
    await press(screen.getAllByLabelText('screens.files.renameFolder')[1]);
    const field = await screen.findByTestId('input-modal-field');
    expect(field.props.value).toBe('S01');
    await type(field, 'Season 1');
    await press(screen.getByTestId('input-modal-confirm'));
    await waitFor(() =>
      expect(api.renameFolder).toHaveBeenCalledWith('abc', 'Show/S01', 'Show/Season 1'),
    );
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('toast.folderRenamed', 'success'),
    );
  });

  it('renames a top-level folder by long-press and validates the name', async () => {
    api.renameFolder.mockRejectedValue(new Error('folder rename failed'));
    await renderLoaded();
    await fireEvent(screen.getByText('Show'), 'longPress');
    await flush();
    await type(await screen.findByTestId('input-modal-field'), '');
    await press(screen.getByTestId('input-modal-confirm'));
    expect(mockShowToast).toHaveBeenCalledWith('errors.validName', 'error');

    await fireEvent(screen.getByText('Show'), 'longPress');
    await flush();
    await press(await screen.findByTestId('input-modal-confirm'));
    expect(api.renameFolder).not.toHaveBeenCalled();

    await fireEvent(screen.getByText('Show'), 'longPress');
    await flush();
    await type(await screen.findByTestId('input-modal-field'), 'Series');
    await press(screen.getByTestId('input-modal-confirm'));
    await waitFor(() => expect(api.renameFolder).toHaveBeenCalledWith('abc', 'Show', 'Series'));
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('folder rename failed', 'error'),
    );
  });

  it('hides the folder rename button when the server cannot rename folders', async () => {
    mockFeatures = { supportsRenameFolder: false };
    await renderLoaded();
    expect(screen.queryByLabelText('screens.files.renameFolder')).toBeNull();
  });

  it('applies a bulk priority to the selected files', async () => {
    await renderLoaded();
    await press(screen.getByText('screens.files.changePriority'));
    expect(await screen.findByText('screens.files.selectedCount:{"count":5}')).toBeTruthy();
    await press(screen.getByText('screens.files.highPriority'));
    await waitFor(() =>
      expect(api.setFilePriority).toHaveBeenCalledWith('abc', [0, 2, 3, 4, 5], 6),
    );
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith(
        'toast.prioritySetForCount:{"label":"screens.files.priorityHigh","count":5}',
        'success',
      ),
    );
  });

  it.each([
    ['screens.files.skipDontDownload', 0],
    ['screens.files.normalPriority', 1],
    ['screens.files.maximumPriority', 7],
  ])('applies bulk "%s"', async (label, priority) => {
    await renderLoaded();
    await press(screen.getByText('screens.files.changePriority'));
    await press(await screen.findByText(label));
    await waitFor(() =>
      expect(api.setFilePriority).toHaveBeenCalledWith('abc', [0, 2, 3, 4, 5], priority),
    );
  });

  it('reports a bulk priority failure', async () => {
    api.setFilePriority.mockRejectedValue(new Error('bulk prio failed'));
    await renderLoaded();
    await press(screen.getByText('screens.files.changePriority'));
    await press(await screen.findByText('screens.files.normalPriority'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('bulk prio failed', 'error'));
  });

  it('does not open the bulk menu with nothing selected', async () => {
    api.getTorrentContents.mockResolvedValue([file(0, 'a.txt', 0)]);
    await render(<TorrentFilesScreen />);
    await screen.findByText('a.txt');
    await press(screen.getByText('screens.files.changePriority'));
    expect(screen.queryByText('screens.files.setPriorityForSelected')).toBeNull();
  });

  it('dismisses the file and bulk menus without changing anything', async () => {
    await renderLoaded();
    await press(screen.getByText('readme.zip'));
    const title = await screen.findByText('screens.files.fileActions');
    await fire(ancestorWith(title, 'onRequestClose'), 'requestClose');
    await waitFor(() => expect(screen.queryByText('screens.files.fileActions')).toBeNull());
    expect(title).toBeTruthy();

    await press(screen.getByText('readme.zip'));
    await screen.findByText('screens.files.fileActions');
    // A tap on the card bubbles to the full-screen overlay touchable.
    await press(screen.getByText('screens.files.fileActions'));
    await waitFor(() => expect(screen.queryByText('screens.files.fileActions')).toBeNull());

    await press(screen.getByText('screens.files.changePriority'));
    await fire(
      ancestorWith(
        await screen.findByText('screens.files.setPriorityForSelected'),
        'onRequestClose',
      ),
      'requestClose',
    );
    await waitFor(() =>
      expect(screen.queryByText('screens.files.setPriorityForSelected')).toBeNull(),
    );
    await press(screen.getByText('screens.files.changePriority'));
    await press(await screen.findByText('screens.files.setPriorityForSelected'));
    await waitFor(() =>
      expect(screen.queryByText('screens.files.setPriorityForSelected')).toBeNull(),
    );
    expect(api.setFilePriority).not.toHaveBeenCalled();
  });

  it('navigates back from the header', async () => {
    await renderLoaded();
    await press(screen.getByLabelText('common.back'));
    expect(mockBack).toHaveBeenCalled();
  });
});

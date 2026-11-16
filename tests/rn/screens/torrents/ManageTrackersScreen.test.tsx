// ManageTrackersScreen.test.tsx — app/(tabs)/(torrents)/torrent/manage-trackers.tsx:
// loading the tracker list, add / edit / remove / copy, reannounce, and the
// error paths each of those reports through a toast.
import React from 'react';
import { render, waitFor, screen } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { press, type } from './helpers';
import ManageTrackersScreen from '@/app/(tabs)/(torrents)/torrent/manage-trackers';
import { torrentsApi } from '@/services/api/torrents';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => ({ hash: 'abc' }),
  useIsFocused: () => true,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number }) =>
      opts && typeof opts.count === 'number' ? `${key}:${opts.count}` : key,
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../components/theme-mock').mockColors, isDark: true }),
}));

let mockGlass = false;
jest.mock('@/context/LiquidGlassContext', () => ({
  useLiquidGlass: () => ({ enabled: mockGlass }),
}));

const mockShowToast = jest.fn();
jest.mock('@/context/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(true) }));

jest.mock('@/services/api/torrents', () => ({
  torrentsApi: {
    getTorrentTrackers: jest.fn(),
    removeTrackers: jest.fn(),
    addTrackers: jest.fn(),
    editTrackers: jest.fn(),
    reannounceTorrents: jest.fn(),
  },
}));

const api = torrentsApi as jest.Mocked<typeof torrentsApi>;

const tracker = (url: string, status: number, extra: Record<string, unknown> = {}) =>
  ({
    url,
    status,
    tier: 0,
    num_peers: 0,
    num_seeds: 3,
    num_leeches: 1,
    num_downloaded: 0,
    msg: '',
    ...extra,
  }) as never;

const TRACKERS = [
  tracker('** [DHT] **', 2),
  tracker('https://t1.example/announce', 2),
  tracker('https://t2.example/announce', 3, { num_seeds: -1, num_leeches: -1 }),
  tracker('https://t3.example/announce', 0, { msg: 'Timed out' }),
  tracker('https://t4.example/announce', 4),
];

describe('ManageTrackersScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGlass = false;
    api.getTorrentTrackers.mockResolvedValue(TRACKERS);
    api.removeTrackers.mockResolvedValue(undefined as never);
    api.addTrackers.mockResolvedValue(undefined as never);
    api.editTrackers.mockResolvedValue(undefined as never);
    api.reannounceTorrents.mockResolvedValue(undefined as never);
  });

  it('lists only real trackers with their status, counts and message', async () => {
    await render(<ManageTrackersScreen />);
    expect(await screen.findByText('https://t1.example/announce')).toBeTruthy();
    expect(api.getTorrentTrackers).toHaveBeenCalledWith('abc');
    expect(screen.queryByText('** [DHT] **')).toBeNull();
    expect(screen.getByText('screens.trackers.existingTrackers:4')).toBeTruthy();
    expect(screen.getAllByText('screens.trackers.working')).toHaveLength(1);
    expect(screen.getByText('screens.trackers.updating')).toBeTruthy();
    expect(screen.getByText('screens.trackers.disabled')).toBeTruthy();
    expect(screen.getByText('screens.trackers.notContacted')).toBeTruthy();
    expect(screen.getByText('Timed out')).toBeTruthy();
    // -1 counts render as a dash placeholder
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('renders the glass list variant when liquid glass is on', async () => {
    mockGlass = true;
    await render(<ManageTrackersScreen />);
    expect(await screen.findByText('https://t4.example/announce')).toBeTruthy();
  });

  it('shows the empty state when there are no trackers', async () => {
    api.getTorrentTrackers.mockResolvedValue([]);
    await render(<ManageTrackersScreen />);
    expect(await screen.findByText('screens.trackers.noTrackers')).toBeTruthy();
  });

  it('reports a load failure through a toast', async () => {
    api.getTorrentTrackers.mockRejectedValue(new Error('boom'));
    await render(<ManageTrackersScreen />);
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('boom', 'error'));
  });

  it('navigates back from the header', async () => {
    await render(<ManageTrackersScreen />);
    await press(screen.getByLabelText('common.back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('adds a trimmed tracker URL and refreshes the list', async () => {
    await render(<ManageTrackersScreen />);
    await press(await screen.findByText('Add New Tracker'));
    await type(
      await screen.findByPlaceholderText('https://tracker.example.com/announce'),
      '  https://new.example/announce  ',
    );
    await press(screen.getByText('Add'));
    await waitFor(() =>
      expect(api.addTrackers).toHaveBeenCalledWith('abc', ['https://new.example/announce']),
    );
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('screens.trackers.trackerAdded', 'success'),
    );
    expect(api.getTorrentTrackers).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Add New Tracker')).toBeTruthy();
  });

  it('rejects an empty tracker URL without calling the API', async () => {
    await render(<ManageTrackersScreen />);
    await press(await screen.findByText('Add New Tracker'));
    await press(screen.getByText('Add'));
    expect(mockShowToast).toHaveBeenCalledWith('screens.trackers.enterTrackerUrl', 'error');
    expect(api.addTrackers).not.toHaveBeenCalled();
  });

  it('reports an add failure and keeps the input open', async () => {
    api.addTrackers.mockRejectedValue(new Error('add failed'));
    await render(<ManageTrackersScreen />);
    await press(await screen.findByText('Add New Tracker'));
    await type(await screen.findByPlaceholderText('https://tracker.example.com/announce'), 'x');
    await press(screen.getByText('Add'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('add failed', 'error'));
    expect(screen.getByText('New Tracker URL')).toBeTruthy();
  });

  it('cancels the add input', async () => {
    await render(<ManageTrackersScreen />);
    await press(await screen.findByText('Add New Tracker'));
    await press(await screen.findByText('Cancel'));
    expect(screen.queryByText('New Tracker URL')).toBeNull();
  });

  it('edits a tracker URL', async () => {
    await render(<ManageTrackersScreen />);
    await screen.findByText('https://t1.example/announce');
    await press(screen.getAllByLabelText('common.edit')[0]);
    const input = await screen.findByDisplayValue('https://t1.example/announce');
    await type(input, ' https://t1b.example/announce ');
    await press(screen.getByText('Save'));
    await waitFor(() =>
      expect(api.editTrackers).toHaveBeenCalledWith(
        'abc',
        'https://t1.example/announce',
        'https://t1b.example/announce',
      ),
    );
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('screens.trackers.trackerUpdated', 'success'),
    );
    expect(screen.queryByText('Edit Tracker URL')).toBeNull();
  });

  it('rejects an emptied edit and reports an edit failure', async () => {
    api.editTrackers.mockRejectedValue(new Error('edit failed'));
    await render(<ManageTrackersScreen />);
    await screen.findByText('https://t1.example/announce');
    await press(screen.getAllByLabelText('common.edit')[0]);
    const input = await screen.findByDisplayValue('https://t1.example/announce');
    await type(input, '   ');
    await press(screen.getByText('Save'));
    expect(mockShowToast).toHaveBeenCalledWith('screens.trackers.enterTrackerUrl', 'error');
    await type(input, 'https://x');
    await press(screen.getByText('Save'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('edit failed', 'error'));
  });

  it('cancels an edit', async () => {
    await render(<ManageTrackersScreen />);
    await screen.findByText('https://t1.example/announce');
    await press(screen.getAllByLabelText('common.edit')[0]);
    expect(await screen.findByText('Edit Tracker URL')).toBeTruthy();
    await press(await screen.findByText('Cancel'));
    expect(screen.queryByText('Edit Tracker URL')).toBeNull();
  });

  it('copies a tracker URL to the clipboard', async () => {
    await render(<ManageTrackersScreen />);
    await screen.findByText('https://t1.example/announce');
    await press(screen.getAllByLabelText('screens.search.copyLink')[1]);
    await waitFor(() =>
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('https://t2.example/announce'),
    );
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('screens.trackers.urlCopied', 'success'),
    );
  });

  it('removes a tracker and reports a removal failure', async () => {
    await render(<ManageTrackersScreen />);
    await screen.findByText('https://t1.example/announce');
    await press(screen.getAllByLabelText('common.delete')[0]);
    await waitFor(() =>
      expect(api.removeTrackers).toHaveBeenCalledWith('abc', ['https://t1.example/announce']),
    );
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('screens.trackers.trackerRemoved', 'success'),
    );

    api.removeTrackers.mockRejectedValue(new Error('rm failed'));
    await press((await screen.findAllByLabelText('common.delete'))[0]);
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('rm failed', 'error'));
  });

  it('reannounces the torrent and reports a reannounce failure', async () => {
    await render(<ManageTrackersScreen />);
    await screen.findByText('https://t1.example/announce');
    await press(screen.getByLabelText('actions.reannounce'));
    await waitFor(() => expect(api.reannounceTorrents).toHaveBeenCalledWith(['abc']));
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('screens.trackers.reannounced', 'success'),
    );

    api.reannounceTorrents.mockRejectedValue(new Error('ra failed'));
    await press(screen.getByLabelText('actions.reannounce'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('ra failed', 'error'));
  });
});

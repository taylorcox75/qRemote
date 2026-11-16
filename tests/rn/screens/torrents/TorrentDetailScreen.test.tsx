// TorrentDetailScreen.test.tsx — app/(tabs)/(torrents)/torrent/[hash].tsx.
// Drives the detail screen's own handlers (it does not share useTorrentActions
// with the list): loading / not-found / reconnect states, pause-resume, delete,
// recheck, reannounce, magnet and path copy, speed and share limits, toggles,
// queue priority, category / tags, move, rename, peers and polling.
import React from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { render, waitFor, screen, act, fireEvent } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import TorrentDetail from '@/app/(tabs)/(torrents)/torrent/[hash]';
import { torrentsApi } from '@/services/api/torrents';
import { syncApi } from '@/services/api/sync';
import { tagsApi } from '@/services/api/tags';
import { categoriesApi } from '@/services/api/categories';
import { applicationApi } from '@/services/api/application';
import { press, type, fire, ancestorWith, findAllHost } from './helpers';

const mockRouter = {
  back: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  canGoBack: jest.fn(() => true),
};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ hash: 'h1' }),
  useNavigation: () => ({ setOptions: jest.fn() }),
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

const mockServerState = { isConnected: true, isLoading: false, isReconnecting: false };
jest.mock('@/context/ServerContext', () => ({
  useServer: () => mockServerState,
}));

let mockFeatures: Record<string, boolean> = { hasIsPrivate: true };
jest.mock('@/context/ApiVersionContext', () => ({
  useApiFeatures: () => ({ features: mockFeatures }),
}));

jest.mock('@/context/TorrentContext', () => ({
  useTorrents: () => ({ categories: { movies: {} }, tags: ['hd'] }),
}));

const mockShowToast = jest.fn();
jest.mock('@/context/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(true) }));

jest.mock('@/components/InputModal', () => require('./stubs'));
jest.mock('@/components/ConfirmModal', () => require('./stubs'));
jest.mock('@/components/OptionPicker', () => require('./stubs'));
jest.mock('@/components/CategoryModal', () => require('./stubs'));
jest.mock('@/components/TagsModal', () => require('./stubs'));
jest.mock('@/components/PieceMap', () => {
  const RN = require('react-native');
  return {
    PieceMap: (p: { states: number[] }) => <RN.Text>{`pieces:${p.states.join(',')}`}</RN.Text>,
  };
});
jest.mock('@/components/SkeletonLoader', () => {
  const RN = require('react-native');
  return { SkeletonTorrentDetail: () => <RN.View testID="skeleton-detail" /> };
});
jest.mock('@/components/SpeedGraph', () => ({
  ...jest.requireActual('@/components/SpeedGraph'),
  SpeedGraph: () => null,
}));

jest.mock('@/services/api/torrents', () => ({
  torrentsApi: {
    getTorrentList: jest.fn(),
    getTorrentProperties: jest.fn(),
    getTorrentTrackers: jest.fn(),
    getTorrentContents: jest.fn(),
    getTorrentPiecesStates: jest.fn(),
    pauseTorrents: jest.fn(),
    resumeTorrents: jest.fn(),
    deleteTorrents: jest.fn(),
    recheckTorrents: jest.fn(),
    reannounceTorrents: jest.fn(),
    setTorrentShareLimits: jest.fn(),
    setForceStart: jest.fn(),
    setSuperSeeding: jest.fn(),
    toggleSequentialDownload: jest.fn(),
    setFirstLastPiecePriority: jest.fn(),
    setAutomaticTorrentManagement: jest.fn(),
    increasePriority: jest.fn(),
    decreasePriority: jest.fn(),
    setMaximalPriority: jest.fn(),
    setMinimalPriority: jest.fn(),
    setTorrentDownloadLimit: jest.fn(),
    setTorrentUploadLimit: jest.fn(),
    setTorrentLocation: jest.fn(),
    setTorrentName: jest.fn(),
    setTorrentCategory: jest.fn(),
    addTorrentTags: jest.fn(),
    removeTorrentTags: jest.fn(),
  },
}));
jest.mock('@/services/api/sync', () => ({ syncApi: { getTorrentPeers: jest.fn() } }));
jest.mock('@/services/api/tags', () => ({
  tagsApi: { createTags: jest.fn(), deleteTags: jest.fn() },
}));
jest.mock('@/services/api/categories', () => ({
  categoriesApi: { addCategory: jest.fn(), removeCategories: jest.fn() },
}));
jest.mock('@/services/api/application', () => ({
  applicationApi: { getPreferences: jest.fn() },
}));

const api = torrentsApi as unknown as Record<string, jest.Mock>;
const LONG = { timeout: 4000 };

const baseTorrent = {
  hash: 'h1',
  name: 'Ubuntu ISO',
  state: 'downloading',
  progress: 0.5,
  dlspeed: 2048,
  upspeed: 1024,
  completed: 512,
  total_size: 1024,
  size: 1024,
  amount_left: 512,
  time_active: 90061,
  eta: 3700,
  ratio: 1.5,
  uploaded: 100,
  downloaded: 512,
  num_seeds: 3,
  num_complete: 10,
  num_leechs: 2,
  num_incomplete: 5,
  availability: 1.25,
  priority: 2,
  category: 'movies',
  tags: 'hd, x265',
  ratio_limit: -2,
  max_ratio: 2,
  seeding_time: 125,
  seeding_time_limit: 60,
  max_seeding_time: 60,
  inactive_seeding_time_limit: -2,
  share_limit_action: 'Default',
  share_limits_mode: 'Default',
  popularity: 0.5,
  auto_tmm: false,
  seq_dl: false,
  f_l_piece_prio: false,
  super_seeding: false,
  force_start: false,
  magnet_uri: 'magnet:?xt=urn:btih:h1',
  added_on: 1700000000,
  completion_on: 0,
  last_activity: 1700000500,
};

let currentTorrent: Record<string, unknown> | null;

const properties = {
  save_path: '/downloads/complete',
  download_path: '/downloads/incomplete',
  dl_limit: 10240,
  up_limit: 0,
  pieces_have: 2,
  pieces_num: 4,
  private: false,
};

const TRACKERS = [
  { url: '** [DHT] **', status: 2 },
  { url: '** [PeX] **', status: 4 },
  { url: '** [LSD] **', status: 0 },
  ...Array.from({ length: 13 }, (_, i) => ({ url: `https://t${i}.example/a`, status: i % 5 })),
];

function setupApis() {
  api.getTorrentList.mockImplementation(async () => (currentTorrent ? [currentTorrent] : []));
  api.getTorrentProperties.mockResolvedValue(properties);
  api.getTorrentTrackers.mockResolvedValue(TRACKERS);
  api.getTorrentContents.mockResolvedValue([{ index: 0 }, { index: 1 }]);
  api.getTorrentPiecesStates.mockResolvedValue({ 1: 2, 0: 1, x: 0 });
  for (const key of Object.keys(api)) {
    if (!api[key].getMockImplementation()) api[key].mockResolvedValue(undefined);
  }
  (applicationApi.getPreferences as jest.Mock).mockResolvedValue({ encryption: 1 });
  (syncApi.getTorrentPeers as jest.Mock).mockResolvedValue({
    peers: {
      '1.1.1.1:1': { progress: 0.2, client: 'qBittorrent' },
      '2.2.2.2:2': { progress: 0.9 },
      '3.3.3.3:3': {},
    },
  });
  (tagsApi.createTags as jest.Mock).mockResolvedValue(undefined);
  (tagsApi.deleteTags as jest.Mock).mockResolvedValue(undefined);
  (categoriesApi.addCategory as jest.Mock).mockResolvedValue(undefined);
  (categoriesApi.removeCategories as jest.Mock).mockResolvedValue(undefined);
}

async function renderLoaded() {
  await render(<TorrentDetail />);
  await screen.findAllByText('Ubuntu ISO');
}

/** The Switch in the same settings row as `label`. */
const switchFor = (label: string) =>
  findAllHost(screen.getByText(label).parent!, (n) => n.props.accessibilityRole === 'switch')[0];

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

// This suite renders the full detail screen many times; under coverage
// instrumentation on a CI runner single tests (the fake-timer polling ones)
// can pass 5s, so give it room instead of failing on runner speed.
jest.setTimeout(20000);

describe('TorrentDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(api)) api[key].mockReset();
    mockDark = false;
    mockFeatures = { hasIsPrivate: true };
    mockServerState.isConnected = true;
    mockServerState.isLoading = false;
    mockServerState.isReconnecting = false;
    mockRouter.canGoBack.mockReturnValue(true);
    currentTorrent = { ...baseTorrent };
    setupApis();
  });

  describe('states', () => {
    it('shows a spinner while the first connection is loading', async () => {
      mockServerState.isConnected = false;
      mockServerState.isLoading = true;
      await render(<TorrentDetail />);
      expect(screen.queryByText('torrentDetail.notConnected')).toBeNull();
      expect(api.getTorrentList).not.toHaveBeenCalled();
    });

    it('shows a not-connected message', async () => {
      mockServerState.isConnected = false;
      await render(<TorrentDetail />);
      expect(screen.getByText('torrentDetail.notConnected')).toBeTruthy();
    });

    it('shows the skeleton while loading, then the torrent', async () => {
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      api.getTorrentList.mockImplementationOnce(async () => {
        await gate;
        return [currentTorrent];
      });
      await render(<TorrentDetail />);
      expect(screen.getByTestId('skeleton-detail')).toBeTruthy();
      await act(async () => release());
      expect((await screen.findAllByText('Ubuntu ISO')).length).toBeGreaterThan(0);
      expect(api.getTorrentList).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        ['h1'],
      );
      expect(api.getTorrentProperties).toHaveBeenCalledWith('h1');
    });

    it('shows "not found" after an ordinary load failure and toasts the error', async () => {
      api.getTorrentList.mockRejectedValue(new Error('Server exploded'));
      await render(<TorrentDetail />);
      expect(await screen.findByText('torrentDetail.notFound')).toBeTruthy();
      expect(mockShowToast).toHaveBeenCalledWith('Server exploded', 'error');
    });

    it('keeps the skeleton (no toast) on a dead session and reloads once reconnect finishes', async () => {
      api.getTorrentList.mockRejectedValueOnce(new Error('Authentication failed'));
      mockServerState.isReconnecting = true;
      const view = await render(<TorrentDetail />);
      await waitFor(() => expect(api.getTorrentList).toHaveBeenCalledTimes(1));
      expect(screen.getByTestId('skeleton-detail')).toBeTruthy();
      expect(mockShowToast).not.toHaveBeenCalled();

      mockServerState.isReconnecting = false;
      await view.rerender(<TorrentDetail />);
      expect((await screen.findAllByText('Ubuntu ISO')).length).toBeGreaterThan(0);
      expect(api.getTorrentList).toHaveBeenCalledTimes(2);
    });

    it('leaves the screen when the torrent list comes back empty', async () => {
      currentTorrent = null;
      await render(<TorrentDetail />);
      await waitFor(() =>
        expect(mockShowToast).toHaveBeenCalledWith('torrentDetail.torrentRemoved', 'error'),
      );
      expect(mockRouter.back).toHaveBeenCalledTimes(1);
    });

    it('replaces to the list on a 404 when there is nothing to go back to', async () => {
      mockRouter.canGoBack.mockReturnValue(false);
      api.getTorrentProperties.mockRejectedValue(httpError(404));
      await render(<TorrentDetail />);
      await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
      expect(mockRouter.back).not.toHaveBeenCalled();
    });
  });

  describe('rendering', () => {
    it('renders the hero stats, sections and derived values', async () => {
      await renderLoaded();
      expect(screen.getByText('states.dlAndUl')).toBeTruthy();
      expect(screen.getByText('2.00 KB/s')).toBeTruthy();
      expect(screen.getByText('1.50')).toBeTruthy();
      expect(screen.getByText('3 / 10')).toBeTruthy();
      expect(screen.getByText('2 / 5')).toBeTruthy();
      expect(screen.getByText('1h 1m')).toBeTruthy(); // eta
      expect(screen.getByText('#2')).toBeTruthy();
      expect(screen.getByText('movies')).toBeTruthy();
      expect(screen.getByText('hd')).toBeTruthy();
      expect(screen.getByText('x265')).toBeTruthy();
      expect(screen.getByText('/downloads/complete')).toBeTruthy();
      expect(screen.getByText('/downloads/incomplete')).toBeTruthy();
      expect(screen.getByText('10.00 KB/s')).toBeTruthy(); // dl limit
      expect(screen.getByText('torrentDetail.globalLimit:{"value":"2.00"}')).toBeTruthy();
      expect(screen.getByText('1h 0m')).toBeTruthy(); // seeding time limit 60 min
      expect(screen.getByText('2m 5s')).toBeTruthy(); // seeding time 125s
      expect(screen.getByText('+1')).toBeTruthy(); // 13 trackers, 12 dots shown
      expect(screen.getByText('pieces:1,2')).toBeTruthy();
      expect(screen.getByText(/torrentDetail\.pieceMap/)).toBeTruthy();
      expect(screen.getByText('torrentDetail.channelWorking')).toBeTruthy();
      expect(screen.getByText('torrentDetail.channelNotWorking')).toBeTruthy();
      expect(screen.getByText('torrentDetail.channelDisabled')).toBeTruthy();
      expect(screen.getByText('torrentDetail.privateNo')).toBeTruthy();
      expect(await screen.findByText('torrentDetail.encryptionForceOn')).toBeTruthy();
      expect(screen.getByText('torrentDetail.filesCount:{"count":2}')).toBeTruthy();
      expect(screen.getByText('torrentDetail.trackersCount:{"count":13}')).toBeTruthy();
    });

    it.each([
      [0, 'torrentDetail.encryptionPrefer'],
      [2, 'torrentDetail.encryptionForceOff'],
      [undefined, 'torrentDetail.channelUnknown'],
    ])('labels encryption mode %s', async (mode, label) => {
      (applicationApi.getPreferences as jest.Mock).mockResolvedValue({ encryption: mode });
      await renderLoaded();
      await waitFor(() => expect(screen.getAllByText(label).length).toBeGreaterThan(0));
    });

    it('derives private status from the discovery channels on servers without the field', async () => {
      mockFeatures = { hasIsPrivate: false };
      api.getTorrentTrackers.mockResolvedValue([
        { url: '** [DHT] **', status: 0 },
        { url: '** [PeX] **', status: 0 },
        { url: '** [LSD] **', status: 0 },
      ]);
      (applicationApi.getPreferences as jest.Mock).mockRejectedValue(new Error('x'));
      await renderLoaded();
      expect(screen.getByText('torrentDetail.privateYes')).toBeTruthy();
    });

    it('shows unknown channel and private states with no pseudo-trackers', async () => {
      mockFeatures = { hasIsPrivate: false };
      api.getTorrentTrackers.mockResolvedValue([]);
      api.getTorrentPiecesStates.mockRejectedValue(new Error('no pieces'));
      currentTorrent = {
        ...baseTorrent,
        state: 'pausedUP',
        progress: 1,
        ratio_limit: 1.25,
        seeding_time_limit: -1,
        priority: 0,
        category: '',
        tags: '',
        ratio: undefined,
        availability: 0,
        amount_left: 0,
        time_active: 0,
        popularity: undefined,
        seeding_time: 42,
        dlspeed: undefined,
        upspeed: undefined,
      };
      api.getTorrentProperties.mockResolvedValue({ ...properties, download_path: '', dl_limit: 0 });
      mockDark = true;
      await renderLoaded();
      expect(screen.getAllByText('torrentDetail.channelUnknown').length).toBeGreaterThanOrEqual(4);
      expect(screen.getByText('torrentDetail.notQueued')).toBeTruthy();
      expect(screen.getByText('42s')).toBeTruthy();
      expect(screen.getByText('1.25')).toBeTruthy();
      expect(screen.getByText('0.00')).toBeTruthy();
      expect(screen.getAllByText('common.none').length).toBe(2);
      expect(screen.queryByText('torrentDetail.trackerHealth')).toBeNull();
      expect(screen.queryByText('/downloads/incomplete')).toBeNull();
      expect(screen.getByLabelText('torrentDetail.resume')).toBeTruthy();
    });
  });

  describe('header actions', () => {
    it('navigates back', async () => {
      await renderLoaded();
      await press(screen.getByLabelText('common.back'));
      expect(mockRouter.back).toHaveBeenCalled();
    });

    it('copies the magnet link, or reports when there is none', async () => {
      await renderLoaded();
      await press(screen.getByLabelText('torrentDetail.copyMagnet'));
      await waitFor(() =>
        expect(Clipboard.setStringAsync).toHaveBeenCalledWith('magnet:?xt=urn:btih:h1'),
      );
      expect(mockShowToast).toHaveBeenCalledWith('toast.magnetCopied', 'success');

      (Clipboard.setStringAsync as jest.Mock).mockRejectedValueOnce(new Error('clip failed'));
      await press(screen.getByLabelText('torrentDetail.copyMagnet'));
      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('clip failed', 'error'));
    });

    it('reports a missing magnet link', async () => {
      currentTorrent = { ...baseTorrent, magnet_uri: '' };
      await renderLoaded();
      await press(screen.getByLabelText('torrentDetail.copyMagnet'));
      expect(mockShowToast).toHaveBeenCalledWith('toast.noMagnetAvailable', 'error');
    });

    it('reannounces from the header and reports a failure', async () => {
      await renderLoaded();
      await press(screen.getByLabelText('torrentDetail.reannounce'));
      await waitFor(() => expect(api.reannounceTorrents).toHaveBeenCalledWith(['h1']));
      await waitFor(
        () => expect(mockShowToast).toHaveBeenCalledWith('toast.reannounceSent', 'success'),
        LONG,
      );

      api.reannounceTorrents.mockRejectedValueOnce(new Error('ra failed'));
      await press(screen.getByLabelText('actions.reannounce'));
      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('ra failed', 'error'));
    });
  });

  describe('pause / resume', () => {
    it('pauses a running torrent and polls until the server reports it paused', async () => {
      api.pauseTorrents.mockImplementation(async () => {
        currentTorrent = { ...baseTorrent, state: 'stoppedDL' };
      });
      await renderLoaded();
      // Not awaited: the handler keeps polling until the server agrees.
      const pending = fireEvent.press(screen.getByLabelText('torrentDetail.pause'));
      // Optimistic label while the request is in flight
      await waitFor(() => expect(screen.getByText('torrentDetail.paused')).toBeTruthy());
      expect(api.pauseTorrents).toHaveBeenCalledWith(['h1']);
      await act(async () => {
        await pending;
      });
      expect(screen.getByLabelText('torrentDetail.resume')).toBeTruthy();
      expect(screen.queryByText('torrentDetail.paused')).toBeNull();
      // One reload was enough: the server reported the new state straight away.
      expect(api.getTorrentList).toHaveBeenCalledTimes(2);
    });

    it('resumes a paused, completed torrent', async () => {
      currentTorrent = { ...baseTorrent, state: 'pausedUP', progress: 1 };
      api.resumeTorrents.mockImplementation(async () => {
        currentTorrent = { ...baseTorrent, state: 'uploading', progress: 1 };
      });
      await renderLoaded();
      const pending = fireEvent.press(screen.getByLabelText('torrentDetail.resume'));
      await waitFor(() => expect(screen.getByText('torrentDetail.seeding')).toBeTruthy());
      expect(api.resumeTorrents).toHaveBeenCalledWith(['h1']);
      await act(async () => {
        await pending;
      });
      expect(screen.getByLabelText('torrentDetail.pause')).toBeTruthy();
    });

    it('reports a pause failure and drops the optimistic state', async () => {
      currentTorrent = { ...baseTorrent, state: 'uploading', progress: 1 };
      api.pauseTorrents.mockRejectedValue(new Error('pause failed'));
      await renderLoaded();
      await press(screen.getByLabelText('torrentDetail.pause'));
      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('pause failed', 'error'));
      expect(screen.getByLabelText('torrentDetail.pause')).toBeTruthy();
    });

    it('shows optimistic "downloading" when resuming an incomplete torrent', async () => {
      currentTorrent = { ...baseTorrent, state: 'stoppedDL' };
      let release!: () => void;
      api.resumeTorrents.mockImplementation(() => new Promise<void>((r) => (release = r)));
      await renderLoaded();
      const pending = fireEvent.press(screen.getByLabelText('torrentDetail.resume'));
      await waitFor(() => expect(screen.getByText('torrentDetail.downloading')).toBeTruthy());
      // The server never reports the new state: the handler gives up after its retries.
      currentTorrent = { ...baseTorrent, state: 'stoppedDL' };
      await act(async () => {
        release();
        await pending;
      });
      // initial load + 6 retries (a 2s poll tick may add one more)
      expect(api.getTorrentList.mock.calls.length).toBeGreaterThanOrEqual(7);
      expect(screen.queryByText('torrentDetail.downloading')).toBeNull();
    });

    it('shows optimistic "completed" when stopping a finished torrent', async () => {
      currentTorrent = { ...baseTorrent, state: 'uploading', progress: 1 };
      let release!: () => void;
      api.pauseTorrents.mockImplementation(() => new Promise<void>((r) => (release = r)));
      await renderLoaded();
      const pending = fireEvent.press(screen.getByLabelText('torrentDetail.pause'));
      await waitFor(() =>
        expect(screen.getAllByText('torrentDetail.completed').length).toBeGreaterThan(1),
      );
      currentTorrent = { ...baseTorrent, state: 'stoppedUP', progress: 1 };
      await act(async () => {
        release();
        await pending;
      });
    });
  });

  describe('delete', () => {
    it('deletes the torrent only and goes back', async () => {
      await renderLoaded();
      await press(screen.getByText('common.delete'));
      expect(screen.getByTestId('confirm-modal-message').props.children).toBe(
        'alerts.deleteName:{"name":"Ubuntu ISO"}',
      );
      await press(screen.getByTestId('confirm-alerts.torrentOnly'));
      await waitFor(() => expect(api.deleteTorrents).toHaveBeenCalledWith(['h1'], false));
      await waitFor(() =>
        expect(mockShowToast).toHaveBeenCalledWith('toast.torrentDeleted', 'success'),
      );
      expect(mockRouter.back).toHaveBeenCalledTimes(1);
    });

    it('deletes with files and replaces when there is no back stack', async () => {
      mockRouter.canGoBack.mockReturnValue(false);
      await renderLoaded();
      await press(screen.getByText('common.delete'));
      await press(screen.getByTestId('confirm-alerts.withFiles'));
      await waitFor(() => expect(api.deleteTorrents).toHaveBeenCalledWith(['h1'], true));
      await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
    });

    it('reports a delete failure and stays on the screen', async () => {
      api.deleteTorrents.mockRejectedValue(new Error('delete failed'));
      await renderLoaded();
      await press(screen.getByText('common.delete'));
      await press(screen.getByTestId('confirm-alerts.torrentOnly'));
      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('delete failed', 'error'));
      expect(mockRouter.back).not.toHaveBeenCalled();
    });

    it('cancels the delete confirm', async () => {
      await renderLoaded();
      await press(screen.getByText('common.delete'));
      await press(screen.getByTestId('confirm-cancel'));
      expect(screen.queryByTestId('confirm-modal')).toBeNull();
      expect(api.deleteTorrents).not.toHaveBeenCalled();
    });
  });

  describe('actions', () => {
    it('rechecks the torrent and reports a failure', async () => {
      await renderLoaded();
      await press(screen.getByText('torrentDetail.recheck'));
      await waitFor(() => expect(api.recheckTorrents).toHaveBeenCalledWith(['h1']));
      await waitFor(() => expect(api.getTorrentList).toHaveBeenCalledTimes(2), LONG);

      api.recheckTorrents.mockRejectedValueOnce(new Error('recheck failed'));
      await press(screen.getByText('torrentDetail.recheck'));
      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('recheck failed', 'error'));
    });

    it('opens the files and trackers screens', async () => {
      await renderLoaded();
      await press(screen.getByText('torrentDetail.files'));
      expect(mockRouter.push).toHaveBeenCalledWith('/torrent/files?hash=h1');
      await press(screen.getByText('torrentDetail.trackers'));
      expect(mockRouter.push).toHaveBeenCalledWith('/torrent/manage-trackers?hash=h1');
      await press(screen.getByText('torrentDetail.trackerHealth'));
      expect(mockRouter.push).toHaveBeenCalledTimes(3);
    });

    it('lists connected peers sorted by progress, then closes', async () => {
      await renderLoaded();
      await press(screen.getByText('torrentDetail.seeds'));
      expect(syncApi.getTorrentPeers).toHaveBeenCalledWith('h1', 0);
      expect(await screen.findByText('2.2.2.2:2')).toBeTruthy();
      expect(screen.getByText('qBittorrent')).toBeTruthy();
      const ips = screen.getAllByText(/^\d\.\d\.\d\.\d:\d$/).map((n) => n.props.children);
      expect(ips).toEqual(['2.2.2.2:2', '1.1.1.1:1', '3.3.3.3:3']);
      await press(screen.getAllByLabelText('common.close')[0]);
      await waitFor(() => expect(screen.queryByText('2.2.2.2:2')).toBeNull());
    });

    it('shows an empty peers list and closes it via the modal', async () => {
      (syncApi.getTorrentPeers as jest.Mock).mockResolvedValue({});
      await renderLoaded();
      await press(screen.getByText('torrentDetail.peers'));
      const empty = await screen.findByText('torrentDetail.noConnectedPeers');
      await fire(ancestorWith(empty, 'onRequestClose'), 'requestClose');
      await waitFor(() => expect(screen.queryByText('torrentDetail.noConnectedPeers')).toBeNull());
    });

    it('reports a peers failure and closes the modal', async () => {
      (syncApi.getTorrentPeers as jest.Mock).mockRejectedValue(new Error('peers failed'));
      await renderLoaded();
      await press(screen.getByText('torrentDetail.seeds'));
      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('peers failed', 'error'));
      expect(screen.queryByText('torrentDetail.connectedPeers')).toBeNull();
    });

    it.each([
      [
        'torrentDetail.autoManagement',
        'setAutomaticTorrentManagement',
        [['h1'], true],
        'toast.autoManagementToggled',
      ],
      [
        'torrentDetail.sequentialDownload',
        'toggleSequentialDownload',
        [['h1']],
        'toast.sequentialToggled',
      ],
      [
        'torrentDetail.firstLastPiecePriority',
        'setFirstLastPiecePriority',
        [['h1']],
        'torrentDetail.firstLastPieceToggled',
      ],
      [
        'torrentDetail.superSeeding',
        'setSuperSeeding',
        [['h1'], true],
        'toast.superSeedingToggled',
      ],
      ['torrentDetail.forceStart', 'setForceStart', [['h1'], true], 'toast.forceStartToggled'],
    ])('toggles "%s"', async (label, method, args, toastKey) => {
      await renderLoaded();
      const toggle = switchFor(label);
      await fire(toggle, 'change', { nativeEvent: { value: true } });
      expect(api[method]).toHaveBeenCalledWith(...args);
      await waitFor(
        () =>
          expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining(toastKey), 'success'),
        LONG,
      );

      api[method].mockRejectedValueOnce(new Error(`${method} failed`));
      await fire(toggle, 'change', { nativeEvent: { value: false } });
      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith(`${method} failed`, 'error'));
    });

    it('toggles off settings that are currently on', async () => {
      currentTorrent = { ...baseTorrent, auto_tmm: true, super_seeding: true, force_start: true };
      await renderLoaded();
      const labels = [
        'torrentDetail.autoManagement',
        'torrentDetail.superSeeding',
        'torrentDetail.forceStart',
      ];
      for (const [i, label] of labels.entries()) {
        await fire(switchFor(label), 'change', { nativeEvent: { value: false } });
        // Each toggle finishes (and toasts "disabled") before the next one starts.
        await waitFor(() => expect(mockShowToast).toHaveBeenCalledTimes(i + 1), LONG);
        expect(mockShowToast.mock.calls[i][0]).toContain('common.disabled');
      }
      expect(api.setForceStart).toHaveBeenCalledWith(['h1'], false);
      expect(api.setAutomaticTorrentManagement).toHaveBeenCalledWith(['h1'], false);
      expect(api.setSuperSeeding).toHaveBeenCalledWith(['h1'], false);
    });

    it.each([
      ['max', 'setMaximalPriority', 'toast.prioritySetMax'],
      ['increase', 'increasePriority', null],
      ['decrease', 'decreasePriority', null],
      ['min', 'setMinimalPriority', 'toast.prioritySetMin'],
    ])('changes queue priority: %s', async (value, method, toastKey) => {
      await renderLoaded();
      await press(screen.getByText('torrentDetail.priority'));
      await press(screen.getByTestId(`option-${value}`));
      expect(api[method]).toHaveBeenCalledWith(['h1']);
      await waitFor(() => expect(api.getTorrentList).toHaveBeenCalledTimes(2), LONG);
      if (toastKey) expect(mockShowToast).toHaveBeenCalledWith(toastKey, 'success');

      api[method].mockRejectedValueOnce(new Error('prio failed'));
      await press(screen.getByText('torrentDetail.priority'));
      await press(screen.getByTestId(`option-${value}`));
      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('prio failed', 'error'));
    });

    it('closes the priority picker without changing anything', async () => {
      await renderLoaded();
      await press(screen.getByText('torrentDetail.priority'));
      await press(screen.getByTestId('picker-close'));
      expect(screen.queryByTestId('option-max')).toBeNull();
    });
  });

  describe('limits', () => {
    it('sets a download limit in KiB/s', async () => {
      await renderLoaded();
      await press(screen.getByText('torrentDetail.dlLimit'));
      const field = screen.getByTestId('input-modal-field');
      expect(field.props.value).toBe('10');
      await type(field, 'abc');
      expect(screen.getByTestId('input-modal-error').props.children).toBe('errors.validNumber');
      await press(screen.getByTestId('input-modal-confirm'));
      expect(mockShowToast).toHaveBeenCalledWith('errors.validNumber', 'error');
      await type(field, '100');
      expect(screen.getByTestId('input-modal-hint').props.children).toBe('100.00 KB/s');
      await press(screen.getByTestId('input-modal-confirm'));
      expect(api.setTorrentDownloadLimit).toHaveBeenCalledWith(['h1'], 102400);
      await waitFor(
        () =>
          expect(mockShowToast).toHaveBeenCalledWith(
            'torrentDetail.dlLimitSet:{"value":"100.00 KB/s"}',
            'success',
          ),
        LONG,
      );
    });

    it('clears an upload limit to unlimited and reports a failure', async () => {
      await renderLoaded();
      await press(screen.getByText('torrentDetail.ulLimit'));
      const field = screen.getByTestId('input-modal-field');
      expect(field.props.value).toBe('0');
      await type(field, 'x');
      await press(screen.getByTestId('input-modal-confirm'));
      expect(mockShowToast).toHaveBeenCalledWith('errors.validNumber', 'error');
      await type(field, '0');
      await press(screen.getByTestId('input-modal-confirm'));
      expect(api.setTorrentUploadLimit).toHaveBeenCalledWith(['h1'], 0);
      await waitFor(
        () =>
          expect(mockShowToast).toHaveBeenCalledWith(
            'torrentDetail.ulLimitSet:{"value":"common.unlimited"}',
            'success',
          ),
        LONG,
      );

      api.setTorrentUploadLimit.mockRejectedValueOnce(new Error('ul failed'));
      await press(screen.getByText('torrentDetail.ulLimit'));
      await type(screen.getByTestId('input-modal-field'), '50');
      expect(screen.getByTestId('input-modal-hint')).toBeTruthy();
      await press(screen.getByTestId('input-modal-confirm'));
      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('ul failed', 'error'));
    });

    it('reports a download limit failure, using the existing up limit as default', async () => {
      api.getTorrentProperties.mockResolvedValue({ ...properties, dl_limit: 0, up_limit: 2048 });
      api.setTorrentDownloadLimit.mockRejectedValue(new Error('dl failed'));
      await renderLoaded();
      await press(screen.getByText('torrentDetail.ulLimit'));
      expect(screen.getByTestId('input-modal-field').props.value).toBe('2');
      await press(screen.getByTestId('input-modal-cancel'));
      await press(screen.getByText('torrentDetail.dlLimit'));
      expect(screen.getByTestId('input-modal-field').props.value).toBe('0');
      await press(screen.getByTestId('input-modal-confirm'));
      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('dl failed', 'error'));
    });

    it('sets a ratio limit while echoing the other share-limit fields back', async () => {
      await renderLoaded();
      await press(screen.getByText('torrentDetail.maxRatio'));
      const field = screen.getByTestId('input-modal-field');
      expect(field.props.value).toBe('-2');
      await type(field, 'nope');
      expect(screen.getByTestId('input-modal-error')).toBeTruthy();
      await press(screen.getByTestId('input-modal-confirm'));
      expect(mockShowToast).toHaveBeenCalledWith('errors.validNumber', 'error');
      await type(field, '3');
      await press(screen.getByTestId('input-modal-confirm'));
      expect(api.setTorrentShareLimits).toHaveBeenCalledWith(['h1'], {
        ratioLimit: 3,
        seedingTimeLimit: 60,
        inactiveSeedingTimeLimit: -2,
        shareLimitAction: 'Default',
        shareLimitsMode: 'Default',
      });
      await waitFor(
        () =>
          expect(mockShowToast).toHaveBeenCalledWith(
            'torrentDetail.ratioLimitSet:{"value":"3.00"}',
            'success',
          ),
        LONG,
      );
    });

    it.each([
      ['-1', 'common.unlimited'],
      ['-2', 'torrentDetail.useGlobal'],
    ])('describes ratio preset %s', async (preset, label) => {
      await renderLoaded();
      await press(screen.getByText('torrentDetail.maxRatio'));
      await press(screen.getByTestId(`input-preset-${preset}`));
      await press(screen.getByTestId('input-modal-confirm'));
      await waitFor(
        () =>
          expect(mockShowToast).toHaveBeenCalledWith(
            `torrentDetail.ratioLimitSet:{"value":"${label}"}`,
            'success',
          ),
        LONG,
      );
    });

    it('reports a ratio limit failure, defaulting missing fields to "global"', async () => {
      currentTorrent = { ...baseTorrent, ratio_limit: undefined, seeding_time_limit: undefined };
      api.setTorrentShareLimits.mockRejectedValue(new Error('share failed'));
      await renderLoaded();
      await press(screen.getByText('torrentDetail.maxRatio'));
      expect(screen.getByTestId('input-modal-field').props.value).toBe('');
      await type(screen.getByTestId('input-modal-field'), '1');
      await press(screen.getByTestId('input-modal-confirm'));
      expect(api.setTorrentShareLimits).toHaveBeenCalledWith(
        ['h1'],
        expect.objectContaining({ ratioLimit: 1, seedingTimeLimit: -2 }),
      );
      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('share failed', 'error'));

      await press(screen.getByText('torrentDetail.maxSeedingTime'));
      expect(screen.getByTestId('input-modal-field').props.value).toBe('');
      await type(screen.getByTestId('input-modal-field'), '5');
      await press(screen.getByTestId('input-modal-confirm'));
      expect(api.setTorrentShareLimits).toHaveBeenLastCalledWith(
        ['h1'],
        expect.objectContaining({ ratioLimit: -2, seedingTimeLimit: 5 }),
      );
    });

    it.each([
      ['90', '1h 30m'],
      ['-1', 'common.unlimited'],
      ['-2', 'torrentDetail.useGlobal'],
    ])('sets seeding time limit %s', async (value, label) => {
      await renderLoaded();
      await press(screen.getByText('torrentDetail.maxSeedingTime'));
      const field = screen.getByTestId('input-modal-field');
      expect(field.props.value).toBe('60');
      await type(field, '1.5');
      expect(screen.getByTestId('input-modal-error')).toBeTruthy();
      await press(screen.getByTestId('input-modal-confirm'));
      expect(mockShowToast).toHaveBeenCalledWith('errors.validNumber', 'error');
      await type(field, value);
      await press(screen.getByTestId('input-modal-confirm'));
      expect(api.setTorrentShareLimits).toHaveBeenCalledWith(
        ['h1'],
        expect.objectContaining({ ratioLimit: -2, seedingTimeLimit: Number(value) }),
      );
      await waitFor(
        () =>
          expect(mockShowToast).toHaveBeenCalledWith(
            `torrentDetail.seedingTimeLimitSet:{"value":"${label}"}`,
            'success',
          ),
        LONG,
      );
    });
  });

  describe('general section', () => {
    it('moves the torrent to a new save path, ignoring an empty path', async () => {
      await renderLoaded();
      await press(screen.getByLabelText('common.edit'));
      expect(screen.getByTestId('input-modal-field').props.value).toBe('/downloads/complete');
      await type(screen.getByTestId('input-modal-field'), '');
      await press(screen.getByTestId('input-modal-confirm'));
      expect(api.setTorrentLocation).not.toHaveBeenCalled();

      await press(screen.getByLabelText('common.edit'));
      await type(screen.getByTestId('input-modal-field'), '/new');
      await press(screen.getByTestId('input-modal-confirm'));
      expect(api.setTorrentLocation).toHaveBeenCalledWith(['h1'], '/new');
      await waitFor(
        () => expect(mockShowToast).toHaveBeenCalledWith('toast.locationUpdated', 'success'),
        LONG,
      );

      api.setTorrentLocation.mockRejectedValueOnce(new Error('move failed'));
      await press(screen.getByLabelText('common.edit'));
      await press(screen.getByTestId('input-modal-confirm'));
      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('move failed', 'error'));
    });

    it('shows the full save path and download path in a popover and copies it', async () => {
      await renderLoaded();
      await press(screen.getAllByLabelText('common.moreInfo')[0]);
      // popover shows the row title and the value
      expect(screen.getAllByText('torrentDetail.savePath').length).toBe(2);
      const copy = screen.getByText('common.copy');
      await fire(ancestorWith(copy, 'onLayout'), 'layout', {
        nativeEvent: { layout: { height: 120 } },
      });
      await press(copy);
      await waitFor(() =>
        expect(Clipboard.setStringAsync).toHaveBeenCalledWith('/downloads/complete'),
      );
      expect(mockShowToast).toHaveBeenCalledWith('toast.pathCopied', 'success');
      await press(screen.getAllByLabelText('common.close')[0]);
      await waitFor(() => expect(screen.getAllByText('torrentDetail.savePath').length).toBe(1));

      await fire(screen.getByText('/downloads/incomplete'), 'press', {
        nativeEvent: { pageX: 5000, pageY: 5000 },
      });
      expect(screen.getAllByText('torrentDetail.downloadPath').length).toBe(2);
      (Clipboard.setStringAsync as jest.Mock).mockRejectedValueOnce(new Error('copy failed'));
      await press(screen.getByText('common.copy'));
      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('copy failed', 'error'));
      await fire(ancestorWith(screen.getByText('common.copy'), 'onRequestClose'), 'requestClose');
      await waitFor(() => expect(screen.queryByText('common.copy')).toBeNull());
    });

    it('closes the path popover by tapping the backdrop', async () => {
      await renderLoaded();
      await fire(screen.getAllByLabelText('common.moreInfo')[0], 'press', {
        nativeEvent: { pageX: 0, pageY: 0 },
      });
      // A tap inside the card bubbles to the full-screen backdrop touchable.
      await press(screen.getAllByText('torrentDetail.savePath')[1]);
      await waitFor(() => expect(screen.queryByText('common.copy')).toBeNull());
    });

    it('sets, clears, creates and deletes categories', async () => {
      await renderLoaded();
      await press(screen.getByText('torrentDetail.category'));
      expect(screen.getByText('category:movies')).toBeTruthy();
      await press(screen.getByTestId('category-select'));
      expect(api.setTorrentCategory).toHaveBeenCalledWith(['h1'], 'movies');
      await waitFor(
        () =>
          expect(mockShowToast).toHaveBeenCalledWith(
            'toast.categorySet:{"value":"movies"}',
            'success',
          ),
        LONG,
      );

      await press(screen.getByText('torrentDetail.category'));
      await press(screen.getByTestId('category-select-none'));
      await waitFor(
        () =>
          expect(mockShowToast).toHaveBeenCalledWith(
            'toast.categorySet:{"value":"common.none"}',
            'success',
          ),
        LONG,
      );

      await press(screen.getByText('torrentDetail.category'));
      await press(screen.getByTestId('category-create'));
      expect(categoriesApi.addCategory).toHaveBeenCalledWith('fresh', '');
      await waitFor(
        () =>
          expect(mockShowToast).toHaveBeenCalledWith(
            'toast.categorySet:{"value":"fresh"}',
            'success',
          ),
        LONG,
      );
      expect(api.setTorrentCategory).toHaveBeenLastCalledWith(['h1'], 'fresh');

      await press(screen.getByText('torrentDetail.category'));
      await press(screen.getByTestId('category-delete'));
      expect(categoriesApi.removeCategories).toHaveBeenCalledWith(['movies']);
      await waitFor(() =>
        expect(mockShowToast).toHaveBeenCalledWith(
          'toast.categoryDeleted:{"name":"movies"}',
          'success',
        ),
      );
      await press(screen.getByTestId('category-close'));
      expect(screen.queryByTestId('category-modal')).toBeNull();
    });

    it('reports category failures', async () => {
      api.setTorrentCategory.mockRejectedValue(new Error('cat failed'));
      (categoriesApi.addCategory as jest.Mock).mockRejectedValue(new Error('add cat failed'));
      (categoriesApi.removeCategories as jest.Mock).mockRejectedValue(new Error('rm cat failed'));
      await renderLoaded();
      await press(screen.getByText('torrentDetail.category'));
      await press(screen.getByTestId('category-select'));
      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('cat failed', 'error'));
      await press(screen.getByText('torrentDetail.category'));
      await press(screen.getByTestId('category-create'));
      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('add cat failed', 'error'));
      await press(screen.getByText('torrentDetail.category'));
      await press(screen.getByTestId('category-delete'));
      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('rm cat failed', 'error'));
    });

    it('adds, removes, creates and deletes tags', async () => {
      await renderLoaded();
      await press(screen.getByText('torrentDetail.tags'));
      await press(screen.getByTestId('tags-add'));
      expect(api.addTorrentTags).toHaveBeenCalledWith(['h1'], ['hd']);
      await press(screen.getByTestId('tags-remove'));
      expect(api.removeTorrentTags).toHaveBeenCalledWith(['h1'], ['hd']);
      await press(screen.getByTestId('tags-create'));
      expect(tagsApi.createTags).toHaveBeenCalledWith(['new']);
      await waitFor(() => expect(api.addTorrentTags).toHaveBeenLastCalledWith(['h1'], ['new']));
      await press(screen.getByTestId('tags-delete'));
      expect(tagsApi.deleteTags).toHaveBeenCalledWith(['old']);
      await waitFor(() =>
        expect(mockShowToast).toHaveBeenCalledWith('toast.tagDeleted:{"tag":"old"}', 'success'),
      );
      await press(screen.getByTestId('tags-close'));
      expect(screen.queryByTestId('tags-modal')).toBeNull();
    });

    it('reports tag failures', async () => {
      api.addTorrentTags.mockRejectedValue(new Error('add tag failed'));
      api.removeTorrentTags.mockRejectedValue(new Error('rm tag failed'));
      (tagsApi.createTags as jest.Mock).mockRejectedValue(new Error('create tag failed'));
      (tagsApi.deleteTags as jest.Mock).mockRejectedValue(new Error('del tag failed'));
      await renderLoaded();
      await press(screen.getByText('torrentDetail.tags'));
      await press(screen.getByTestId('tags-add'));
      await press(screen.getByTestId('tags-remove'));
      await press(screen.getByTestId('tags-create'));
      await press(screen.getByTestId('tags-delete'));
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('add tag failed', 'error');
        expect(mockShowToast).toHaveBeenCalledWith('rm tag failed', 'error');
        expect(mockShowToast).toHaveBeenCalledWith('create tag failed', 'error');
        expect(mockShowToast).toHaveBeenCalledWith('del tag failed', 'error');
      });
    });

    it('renames the torrent, ignoring an empty name, and explains what rename does', async () => {
      await renderLoaded();
      // the first moreInfo is the save-path info button; the rename info is last
      const infos = screen.getAllByLabelText('common.moreInfo');
      await press(infos[infos.length - 1]);
      expect(await screen.findByText('torrentDetail.renameTooltip')).toBeTruthy();
      await press(screen.getByText('server.gotIt'));
      await waitFor(() => expect(screen.queryByText('torrentDetail.renameTooltip')).toBeNull());
      await press(infos[infos.length - 1]);
      await fire(
        ancestorWith(await screen.findByText('torrentDetail.renameTooltip'), 'onRequestClose'),
        'requestClose',
      );
      await waitFor(() => expect(screen.queryByText('torrentDetail.renameTooltip')).toBeNull());
      await press(infos[infos.length - 1]);
      await press(await screen.findByText('torrentDetail.renameTooltip'));
      await waitFor(() => expect(screen.queryByText('torrentDetail.renameTooltip')).toBeNull());

      await press(screen.getByText('torrentDetail.rename'));
      expect(screen.getByTestId('input-modal-field').props.value).toBe('Ubuntu ISO');
      await type(screen.getByTestId('input-modal-field'), '');
      await press(screen.getByTestId('input-modal-confirm'));
      expect(api.setTorrentName).not.toHaveBeenCalled();

      await press(screen.getByText('torrentDetail.rename'));
      await type(screen.getByTestId('input-modal-field'), 'Debian ISO');
      await press(screen.getByTestId('input-modal-confirm'));
      expect(api.setTorrentName).toHaveBeenCalledWith('h1', 'Debian ISO');
      await waitFor(
        () => expect(mockShowToast).toHaveBeenCalledWith('toast.torrentRenamed', 'success'),
        LONG,
      );

      api.setTorrentName.mockRejectedValueOnce(new Error('rename failed'));
      await press(screen.getByText('torrentDetail.rename'));
      await press(screen.getByTestId('input-modal-confirm'));
      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('rename failed', 'error'));
    });
  });

  describe('refresh and polling', () => {
    it('reloads on pull-to-refresh', async () => {
      await renderLoaded();
      const scroll = findAllHost(screen.container, (n) => !!n.props.refreshControl)[0];
      await act(async () => {
        await scroll.props.refreshControl.props.onRefresh();
      });
      expect(api.getTorrentList).toHaveBeenCalledTimes(2);
    });

    describe('with fake timers', () => {
      let appStateHandler: ((s: AppStateStatus) => void) | undefined;
      beforeEach(() => {
        jest.useFakeTimers();
        appStateHandler = undefined;
        jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
          appStateHandler = handler as (s: AppStateStatus) => void;
          return { remove: jest.fn() } as never;
        });
      });
      afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
      });

      const tick = (ms: number) =>
        act(async () => {
          await jest.advanceTimersByTimeAsync(ms);
        });

      it('polls every 2s and pops the screen once the torrent disappears', async () => {
        await renderLoaded();
        await tick(2000);
        expect(api.getTorrentList).toHaveBeenCalledTimes(2);
        api.getTorrentPiecesStates.mockResolvedValue([1, 'x', 2]);
        currentTorrent = { ...baseTorrent, dlspeed: undefined, upspeed: undefined };
        await tick(2000);
        expect(api.getTorrentList).toHaveBeenCalledTimes(3);
        expect(screen.getByText('pieces:1,0,2')).toBeTruthy();

        // A failed or unrecognised piece-state reply just clears the map.
        api.getTorrentPiecesStates.mockRejectedValueOnce(new Error('no pieces'));
        await tick(2000);
        expect(screen.queryByText(/^pieces:/)).toBeNull();
        api.getTorrentPiecesStates.mockResolvedValue('unexpected');
        await tick(2000);
        expect(screen.queryByText(/^pieces:/)).toBeNull();

        // An ordinary failure stays silent
        api.getTorrentList.mockRejectedValueOnce(new Error('blip'));
        await tick(2000);
        expect(mockShowToast).not.toHaveBeenCalled();

        currentTorrent = null;
        await tick(2000);
        expect(mockShowToast).toHaveBeenCalledWith('torrentDetail.torrentRemoved', 'error');
        expect(mockRouter.back).toHaveBeenCalledTimes(1);
        const calls = api.getTorrentList.mock.calls.length;
        await tick(6000);
        expect(api.getTorrentList).toHaveBeenCalledTimes(calls);
      });

      it('leaves the screen when a poll 404s', async () => {
        await renderLoaded();
        api.getTorrentProperties.mockRejectedValue(httpError(404));
        await tick(2000);
        expect(mockRouter.back).toHaveBeenCalledTimes(1);
      });

      it('stops polling in the background and refreshes on return', async () => {
        await renderLoaded();
        expect(appStateHandler).toBeDefined();
        await act(async () => appStateHandler!('background'));
        const calls = api.getTorrentList.mock.calls.length;
        await tick(6000);
        expect(api.getTorrentList).toHaveBeenCalledTimes(calls);
        await act(async () => appStateHandler!('active'));
        await tick(0);
        expect(api.getTorrentList).toHaveBeenCalledTimes(calls + 1);
        await tick(2000);
        expect(api.getTorrentList).toHaveBeenCalledTimes(calls + 2);
      });

      it('does not pop twice when a poll sees the torrent gone during a delete', async () => {
        let finishDelete!: () => void;
        api.deleteTorrents.mockImplementation(() => new Promise<void>((r) => (finishDelete = r)));
        await renderLoaded();
        await press(screen.getByText('common.delete'));
        const pending = fireEvent.press(screen.getByTestId('confirm-alerts.torrentOnly'));
        currentTorrent = null;
        await tick(2000);
        await act(async () => {
          finishDelete();
          await pending;
        });
        expect(mockRouter.back).toHaveBeenCalledTimes(1);
      });

      it('stops polling when the connection drops', async () => {
        const view = await render(<TorrentDetail />);
        await tick(0);
        mockServerState.isConnected = false;
        await view.rerender(<TorrentDetail />);
        const calls = api.getTorrentList.mock.calls.length;
        await tick(4000);
        expect(api.getTorrentList).toHaveBeenCalledTimes(calls);
      });
    });
  });
});

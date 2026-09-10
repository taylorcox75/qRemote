import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useRouter, useNavigation } from 'expo-router';
import { TorrentDetailBody } from '@/components/torrent-detail/TorrentDetailBody';
import { useServer } from '@/context/ServerContext';
import { useToast } from '@/context/ToastContext';
import { useTorrents } from '@/context/TorrentContext';
import { useApiFeatures } from '@/context/ApiVersionContext';
import { torrentsApi } from '@/services/api/torrents';
import { TorrentInfo, TorrentProperties } from '@/types/api';

// TorrentDetailBody is rendered either as the full-screen route (embedded
// undefined/false) or inside SplitLayout's detail pane (embedded true). See
// the component's header comment: embedded hides the back button and routes
// every "leave this screen" action through onDismiss instead of
// router.back()/router.replace(), and skips navigation.setOptions (there's
// no enclosing stack screen to configure).

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors, isDark: false }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useNavigation: jest.fn(),
  useIsFocused: jest.fn(() => true),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

jest.mock('@/context/ServerContext', () => ({ useServer: jest.fn() }));
jest.mock('@/context/ToastContext', () => ({ useToast: jest.fn() }));
jest.mock('@/context/TorrentContext', () => ({ useTorrents: jest.fn() }));
jest.mock('@/context/ApiVersionContext', () => ({ useApiFeatures: jest.fn() }));

jest.mock('@/services/api/torrents', () => ({
  torrentsApi: {
    getTorrentList: jest.fn(),
    getTorrentProperties: jest.fn(),
    getTorrentTrackers: jest.fn(),
    getTorrentContents: jest.fn(),
    getTorrentPiecesStates: jest.fn(),
    deleteTorrents: jest.fn(),
  },
}));

// Same rationale as TorrentRow.test.tsx: ArtworkThumbnail reads the artwork
// feature flag directly, not via props. Default to inactive so it renders
// null and every assertion below stays unaffected by artwork.
jest.mock('@/context/ArtworkContext', () => ({
  useArtworkSettings: jest.fn(() => ({
    enabled: false,
    hasKey: false,
    active: false,
    refresh: jest.fn(),
  })),
}));
jest.mock('@/hooks/useArtwork', () => ({
  useArtwork: jest.fn(() => ({ artwork: undefined, loading: false })),
}));
jest.mock('@/services/tmdb', () => ({
  posterUrl: jest.fn(() => null),
}));

const TORRENT: TorrentInfo = {
  added_on: 1700000000,
  amount_left: 0,
  auto_tmm: false,
  availability: 1,
  category: '',
  completed: 1000,
  completion_on: 1700000500,
  dl_limit: 0,
  dlspeed: 0,
  download_path: '',
  downloaded: 1000,
  downloaded_session: 0,
  eta: 8640000,
  f_l_piece_prio: false,
  force_start: false,
  hash: 'abc123',
  last_activity: 1700000500,
  magnet_uri: 'magnet:?xt=urn:btih:abc123',
  max_ratio: -1,
  max_seeding_time: -1,
  name: 'My Test Torrent',
  num_complete: 1,
  num_incomplete: 0,
  num_leechs: 0,
  num_seeds: 1,
  priority: 0,
  progress: 1,
  ratio: 0.5,
  save_path: '/downloads',
  seeding_time: 100,
  seen_complete: 1700000500,
  seq_dl: false,
  size: 1000,
  state: 'pausedUP',
  super_seeding: false,
  tags: '',
  time_active: 100,
  total_size: 1000,
  tracker: '',
  up_limit: 0,
  uploaded: 0,
  uploaded_session: 0,
  upspeed: 0,
} as TorrentInfo;

const PROPERTIES: TorrentProperties = {
  addition_date: 1700000000,
  comment: '',
  completion_date: 1700000500,
  created_by: '',
  creation_date: 1700000000,
  dl_limit: 0,
  dl_speed: 0,
  dl_speed_avg: 0,
  download_path: '',
  downloaded: 1000,
  downloaded_session: 0,
  eta: 8640000,
  hash: 'abc123',
  infohash_v1: '',
  infohash_v2: '',
  last_activity: 1700000500,
  peers: 0,
  peers_total: 0,
  piece_size: 16384,
  pieces_have: 1,
  pieces_num: 1,
  reannounce: 0,
  save_path: '/downloads',
  seeding_time: 100,
  seeds: 1,
  seeds_total: 1,
  share_ratio: 0.5,
  time_elapsed: 100,
  total_downloaded: 1000,
  total_size: 1000,
  total_uploaded: 0,
  up_limit: 0,
  up_speed: 0,
  up_speed_avg: 0,
  uploaded: 0,
  uploaded_session: 0,
} as TorrentProperties;

/** getTorrentList et al. resolve with a loaded torrent, reaching the main render. */
function mockSuccessfulLoad() {
  jest.mocked(torrentsApi.getTorrentList).mockResolvedValue([TORRENT]);
  jest.mocked(torrentsApi.getTorrentProperties).mockResolvedValue(PROPERTIES);
  jest.mocked(torrentsApi.getTorrentTrackers).mockResolvedValue([]);
  jest.mocked(torrentsApi.getTorrentContents).mockResolvedValue([]);
  jest.mocked(torrentsApi.getTorrentPiecesStates).mockResolvedValue([]);
}

/**
 * getTorrentList resolves empty: the hash is gone by the time this mounts.
 * loadTorrentData awaits all five calls via Promise.all before checking the
 * list, so the other four must resolve too (their values are discarded once
 * the empty list is seen) rather than reject, or the catch branch below
 * would run instead of the !next branch this is meant to exercise.
 */
function mockTorrentGone() {
  jest.mocked(torrentsApi.getTorrentList).mockResolvedValue([]);
  jest.mocked(torrentsApi.getTorrentProperties).mockResolvedValue(PROPERTIES);
  jest.mocked(torrentsApi.getTorrentTrackers).mockResolvedValue([]);
  jest.mocked(torrentsApi.getTorrentContents).mockResolvedValue([]);
  jest.mocked(torrentsApi.getTorrentPiecesStates).mockResolvedValue([]);
}

describe('TorrentDetailBody', () => {
  let routerMock: {
    back: jest.Mock;
    replace: jest.Mock;
    push: jest.Mock;
    canGoBack: jest.Mock;
  };
  let navigationMock: { setOptions: jest.Mock };
  let showToast: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    routerMock = {
      back: jest.fn(),
      replace: jest.fn(),
      push: jest.fn(),
      canGoBack: jest.fn(() => true),
    };
    navigationMock = { setOptions: jest.fn() };
    jest.mocked(useRouter).mockReturnValue(routerMock as unknown as ReturnType<typeof useRouter>);
    jest
      .mocked(useNavigation)
      .mockReturnValue(navigationMock as unknown as ReturnType<typeof useNavigation>);

    jest.mocked(useServer).mockReturnValue({
      isConnected: true,
      isLoading: false,
    } as unknown as ReturnType<typeof useServer>);

    showToast = jest.fn();
    jest.mocked(useToast).mockReturnValue({
      showToast,
    } as unknown as ReturnType<typeof useToast>);

    jest.mocked(useTorrents).mockReturnValue({
      categories: {},
      tags: [],
    } as unknown as ReturnType<typeof useTorrents>);

    jest.mocked(useApiFeatures).mockReturnValue({
      apiVersion: '2.9.3',
      features: { hasIsPrivate: true },
    } as unknown as ReturnType<typeof useApiFeatures>);
  });

  describe('non-embedded (full-screen route)', () => {
    it('shows the back button and enables the swipe-back gesture', async () => {
      mockSuccessfulLoad();
      await render(<TorrentDetailBody hash="abc123" />);
      await waitFor(() => expect(screen.getAllByText('My Test Torrent').length).toBeGreaterThan(0));

      expect(screen.getByLabelText('common.back')).toBeTruthy();
      expect(navigationMock.setOptions).toHaveBeenCalledWith({
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      });
    });

    it('navigates back via router.back() when the torrent is gone', async () => {
      mockTorrentGone();
      await render(<TorrentDetailBody hash="abc123" />);

      await waitFor(() => expect(routerMock.back).toHaveBeenCalledTimes(1));
      expect(routerMock.replace).not.toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith('torrentDetail.torrentRemoved', 'error');
    });
  });

  describe('embedded (split-view detail pane)', () => {
    it('hides the back button and does not call navigation.setOptions', async () => {
      mockSuccessfulLoad();
      await render(<TorrentDetailBody hash="abc123" embedded onDismiss={jest.fn()} />);
      await waitFor(() => expect(screen.getAllByText('My Test Torrent').length).toBeGreaterThan(0));

      expect(screen.queryByLabelText('common.back')).toBeNull();
      expect(navigationMock.setOptions).not.toHaveBeenCalled();
    });

    it('calls onDismiss instead of navigating when the torrent is gone', async () => {
      mockTorrentGone();
      const onDismiss = jest.fn();
      await render(<TorrentDetailBody hash="abc123" embedded onDismiss={onDismiss} />);

      await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it('calls onDismiss instead of router.back() after confirming delete', async () => {
      mockSuccessfulLoad();
      jest.mocked(torrentsApi.deleteTorrents).mockResolvedValue(undefined);
      const onDismiss = jest.fn();
      await render(<TorrentDetailBody hash="abc123" embedded onDismiss={onDismiss} />);
      await waitFor(() => expect(screen.getAllByText('My Test Torrent').length).toBeGreaterThan(0));

      // ConfirmModal only mounts its children once `visible` is true (it
      // wraps RN's own Modal, which renders nothing while hidden), so the
      // delete action must open it before its buttons are reachable.
      fireEvent.press(screen.getByText('common.delete'));
      fireEvent.press(await screen.findByText('alerts.torrentOnly'));

      await waitFor(() =>
        expect(torrentsApi.deleteTorrents).toHaveBeenCalledWith(['abc123'], false),
      );
      await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
      expect(routerMock.back).not.toHaveBeenCalled();
    });
  });
});

import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import TransferScreen from '@/app/(tabs)/transfer';
import { torrentsApi } from '@/services/api/torrents';
import { applicationApi } from '@/services/api/application';
import { ServerManager } from '@/services/server-manager';
import { useGracefulError } from '@/hooks/useGracefulError';
import { CONNECT_SUPERSEDED_MESSAGE } from '@/utils/error';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => cb(), [cb]);
  },
}));
jest.mock('@/context/ThemeContext', () => require('@/tests/rn/components/cov/mocks').themeModule);
jest.mock('react-i18next', () => require('@/tests/rn/components/cov/mocks').i18nModule);
jest.mock(
  '@/components/FocusAwareStatusBar',
  () => require('@/tests/rn/components/cov/mocks').focusAwareStatusBarModule,
);
const mockShowToast = jest.fn();
jest.mock('@/context/ToastContext', () => ({ useToast: () => ({ showToast: mockShowToast }) }));
const mockTransfer = jest.fn();
jest.mock('@/context/TransferContext', () => ({ useTransfer: () => mockTransfer() }));
const mockServer = jest.fn();
jest.mock('@/context/ServerContext', () => ({ useServer: () => mockServer() }));
const mockTorrents = jest.fn();
jest.mock('@/context/TorrentContext', () => ({ useTorrents: () => mockTorrents() }));
jest.mock('@/hooks/useGracefulError', () => ({
  useGracefulError: jest.fn(() => ({ graceError: null, isPendingError: false })),
}));
jest.mock('@/services/api/torrents', () => ({
  torrentsApi: {
    pauseTorrents: jest.fn(),
    resumeTorrents: jest.fn(),
    setForceStart: jest.fn(),
  },
}));
jest.mock('@/services/api/application', () => ({
  applicationApi: { getPreferences: jest.fn(), setPreferences: jest.fn() },
}));
jest.mock('@/services/server-manager', () => ({ ServerManager: { getServers: jest.fn() } }));

const transferInfo = {
  dl_info_speed: 2048,
  up_info_speed: 1024,
  dl_info_data: 10 * 1024 ** 3,
  up_info_data: 5 * 1024 ** 3,
  dl_rate_limit: 0,
  up_rate_limit: 102400,
  alt_dl_limit: 51200,
  alt_up_limit: 0,
  use_alt_speed_limits: false,
  connection_status: 'connected',
  dht_nodes: 321,
};

function makeTransfer(overrides = {}) {
  return {
    transferInfo,
    isLoading: false,
    error: null,
    isRecoveringFromBackground: false,
    refresh: jest.fn().mockResolvedValue(undefined),
    toggleAlternativeSpeedLimits: jest.fn().mockResolvedValue(undefined),
    setDownloadLimit: jest.fn().mockResolvedValue(undefined),
    setUploadLimit: jest.fn().mockResolvedValue(undefined),
    setAltDownloadLimit: jest.fn().mockResolvedValue(undefined),
    setAltUploadLimit: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const serverConfig = { id: 'srv1', name: 'Home', host: 'h', port: 1, username: '', password: '' };

function makeServer(overrides = {}) {
  return {
    isConnected: true,
    connectedAt: new Date(Date.now() - 65_000),
    isLoading: false,
    connectToServer: jest.fn(),
    currentServer: serverConfig,
    ...overrides,
  };
}

function makeTorrents(overrides = {}) {
  return {
    torrents: [
      { hash: 'd1', state: 'downloading' },
      { hash: 'd2', state: 'metaDL' },
      { hash: 'u1', state: 'stalledUP' },
      { hash: 'p1', state: 'pausedDL' },
    ],
    serverState: {
      alltime_dl: 100 * 1024 ** 3,
      alltime_ul: 50 * 1024 ** 3,
      global_ratio: '0.50',
      total_peer_connections: 12,
      free_space_on_disk: 500 * 1024 ** 3,
      last_external_address_v4: '203.0.113.7',
    },
    sync: jest.fn().mockResolvedValue(undefined),
    isRecoveringFromBackground: false,
    initialLoadComplete: true,
    ...overrides,
  };
}

let transfer: ReturnType<typeof makeTransfer>;
let server: ReturnType<typeof makeServer>;
let torrents: ReturnType<typeof makeTorrents>;

function setup(t = {}, s = {}, tor = {}) {
  transfer = makeTransfer(t);
  server = makeServer(s);
  torrents = makeTorrents(tor);
  mockTransfer.mockImplementation(() => transfer);
  mockServer.mockImplementation(() => server);
  mockTorrents.mockImplementation(() => torrents);
  return render(<TransferScreen />);
}

const prefs = (o = {}) => ({
  max_ratio_enabled: false,
  max_ratio: -1,
  max_seeding_time_enabled: false,
  max_seeding_time: -1,
  max_ratio_act: 0,
  ...o,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(applicationApi.getPreferences).mockResolvedValue(prefs() as never);
  jest.mocked(applicationApi.setPreferences).mockResolvedValue(undefined as never);
  jest.mocked(ServerManager.getServers).mockResolvedValue([]);
});

describe('TransferScreen — states', () => {
  it('shows the quick-connect panel when disconnected and connects from it', async () => {
    jest.mocked(ServerManager.getServers).mockResolvedValue([serverConfig] as never);
    const connectToServer = jest.fn().mockResolvedValue(false);
    await setup({}, { isConnected: false, connectedAt: null, connectToServer });
    await waitFor(() => expect(screen.getByText('Home')).toBeTruthy());
    await fireEvent.press(screen.getByText('Home'));
    expect(connectToServer).toHaveBeenCalledWith(serverConfig);
    await waitFor(() => expect(screen.getByText('errors.checkCredentials')).toBeTruthy());
  });

  it('shows a thrown connect error, ignoring a superseded one', async () => {
    jest.mocked(ServerManager.getServers).mockResolvedValue([serverConfig] as never);
    const connectToServer = jest
      .fn()
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockRejectedValueOnce(new Error(CONNECT_SUPERSEDED_MESSAGE));
    await setup({}, { isConnected: false, connectedAt: null, connectToServer });
    await waitFor(() => expect(screen.getByText('Home')).toBeTruthy());
    await fireEvent.press(screen.getByText('Home'));
    await waitFor(() => expect(screen.getByText(/Connection refused/)).toBeTruthy());
    await fireEvent.press(screen.getByText('Home'));
    await waitFor(() => expect(connectToServer).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/Connection refused/)).toBeNull();
  });

  it('falls back to an empty server list when loading servers fails, and opens add-server', async () => {
    jest.mocked(ServerManager.getServers).mockRejectedValue(new Error('x'));
    await setup({}, { isConnected: false, connectedAt: null });
    await waitFor(() => expect(screen.getByText('screens.settings.addServer')).toBeTruthy());
    await fireEvent.press(screen.getByText('screens.settings.addServer'));
    expect(mockPush).toHaveBeenCalledWith('/server/add');
  });

  it('shows a loading state during the initial load', async () => {
    await setup({ isLoading: true }, {}, { initialLoadComplete: false });
    expect(screen.getByText('common.loading')).toBeTruthy();
  });

  it('shows a loading state while recovering from background', async () => {
    await setup({}, {}, { isRecoveringFromBackground: true });
    expect(screen.getByText('common.loading')).toBeTruthy();
  });

  it('shows the persisted error with a retry', async () => {
    jest
      .mocked(useGracefulError)
      .mockReturnValue({ graceError: 'Server unreachable', isPendingError: false });
    await setup({ error: 'Server unreachable' });
    expect(screen.getByText('Server unreachable')).toBeTruthy();
    await fireEvent.press(screen.getByText('common.retry'));
    expect(transfer.refresh).toHaveBeenCalled();
    jest.mocked(useGracefulError).mockReturnValue({ graceError: null, isPendingError: false });
  });

  it('shows a spinner while transfer info is loading, and a message when it is absent', async () => {
    await setup({ transferInfo: null, isLoading: true });
    expect(screen.queryByText('screens.transfer.noTransferInfo')).toBeNull();
    await setup({ transferInfo: null });
    expect(screen.getByText('screens.transfer.noTransferInfo')).toBeTruthy();
  });
});

describe('TransferScreen — dashboard', () => {
  it('renders session, all-time and connection info', async () => {
    await setup();
    expect(screen.getByText('screens.transfer.thisSession')).toBeTruthy();
    expect(screen.getByText('screens.transfer.allTime')).toBeTruthy();
    expect(screen.getByText('203.0.113.7')).toBeTruthy();
    expect(screen.getByText('321')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('opens and dismisses the info tooltips', async () => {
    await setup();
    const infos = screen.getAllByLabelText('common.moreInfo');
    await fireEvent.press(infos[0]);
    expect(screen.getByText('screens.transfer.connectedForTooltip')).toBeTruthy();
    await fireEvent.press(screen.getByText('server.gotIt'));
    expect(screen.queryByText('screens.transfer.connectedForTooltip')).toBeNull();
    await fireEvent.press(infos[1]);
    expect(screen.getByText('screens.transfer.externalIpTooltip')).toBeTruthy();
  });

  it.each([
    ['screens.transfer.resumeAll', 'resumeTorrents', 'screens.transfer.allResumed'],
    ['screens.transfer.pauseAll', 'pauseTorrents', 'screens.transfer.allPaused'],
  ] as const)('%s calls %s for all torrents', async (label, method, toast) => {
    await setup();
    await fireEvent.press(screen.getByText(label));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith(toast, 'success'));
    expect(torrentsApi[method]).toHaveBeenCalledWith(['all']);
    expect(torrents.sync).toHaveBeenCalled();
  });

  it('force-starts all torrents', async () => {
    await setup();
    await fireEvent.press(screen.getByText('screens.transfer.forceStartAll'));
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('screens.transfer.forceStartEnabled', 'success'),
    );
    expect(torrentsApi.setForceStart).toHaveBeenCalledWith(['all'], true);
  });

  it('pauses only downloading torrents, and only uploading ones', async () => {
    await setup();
    await fireEvent.press(screen.getByText('screens.transfer.pauseDownloads'));
    await waitFor(() => expect(torrentsApi.pauseTorrents).toHaveBeenCalledWith(['d1', 'd2']));
    expect(mockShowToast).toHaveBeenCalledWith('screens.transfer.pausedDl(count=2)', 'success');
    await fireEvent.press(screen.getByText('screens.transfer.pauseUploads'));
    await waitFor(() => expect(torrentsApi.pauseTorrents).toHaveBeenCalledWith(['u1']));
  });

  it('tells the user when there is nothing to pause', async () => {
    await setup({}, {}, { torrents: [] });
    await fireEvent.press(screen.getByText('screens.transfer.pauseDownloads'));
    await fireEvent.press(screen.getByText('screens.transfer.pauseUploads'));
    expect(mockShowToast).toHaveBeenCalledWith('screens.transfer.noDlTorrents', 'info');
    expect(mockShowToast).toHaveBeenCalledWith('screens.transfer.noUlTorrents', 'info');
    expect(torrentsApi.pauseTorrents).not.toHaveBeenCalled();
  });

  it('toasts action failures', async () => {
    jest.mocked(torrentsApi.pauseTorrents).mockRejectedValue(new Error('nope'));
    jest.mocked(torrentsApi.resumeTorrents).mockRejectedValue(new Error('nope'));
    jest.mocked(torrentsApi.setForceStart).mockRejectedValue(new Error('nope'));
    await setup();
    for (const label of [
      'screens.transfer.pauseAll',
      'screens.transfer.resumeAll',
      'screens.transfer.forceStartAll',
      'screens.transfer.pauseDownloads',
      'screens.transfer.pauseUploads',
    ]) {
      await fireEvent.press(screen.getByText(label));
    }
    await waitFor(() =>
      expect(mockShowToast.mock.calls.filter(([, k]) => k === 'error')).toHaveLength(5),
    );
  });

  it('toggles alternative speeds and toasts a failure', async () => {
    await setup({
      toggleAlternativeSpeedLimits: jest.fn().mockRejectedValue(new Error('alt failed')),
    });
    const switches = screen.getAllByRole('switch');
    await fireEvent(switches[0], 'valueChange', true);
    await waitFor(() => expect(transfer.toggleAlternativeSpeedLimits).toHaveBeenCalled());
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('alt failed', 'error'));
  });
});

describe('TransferScreen — speed limits', () => {
  async function openAndSubmit(rowLabel: string, value: string) {
    await fireEvent.press(screen.getAllByText(rowLabel)[0]);
    const input = screen.getByPlaceholderText('placeholders.enterKbs');
    await fireEvent.changeText(input, value);
    await fireEvent.press(screen.getByText('screens.transfer.set'));
  }

  it('prefills the current upload limit and sets a new one in bytes', async () => {
    await setup();
    await fireEvent.press(screen.getAllByText('screens.transfer.uploadLimit')[0]);
    expect(screen.getByPlaceholderText('placeholders.enterKbs').props.value).toBe('100');
    await fireEvent.changeText(screen.getByPlaceholderText('placeholders.enterKbs'), '250');
    expect(screen.getByText(/^= /)).toBeTruthy();
    await fireEvent.press(screen.getByText('screens.transfer.set'));
    await waitFor(() => expect(transfer.setUploadLimit).toHaveBeenCalledWith(250 * 1024));
    expect(mockShowToast).toHaveBeenCalledWith(
      'screens.transfer.uploadLimitSet(value=250)',
      'success',
    );
  });

  it('removes the download limit with 0', async () => {
    await setup();
    await openAndSubmit('screens.transfer.downloadLimit', '0');
    await waitFor(() => expect(transfer.setDownloadLimit).toHaveBeenCalledWith(0));
    expect(mockShowToast).toHaveBeenCalledWith('screens.transfer.downloadLimitRemoved', 'success');
  });

  it('sets a download limit and removes the upload limit', async () => {
    await setup();
    await openAndSubmit('screens.transfer.downloadLimit', '10');
    await waitFor(() => expect(transfer.setDownloadLimit).toHaveBeenCalledWith(10240));
    await openAndSubmit('screens.transfer.uploadLimit', '0');
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('screens.transfer.uploadLimitRemoved', 'success'),
    );
  });

  it('sets and removes alternative limits, rounding KiB/s', async () => {
    await setup({ transferInfo: { ...transferInfo, use_alt_speed_limits: true } });
    await fireEvent.press(screen.getAllByText('screens.transfer.altDownloadLimit')[0]);
    expect(screen.getByPlaceholderText('placeholders.enterKbs').props.value).toBe('50');
    await fireEvent.changeText(screen.getByPlaceholderText('placeholders.enterKbs'), '12.6');
    await fireEvent.press(screen.getByText('screens.transfer.set'));
    await waitFor(() => expect(transfer.setAltDownloadLimit).toHaveBeenCalledWith(13 * 1024));
    await openAndSubmit('screens.transfer.altDownloadLimit', '0');
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith(
        'screens.transfer.altDownloadLimitRemoved',
        'success',
      ),
    );
    await openAndSubmit('screens.transfer.altUploadLimit', '7');
    await waitFor(() => expect(transfer.setAltUploadLimit).toHaveBeenCalledWith(7 * 1024));
    await openAndSubmit('screens.transfer.altUploadLimit', '0');
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith(
        'screens.transfer.altUploadLimitRemoved',
        'success',
      ),
    );
  });

  it('rejects an invalid limit and keeps the modal open', async () => {
    await setup();
    await openAndSubmit('screens.transfer.downloadLimit', 'abc');
    expect(mockShowToast).toHaveBeenCalledWith('errors.validNumber', 'error');
    expect(transfer.setDownloadLimit).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('placeholders.enterKbs')).toBeTruthy();
    await fireEvent.press(screen.getByText('common.cancel'));
    expect(screen.queryByPlaceholderText('placeholders.enterKbs')).toBeNull();
  });

  it('toasts a failure to set a limit', async () => {
    await setup({ setDownloadLimit: jest.fn().mockRejectedValue(new Error('denied')) });
    await openAndSubmit('screens.transfer.downloadLimit', '5');
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('denied', 'error'));
  });
});

describe('TransferScreen — global seeding limits', () => {
  const ratioSwitch = () => screen.getAllByRole('switch')[1];
  const seedSwitch = () => screen.getAllByRole('switch')[2];

  it('loads limits from the server preferences', async () => {
    jest
      .mocked(applicationApi.getPreferences)
      .mockResolvedValue(
        prefs({ max_ratio_enabled: true, max_ratio: 2, max_ratio_act: 1 }) as never,
      );
    await setup();
    await waitFor(() => expect(screen.getByText('2.00')).toBeTruthy());
    expect(screen.getByText('screens.transfer.actionRemove')).toBeTruthy();
  });

  it('prompts for a ratio when enabling with no known value, then sends both fields', async () => {
    await setup();
    await waitFor(() => expect(applicationApi.getPreferences).toHaveBeenCalled());
    await fireEvent(ratioSwitch(), 'valueChange', true);
    expect(applicationApi.setPreferences).not.toHaveBeenCalled();
    const input = screen.getByDisplayValue('1.00');
    await fireEvent.changeText(input, '1.5');
    await fireEvent.press(screen.getByText('common.confirm'));
    await waitFor(() =>
      expect(applicationApi.setPreferences).toHaveBeenCalledWith({
        max_ratio_enabled: true,
        max_ratio: 1.5,
      }),
    );
    expect(mockShowToast).toHaveBeenCalledWith('toast.serverSettingUpdated', 'success');
  });

  it('restores the remembered ratio when switching back on, and disables with -1', async () => {
    jest
      .mocked(applicationApi.getPreferences)
      .mockResolvedValue(prefs({ max_ratio_enabled: true, max_ratio: 3 }) as never);
    await setup();
    await waitFor(() => expect(screen.getByText('3.00')).toBeTruthy());
    await fireEvent(ratioSwitch(), 'valueChange', false);
    await waitFor(() =>
      expect(applicationApi.setPreferences).toHaveBeenLastCalledWith({
        max_ratio_enabled: false,
        max_ratio: -1,
      }),
    );
    await fireEvent(ratioSwitch(), 'valueChange', true);
    await waitFor(() =>
      expect(applicationApi.setPreferences).toHaveBeenLastCalledWith({
        max_ratio_enabled: true,
        max_ratio: 3,
      }),
    );
  });

  it('turns the ratio limit off from the Unlimited preset', async () => {
    jest
      .mocked(applicationApi.getPreferences)
      .mockResolvedValue(prefs({ max_ratio_enabled: true, max_ratio: 3 }) as never);
    await setup();
    await waitFor(() => expect(screen.getByText('3.00')).toBeTruthy());
    await fireEvent.press(screen.getByText('3.00'));
    await fireEvent.press(screen.getAllByText('common.unlimited')[0]);
    await waitFor(() =>
      expect(applicationApi.setPreferences).toHaveBeenCalledWith({
        max_ratio_enabled: false,
        max_ratio: -1,
      }),
    );
  });

  it('rolls back and toasts when saving fails', async () => {
    jest.mocked(applicationApi.setPreferences).mockRejectedValue(new Error('x'));
    jest
      .mocked(applicationApi.getPreferences)
      .mockResolvedValue(prefs({ max_ratio_enabled: true, max_ratio: 3 }) as never);
    await setup();
    await waitFor(() => expect(screen.getByText('3.00')).toBeTruthy());
    await fireEvent(ratioSwitch(), 'valueChange', false);
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('errors.failedToUpdateServerSetting', 'error'),
    );
    expect(screen.getByText('3.00')).toBeTruthy();
    expect(ratioSwitch().props.value).toBe(true);
  });

  it('prompts for a seeding time, rejects an empty value, and rounds minutes', async () => {
    await setup();
    await waitFor(() => expect(applicationApi.getPreferences).toHaveBeenCalled());
    await fireEvent(seedSwitch(), 'valueChange', true);
    const input = screen.getByDisplayValue('1440');
    await fireEvent.changeText(input, '');
    await fireEvent.press(screen.getByText('common.confirm'));
    expect(applicationApi.setPreferences).not.toHaveBeenCalled();
    await fireEvent.changeText(input, '90.6');
    await fireEvent.press(screen.getByText('common.confirm'));
    await waitFor(() =>
      expect(applicationApi.setPreferences).toHaveBeenCalledWith({
        max_seeding_time_enabled: true,
        max_seeding_time: 91,
      }),
    );
  });

  it('cancels the seeding time prompt without saving', async () => {
    await setup();
    await waitFor(() => expect(applicationApi.getPreferences).toHaveBeenCalled());
    await fireEvent(seedSwitch(), 'valueChange', true);
    await fireEvent.press(screen.getByText('common.cancel'));
    expect(applicationApi.setPreferences).not.toHaveBeenCalled();
  });

  it('edits and disables a known seeding time', async () => {
    jest
      .mocked(applicationApi.getPreferences)
      .mockResolvedValue(prefs({ max_seeding_time_enabled: true, max_seeding_time: 120 }) as never);
    await setup();
    await waitFor(() =>
      expect(screen.getAllByText('screens.transfer.maxSeedingTime').length).toBeGreaterThan(0),
    );
    await fireEvent.press(screen.getAllByText('screens.transfer.maxSeedingTime')[0]);
    await fireEvent.press(screen.getAllByText('common.unlimited')[0]);
    await waitFor(() =>
      expect(applicationApi.setPreferences).toHaveBeenCalledWith({
        max_seeding_time_enabled: false,
        max_seeding_time: -1,
      }),
    );
    await fireEvent(seedSwitch(), 'valueChange', true);
    await waitFor(() =>
      expect(applicationApi.setPreferences).toHaveBeenLastCalledWith({
        max_seeding_time_enabled: true,
        max_seeding_time: 120,
      }),
    );
  });

  it('changes the action taken when the limit is reached', async () => {
    jest
      .mocked(applicationApi.getPreferences)
      .mockResolvedValue(prefs({ max_ratio_enabled: true, max_ratio: 1 }) as never);
    await setup();
    await waitFor(() => expect(screen.getByText('screens.transfer.actionPause')).toBeTruthy());
    await fireEvent.press(screen.getByText('screens.transfer.whenLimitReached'));
    await fireEvent.press(screen.getByLabelText('screens.transfer.actionRemove'));
    await waitFor(() =>
      expect(applicationApi.setPreferences).toHaveBeenCalledWith({ max_ratio_act: 1 }),
    );
  });

  it('ignores a preferences failure', async () => {
    jest.mocked(applicationApi.getPreferences).mockRejectedValue(new Error('offline'));
    await setup();
    await waitFor(() => expect(applicationApi.getPreferences).toHaveBeenCalled());
    expect(ratioSwitch().props.value).toBe(false);
  });
});

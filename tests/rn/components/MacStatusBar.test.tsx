import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { MacStatusBar } from '@/components/MacStatusBar';
import { useTorrents } from '@/context/TorrentContext';
import { useTransfer } from '@/context/TransferContext';
import { ServerState } from '@/types/api';
import { formatSpeed, formatSize } from '@/utils/format';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('@/context/TorrentContext', () => ({ useTorrents: jest.fn() }));
jest.mock('@/context/TransferContext', () => ({ useTransfer: jest.fn() }));

const SERVER_STATE: Partial<ServerState> = {
  dht_nodes: 42,
  connection_status: 'connected',
  use_alt_speed_limits: false,
  dl_info_speed: 2048,
  dl_info_data: 1024 * 1024 * 10,
  up_info_speed: 1024,
  up_info_data: 1024 * 1024 * 5,
  free_space_on_disk: 1024 * 1024 * 1024 * 50,
  global_ratio: '1.23',
};

function mockServerState(overrides?: Partial<ServerState> | null) {
  jest.mocked(useTorrents).mockReturnValue({
    torrents: [],
    categories: {},
    tags: [],
    serverState: overrides === null ? null : { ...SERVER_STATE, ...overrides },
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    sync: jest.fn(),
    isRecoveringFromBackground: false,
    initialLoadComplete: true,
  } as unknown as ReturnType<typeof useTorrents>);
}

describe('MacStatusBar', () => {
  const toggleAlternativeSpeedLimits = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useTransfer).mockReturnValue({
      transferInfo: null,
      isLoading: false,
      error: null,
      isRecoveringFromBackground: false,
      refresh: jest.fn(),
      toggleAlternativeSpeedLimits,
      setDownloadLimit: jest.fn(),
      setUploadLimit: jest.fn(),
      setAltDownloadLimit: jest.fn(),
      setAltUploadLimit: jest.fn(),
    } as unknown as ReturnType<typeof useTransfer>);
    mockServerState();
  });

  it('renders nothing when serverState is null', async () => {
    mockServerState(null);
    const { toJSON } = await render(<MacStatusBar />);
    expect(toJSON()).toBeNull();
  });

  it('renders the DHT node count', async () => {
    await render(<MacStatusBar />);
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders the download speed with the session total in parentheses', async () => {
    await render(<MacStatusBar />);
    const expected = `${formatSpeed(SERVER_STATE.dl_info_speed)} (${formatSize(SERVER_STATE.dl_info_data)})`;
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it('renders the upload speed with the session total in parentheses', async () => {
    await render(<MacStatusBar />);
    const expected = `${formatSpeed(SERVER_STATE.up_info_speed)} (${formatSize(SERVER_STATE.up_info_data)})`;
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it('renders free disk space', async () => {
    await render(<MacStatusBar />);
    expect(screen.getByText(formatSize(SERVER_STATE.free_space_on_disk))).toBeTruthy();
  });

  it('renders the global ratio verbatim (already formatted by the server)', async () => {
    await render(<MacStatusBar />);
    expect(screen.getByText('1.23')).toBeTruthy();
  });

  it('calls toggleAlternativeSpeedLimits when the alt-speed toggle is pressed', async () => {
    await render(<MacStatusBar />);
    fireEvent.press(screen.getByTestId('mac-status-bar-alt-speed'));
    expect(toggleAlternativeSpeedLimits).toHaveBeenCalledTimes(1);
  });

  it('marks the alt-speed toggle selected when use_alt_speed_limits is true', async () => {
    mockServerState({ use_alt_speed_limits: true });
    await render(<MacStatusBar />);
    expect(screen.getByTestId('mac-status-bar-alt-speed').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('uses the success color dot when connected and error color when disconnected', async () => {
    await render(<MacStatusBar />);
    const connectedDot = screen.getByTestId('mac-status-bar-connection-dot');
    expect(StyleSheet.flatten(connectedDot.props.style)).toMatchObject({
      backgroundColor: require('./theme-mock').mockColors.success,
    });

    mockServerState({ connection_status: 'disconnected' });
    const { getByTestId } = await render(<MacStatusBar />);
    expect(
      StyleSheet.flatten(getByTestId('mac-status-bar-connection-dot').props.style),
    ).toMatchObject({ backgroundColor: require('./theme-mock').mockColors.error });
  });
});

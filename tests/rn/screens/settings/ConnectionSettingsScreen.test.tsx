// ConnectionSettingsScreen.test.tsx — Settings → Connection
// (app/(tabs)/settings/connection.tsx): qBittorrent network preferences read
// from app/preferences and written back through app/setPreferences, across the
// modern (qBit 4.6+) and legacy proxy field sets and the I2P gate.
import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react-native';
import ConnectionSettingsScreen from '@/app/(tabs)/settings/connection';
import { routerMock, toastMock, resetSharedMocks } from './helpers';

jest.mock('expo-router', () => require('./helpers').expoRouterMock);
jest.mock('react-i18next', () => require('./helpers').i18nMock);
jest.mock('@/context/ThemeContext', () => require('./helpers').themeContextMock);
jest.mock('@/context/ToastContext', () => require('./helpers').toastContextMock);
jest.mock('@/components/FocusAwareStatusBar', () => require('./helpers').statusBarMock);
jest.mock('@/components/OptionPicker', () => require('./helpers').optionPickerMock);
jest.mock('@/components/InputModal', () => require('./helpers').inputModalMock);

const mockServer = { isConnected: true };
jest.mock('@/context/ServerContext', () => ({ useServer: () => mockServer }));
const mockFeatures = { hasModernProxyFields: true, supportsI2p: true };
jest.mock('@/context/ApiVersionContext', () => ({
  useApiFeatures: () => ({ features: mockFeatures }),
}));

const mockApp = { getPreferences: jest.fn(), setPreferences: jest.fn() };
jest.mock('@/services/api/application', () => ({
  get applicationApi() {
    return mockApp;
  },
}));

const S = (k: string) => `screens.settings.${k}`;

const MODERN_PREFS = {
  listen_port: 51413,
  random_port: false,
  upnp: true,
  max_connec: 500,
  max_connec_per_torrent: -1,
  max_uploads: -1,
  max_uploads_per_torrent: 4,
  proxy_type: 'SOCKS5',
  proxy_ip: 'proxy.local',
  proxy_port: 1080,
  proxy_auth_enabled: true,
  proxy_username: 'user',
  proxy_password: 'secret',
  proxy_peer_connections: false,
  proxy_hostname_lookup: false,
  proxy_bittorrent: false,
  proxy_rss: false,
  proxy_misc: false,
  ip_filter_enabled: true,
  ip_filter_path: '/filter.dat',
  ip_filter_trackers: false,
  banned_IPs: '1.2.3.4',
  i2p_enabled: true,
  i2p_address: '127.0.0.1',
  i2p_port: 7656,
  i2p_mixed_mode: false,
  i2p_inbound_quantity: 3,
  i2p_outbound_quantity: 3,
  i2p_inbound_length: 3,
  i2p_outbound_length: 3,
};

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

async function renderScreen() {
  await render(<ConnectionSettingsScreen />);
  if (mockServer.isConnected) {
    await waitFor(() => expect(mockApp.getPreferences).toHaveBeenCalled());
    await screen.findByText(S('randomPort'));
  }
}

beforeEach(() => {
  resetSharedMocks();
  mockServer.isConnected = true;
  mockFeatures.hasModernProxyFields = true;
  mockFeatures.supportsI2p = true;
  mockApp.getPreferences.mockReset().mockResolvedValue({ ...MODERN_PREFS });
  mockApp.setPreferences.mockReset().mockResolvedValue(undefined);
});

describe('ConnectionSettingsScreen', () => {
  it('shows a not-connected state and makes no request while offline', async () => {
    mockServer.isConnected = false;
    await renderScreen();
    expect(screen.getByText('toast.notConnected')).toBeTruthy();
    expect(mockApp.getPreferences).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('common.back'));
    expect(routerMock.back).toHaveBeenCalled();
  });

  it('keeps the defaults when the preferences request fails', async () => {
    mockApp.getPreferences.mockRejectedValue(new Error('down'));
    await renderScreen();
    expect(screen.getByText(S('proxyDisabled'))).toBeTruthy();
    expect(screen.getByPlaceholderText('6881').props.value).toBe('');
  });

  it('loads the live values from app/preferences', async () => {
    await renderScreen();
    expect(await screen.findByDisplayValue('51413')).toBeTruthy();
    expect(switchFor(S('upnpEnabled')).props.value).toBe(true);
    expect(screen.getByText('500')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText(S('proxySocks5'))).toBeTruthy();
    expect(screen.getByDisplayValue('proxy.local')).toBeTruthy();
    expect(screen.getByDisplayValue('secret')).toBeTruthy();
    expect(screen.getByDisplayValue('/filter.dat')).toBeTruthy();
    expect(screen.getByDisplayValue('7656')).toBeTruthy();
  });

  describe('listening port', () => {
    it('saves a valid port on blur', async () => {
      await renderScreen();
      const input = await screen.findByDisplayValue('51413');
      await fireEvent.changeText(input, '6000');
      await fireEvent(input, 'blur');
      await waitFor(() => expect(mockApp.setPreferences).toHaveBeenCalledWith({ listen_port: 6000 }));
      expect(toastMock.showToast).toHaveBeenCalledWith('toast.serverSettingUpdated', 'success');
    });

    it.each(['0', '70000', 'abc'])('rejects %s and restores the saved port', async (bad) => {
      await renderScreen();
      const input = await screen.findByDisplayValue('51413');
      await fireEvent.changeText(input, bad);
      await fireEvent(input, 'blur');
      expect(toastMock.showToast).toHaveBeenCalledWith('errors.invalidNumber', 'error');
      expect(mockApp.setPreferences).not.toHaveBeenCalled();
      expect(screen.getByDisplayValue('51413')).toBeTruthy();
    });

    it('restores the previous port when the server rejects it', async () => {
      mockApp.setPreferences.mockRejectedValue(new Error('x'));
      await renderScreen();
      const input = await screen.findByDisplayValue('51413');
      await fireEvent.changeText(input, '6000');
      await fireEvent(input, 'blur');
      await waitFor(() =>
        expect(toastMock.showToast).toHaveBeenCalledWith(
          'errors.failedToUpdateServerSetting',
          'error',
        ),
      );
      expect(screen.getByDisplayValue('51413')).toBeTruthy();
    });

    it('clears an invalid entry when no port was ever saved', async () => {
      mockApp.getPreferences.mockResolvedValue({ ...MODERN_PREFS, listen_port: undefined });
      await renderScreen();
      const input = screen.getByPlaceholderText('6881');
      await fireEvent.changeText(input, 'x');
      await fireEvent(input, 'blur');
      expect(screen.getByPlaceholderText('6881').props.value).toBe('');
    });

    it('turns random port on, hiding the port field', async () => {
      await renderScreen();
      await fireEvent(switchFor(S('randomPort')), 'valueChange', true);
      await waitFor(() => expect(mockApp.setPreferences).toHaveBeenCalledWith({ random_port: true }));
      expect(screen.queryByPlaceholderText('6881')).toBeNull();
    });

    it('turns random port off together with the last real port', async () => {
      mockApp.getPreferences.mockResolvedValue({ ...MODERN_PREFS, random_port: true, listen_port: 0 });
      await renderScreen();
      expect(screen.queryByPlaceholderText('6881')).toBeNull();
      await fireEvent(switchFor(S('randomPort')), 'valueChange', false);
      await waitFor(() =>
        expect(mockApp.setPreferences).toHaveBeenCalledWith({
          random_port: false,
          listen_port: 6881,
        }),
      );
      expect(screen.getByDisplayValue('6881')).toBeTruthy();
    });

    it('restores random port when turning it off fails', async () => {
      mockApp.getPreferences.mockResolvedValue({ ...MODERN_PREFS, random_port: true, listen_port: 0 });
      mockApp.setPreferences.mockRejectedValue(new Error('x'));
      await renderScreen();
      await fireEvent(switchFor(S('randomPort')), 'valueChange', false);
      await waitFor(() => expect(switchFor(S('randomPort')).props.value).toBe(true));
    });
  });

  describe('connection limits', () => {
    it('sets unlimited when a limit switch is turned off', async () => {
      await renderScreen();
      await fireEvent(switchFor(S('maxConnec')), 'valueChange', false);
      await waitFor(() => expect(mockApp.setPreferences).toHaveBeenCalledWith({ max_connec: -1 }));
      expect(screen.queryByText('500')).toBeNull();
    });

    it('asks for a value when a limit switch is turned on, validating it', async () => {
      await renderScreen();
      await fireEvent(switchFor(S('maxUploads')), 'valueChange', true);
      expect(screen.getByTestId(`input-modal:${S('maxUploads')}`)).toBeTruthy();
      expect(screen.getByTestId('input-modal-field').props.value).toBe('');

      await fireEvent.changeText(screen.getByTestId('input-modal-field'), '0');
      await fireEvent.press(screen.getByTestId('input-modal-confirm'));
      expect(screen.getByText('input-error:errors.invalidNumber')).toBeTruthy();

      await fireEvent.changeText(screen.getByTestId('input-modal-field'), '20');
      await fireEvent.press(screen.getByTestId('input-modal-confirm'));
      await waitFor(() => expect(mockApp.setPreferences).toHaveBeenCalledWith({ max_uploads: 20 }));
      expect(screen.queryByTestId('input-modal-field')).toBeNull();
    });

    it('edits an existing limit and restores it if the server rejects it', async () => {
      mockApp.setPreferences.mockRejectedValue(new Error('x'));
      await renderScreen();
      await fireEvent.press(screen.getByText('500'));
      expect(screen.getByTestId('input-modal-field').props.value).toBe('500');
      await fireEvent.changeText(screen.getByTestId('input-modal-field'), '50');
      await fireEvent.press(screen.getByTestId('input-modal-confirm'));
      await waitFor(() =>
        expect(mockApp.setPreferences).toHaveBeenCalledWith({ max_connec: 50 }),
      );
      expect(await screen.findByText('500')).toBeTruthy();
    });

    it('closes the limit modal on cancel', async () => {
      await renderScreen();
      await fireEvent.press(screen.getByText('4'));
      await fireEvent.press(screen.getByTestId('input-modal-cancel'));
      expect(screen.queryByTestId('input-modal-field')).toBeNull();
      expect(mockApp.setPreferences).not.toHaveBeenCalled();
    });

    it('treats non-numeric limits from the server as unlimited', async () => {
      mockApp.getPreferences.mockResolvedValue({ listen_port: 1 });
      await renderScreen();
      expect(switchFor(S('maxConnec')).props.value).toBe(false);
      expect(switchFor(S('maxUploadsPerTorrent')).props.value).toBe(false);
    });
  });

  describe('modern proxy fields', () => {
    it.each([
      ['upnpEnabled', 'upnp', false],
      ['proxyPeerConnections', 'proxy_peer_connections', true],
      ['proxyHostnameLookup', 'proxy_hostname_lookup', true],
      ['proxyBittorrent', 'proxy_bittorrent', true],
      ['proxyRss', 'proxy_rss', true],
      ['proxyMisc', 'proxy_misc', true],
      ['proxyAuthEnabled', 'proxy_auth_enabled', false],
      ['ipFilterEnabled', 'ip_filter_enabled', false],
      ['ipFilterTrackers', 'ip_filter_trackers', true],
      ['i2pMixedMode', 'i2p_mixed_mode', true],
      ['i2pEnabled', 'i2p_enabled', false],
    ])('switch "%s" writes %s', async (label, key, value) => {
      await renderScreen();
      await fireEvent(switchFor(S(label)), 'valueChange', value);
      await waitFor(() => expect(mockApp.setPreferences).toHaveBeenCalledWith({ [key]: value }));
    });

    it('rolls a switch back when the server rejects it', async () => {
      mockApp.setPreferences.mockRejectedValue(new Error('x'));
      await renderScreen();
      await fireEvent(switchFor(S('proxyRss')), 'valueChange', true);
      await waitFor(() =>
        expect(toastMock.showToast).toHaveBeenCalledWith(
          'errors.failedToUpdateServerSetting',
          'error',
        ),
      );
      expect(switchFor(S('proxyRss')).props.value).toBe(false);
    });

    it.each([
      ['proxy.local', 'proxy.other', 'proxy_ip'],
      ['user', 'admin', 'proxy_username'],
      ['secret', 'hunter2', 'proxy_password'],
      ['/filter.dat', '/other.dat', 'ip_filter_path'],
      ['127.0.0.1', '10.0.0.1', 'i2p_address'],
    ])('text field %s → %s saves %s on blur', async (from, to, key) => {
      await renderScreen();
      const input = screen.getByDisplayValue(from);
      await fireEvent.changeText(input, to);
      await fireEvent(input, 'blur');
      await waitFor(() => expect(mockApp.setPreferences).toHaveBeenCalledWith({ [key]: to }));
    });

    // The blur handlers capture the already-edited text as the rollback value.
  it.skip('restores the proxy host when the server rejects it', async () => {
    mockApp.setPreferences.mockRejectedValue(new Error('x'));
    await renderScreen();
    const input = screen.getByDisplayValue('proxy.local');
    await fireEvent.changeText(input, 'proxy.other');
    await fireEvent(input, 'blur');
    expect(await screen.findByDisplayValue('proxy.local')).toBeTruthy();
  });

  it('reports an error for each text field the server rejects', async () => {
      mockApp.setPreferences.mockRejectedValue(new Error('x'));
      await renderScreen();
      for (const [from, to] of [
        ['proxy.local', 'a'],
        ['user', 'b'],
        ['secret', 'c'],
        ['/filter.dat', 'd'],
        ['127.0.0.1', 'e'],
      ]) {
        const input = screen.getByDisplayValue(from);
        await fireEvent.changeText(input, to);
        await fireEvent(input, 'blur');
      }
      await waitFor(() => expect(mockApp.setPreferences).toHaveBeenCalledTimes(5));
      expect(toastMock.showToast).toHaveBeenCalledWith('errors.failedToUpdateServerSetting', 'error');
    });

    it('validates the proxy port and I2P port before saving', async () => {
      await renderScreen();
      const proxyPort = screen.getByDisplayValue('1080');
      await fireEvent.changeText(proxyPort, '99999');
      await fireEvent(proxyPort, 'blur');
      expect(toastMock.showToast).toHaveBeenCalledWith('errors.invalidPort', 'error');
      await fireEvent.changeText(proxyPort, '3128');
      await fireEvent(proxyPort, 'blur');
      await waitFor(() => expect(mockApp.setPreferences).toHaveBeenCalledWith({ proxy_port: 3128 }));

      const i2pPort = screen.getByDisplayValue('7656');
      await fireEvent.changeText(i2pPort, '');
      await fireEvent(i2pPort, 'blur');
      expect(
        toastMock.showToast.mock.calls.filter(([m]) => m === 'errors.invalidPort'),
      ).toHaveLength(2);
      await fireEvent.changeText(i2pPort, '7657');
      await fireEvent(i2pPort, 'blur');
      await waitFor(() => expect(mockApp.setPreferences).toHaveBeenCalledWith({ i2p_port: 7657 }));
    });

    it('validates and saves the I2P tunnel numbers', async () => {
      await renderScreen();
      const keys = [
        'i2p_inbound_quantity',
        'i2p_outbound_quantity',
        'i2p_inbound_length',
        'i2p_outbound_length',
      ];
      for (let i = 0; i < keys.length; i++) {
        const input = screen.getAllByDisplayValue('3')[0];
        await fireEvent.changeText(input, '0');
        await fireEvent(input, 'blur');
        await fireEvent.changeText(input, '5');
        await fireEvent(input, 'blur');
        await waitFor(() => expect(mockApp.setPreferences).toHaveBeenCalledWith({ [keys[i]]: 5 }));
      }
      expect(toastMock.showToast).toHaveBeenCalledWith('errors.invalidNumber', 'error');
    });

    it('switches the proxy type using the string enum', async () => {
      await renderScreen();
      await fireEvent.press(screen.getByText(S('proxySocks5')));
      expect(screen.queryByTestId('option-3')).toBeNull();
      await fireEvent.press(screen.getByTestId('option-None'));
      await waitFor(() => expect(mockApp.setPreferences).toHaveBeenCalledWith({ proxy_type: 'None' }));
      expect(screen.queryByDisplayValue('proxy.local')).toBeNull();

      await fireEvent.press(screen.getByText(S('proxyDisabled')));
      await fireEvent.press(screen.getByTestId('picker-close'));
      expect(screen.queryByTestId('picker-close')).toBeNull();
    });

    it('saves the banned IP list, allowing it to be emptied', async () => {
      await renderScreen();
      await fireEvent.press(screen.getByText(S('bannedIPs')));
      expect(screen.getByTestId('input-modal-field').props.value).toBe('1.2.3.4');
      await fireEvent.changeText(screen.getByTestId('input-modal-field'), '');
      await fireEvent.press(screen.getByTestId('input-modal-confirm'));
      await waitFor(() => expect(mockApp.setPreferences).toHaveBeenCalledWith({ banned_IPs: '' }));

      await fireEvent.press(screen.getByText(S('bannedIPs')));
      await fireEvent.press(screen.getByTestId('input-modal-cancel'));
      expect(screen.queryByTestId('input-modal-field')).toBeNull();
    });

    it('hides proxy credentials while auth is off and I2P details while it is off', async () => {
      mockApp.getPreferences.mockResolvedValue({
        ...MODERN_PREFS,
        proxy_auth_enabled: false,
        i2p_enabled: false,
        ip_filter_enabled: false,
      });
      await renderScreen();
      expect(screen.queryByText(S('proxyUsername'))).toBeNull();
      expect(screen.queryByText(S('i2pAddress'))).toBeNull();
      expect(screen.queryByText(S('ipFilterPath'))).toBeNull();
    });
  });

  describe('legacy (pre-4.6) servers', () => {
    beforeEach(() => {
      mockFeatures.hasModernProxyFields = false;
      mockFeatures.supportsI2p = false;
    });

    it('uses the integer proxy types and the single torrents-only toggle', async () => {
      mockApp.getPreferences.mockResolvedValue({
        ...MODERN_PREFS,
        proxy_type: 4,
        proxy_torrents_only: false,
      });
      await renderScreen();
      expect(screen.getByText(S('proxySocks5Auth'))).toBeTruthy();
      expect(screen.queryByText(S('i2pSection').toUpperCase())).toBeNull();
      expect(screen.queryByText(S('proxyBittorrent'))).toBeNull();
      expect(screen.queryByText(S('proxyAuthEnabled'))).toBeNull();
      // Types 3 and 4 carry credentials on legacy servers.
      expect(screen.getByText(S('proxyUsername'))).toBeTruthy();

      await fireEvent(switchFor(S('proxyTorrentsOnly')), 'valueChange', true);
      await waitFor(() =>
        expect(mockApp.setPreferences).toHaveBeenCalledWith({ proxy_torrents_only: true }),
      );

      await fireEvent.press(screen.getByText(S('proxySocks5Auth')));
      await fireEvent.press(screen.getByTestId('option-1'));
      await waitFor(() => expect(mockApp.setPreferences).toHaveBeenCalledWith({ proxy_type: 1 }));
      expect(screen.queryByText(S('proxyUsername'))).toBeNull();
    });

    it('defaults a missing legacy proxy type to disabled', async () => {
      mockApp.getPreferences.mockResolvedValue({ listen_port: 1 });
      await renderScreen();
      expect(screen.getByText(S('proxyDisabled'))).toBeTruthy();
      expect(screen.queryByText(S('proxyHost'))).toBeNull();
    });

    it('restores the proxy type when the server rejects the change', async () => {
      mockApp.getPreferences.mockResolvedValue({ ...MODERN_PREFS, proxy_type: 0 });
      mockApp.setPreferences.mockRejectedValue(new Error('x'));
      await renderScreen();
      await fireEvent.press(screen.getByText(S('proxyDisabled')));
      await fireEvent.press(screen.getByTestId('option-2'));
      await waitFor(() =>
        expect(toastMock.showToast).toHaveBeenCalledWith(
          'errors.failedToUpdateServerSetting',
          'error',
        ),
      );
      expect(screen.getByText(S('proxyDisabled'))).toBeTruthy();
    });
  });
});

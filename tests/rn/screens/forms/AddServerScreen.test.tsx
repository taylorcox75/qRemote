// AddServerScreen.test.tsx — app/server/add.tsx. Shared form behaviour (validation,
// test connection, debug panel) comes from serverFormHarness; this file adds
// what only the add form does: the ServerConfig it saves, and auto-connecting
// when it is the first server.
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import AddServerScreen from '@/app/server/add';
import { ServerManager } from '@/services/server-manager';
import { useServer } from '@/context/ServerContext';
import { useToast } from '@/context/ToastContext';
import * as Clipboard from 'expo-clipboard';
import { isInsecureCertAllowlistAvailable } from '@/modules/insecure-cert-allowlist';
import { CONNECT_SUPERSEDED_MESSAGE } from '@/utils/error';
import {
  QUI_KEY,
  chooseAuthMode,
  describeSharedServerForm,
  fillPasswordServer,
  pressSave,
  toggle,
  type,
} from './serverFormHarness';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: require('./serverFormHarness').translate }),
}));
jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../components/theme-mock').mockColors, isDark: true }),
}));
jest.mock('@/context/ToastContext', () => ({ useToast: jest.fn(), ModalToast: () => null }));
jest.mock('@/context/ServerContext', () => ({ useServer: jest.fn() }));
jest.mock('@/services/server-manager', () => ({
  ServerManager: { getServers: jest.fn(), saveServer: jest.fn(), testConnection: jest.fn() },
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('@/modules/insecure-cert-allowlist', () => ({
  isInsecureCertAllowlistAvailable: jest.fn(() => true),
}));
jest.mock('@/components/FocusAwareStatusBar', () => ({ FocusAwareStatusBar: () => null }));
jest.mock('@/components/QuiProxyUrlField', () => ({
  QuiProxyUrlField: require('./serverFormHarness').QuiProxyUrlFieldStub,
}));
jest.mock('@/components/CustomHeadersSection', () => ({
  CustomHeadersSection: require('./serverFormHarness').CustomHeadersSectionStub,
}));
jest.mock('@/components/ServerAppearanceSection', () => ({
  ServerAppearanceSection: require('./serverFormHarness').ServerAppearanceSectionStub,
}));
jest.mock('@/components/OptionPicker', () => ({
  OptionPicker: require('./serverFormHarness').OptionPickerStub,
}));
jest.mock('@/components/SettingRow', () => ({
  SettingRow: require('./serverFormHarness').SettingRowStub,
}));
jest.mock('@/components/SuperDebugPanel', () => ({
  SuperDebugPanel: require('./serverFormHarness').SuperDebugPanelStub,
}));

const sm = jest.mocked(ServerManager);
const showToast = jest.fn();
const connectToServer = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useToast).mockReturnValue({ showToast } as unknown as ReturnType<typeof useToast>);
  jest
    .mocked(useServer)
    .mockReturnValue({ connectToServer } as unknown as ReturnType<typeof useServer>);
  jest.mocked(isInsecureCertAllowlistAvailable).mockReturnValue(true);
  sm.getServers.mockResolvedValue([{ id: 'existing' } as never]);
  sm.saveServer.mockResolvedValue(undefined);
  sm.testConnection.mockResolvedValue({ success: true } as never);
  connectToServer.mockResolvedValue(true);
});

const renderForm = async () => {
  await render(<AddServerScreen />);
  expect(screen.getByText('screens.settings.addServer')).toBeTruthy();
};

describeSharedServerForm('AddServerScreen', {
  renderForm,
  showToast,
  saveServer: sm.saveServer as unknown as jest.Mock,
  testConnection: sm.testConnection as unknown as jest.Mock,
  setClipboard: Clipboard.setStringAsync as unknown as jest.Mock,
  setCertAvailable: (v) => jest.mocked(isInsecureCertAllowlistAvailable).mockReturnValue(v),
});

const savedServer = () => sm.saveServer.mock.calls[0][0];

describe('AddServerScreen — saving', () => {
  it('gives a connection test its own throwaway id', async () => {
    await renderForm();
    await fillPasswordServer();
    await fireEvent.press(screen.getByText('server.testConnection'));
    await waitFor(() => expect(sm.testConnection).toHaveBeenCalled());
    expect(sm.testConnection.mock.calls[0][0].id).toMatch(/^test-\d+$/);
    expect(sm.saveServer).not.toHaveBeenCalled();
  });

  it('saves a password server with protocol stripped, port parsed and secrets as typed', async () => {
    await renderForm();
    await fillPasswordServer({ host: 'https://nas.example.com:/', port: '8080' });
    await toggle('server.useHttps', true);
    await toggle('server.allowInsecureCert', true);
    await fireEvent.press(screen.getByTestId('appearance-icon'));
    await fireEvent.press(screen.getByTestId('appearance-color'));
    await pressSave();
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(savedServer()).toEqual(
      expect.objectContaining({
        name: 'Home',
        host: 'nas.example.com',
        port: 8080,
        basePath: '/',
        username: 'admin',
        password: 'hunter2',
        bypassAuth: false,
        useApiKey: false,
        useQuiProxy: false,
        useHttps: true,
        allowInsecureCert: true,
        useBasicAuth: false,
        basicAuthUsername: '',
        basicAuthPassword: '',
        useCustomHeaders: false,
        customHeaders: [],
        useFallback: false,
        fallbackHost: '',
        fallbackPort: undefined,
        icon: 'cloud-outline',
        iconColor: '#FF0000',
      }),
    );
    expect(savedServer().id).toMatch(/^\d+$/);
    expect(showToast).toHaveBeenCalledWith('toast.serverSaved', 'success');
    // Not the first server → no auto-connect.
    expect(connectToServer).not.toHaveBeenCalled();
  });

  it('never keeps the self-signed opt-in for a plain HTTP server', async () => {
    await renderForm();
    await fillPasswordServer();
    await toggle('server.useHttps', true);
    await toggle('server.allowInsecureCert', true);
    await toggle('server.useHttps', false);
    await pressSave();
    await waitFor(() => expect(sm.saveServer).toHaveBeenCalled());
    expect(savedServer()).toEqual(
      expect.objectContaining({ useHttps: false, allowInsecureCert: false }),
    );
  });

  it('saves Basic Auth, sanitized custom headers and a fallback endpoint', async () => {
    await renderForm();
    await fillPasswordServer();
    await toggle('server.useBasicAuth', true);
    await type('placeholders.proxyUsername', ' proxyuser ');
    await type('placeholders.proxyPassword', 'proxypass');
    await fireEvent.press(screen.getByTestId('headers-toggle'));
    await fireEvent.press(screen.getByTestId('headers-valid'));
    await toggle('server.useFallback', true);
    await type('placeholders.fallbackHost', 'http://vpn.example.com/');
    await fireEvent.changeText(
      screen.getAllByPlaceholderText('placeholders.portOptional')[1],
      '9090',
    );
    await toggle('server.fallbackUseHttps', true);
    await pressSave();
    await waitFor(() => expect(sm.saveServer).toHaveBeenCalled());
    expect(savedServer()).toEqual(
      expect.objectContaining({
        useBasicAuth: true,
        basicAuthUsername: 'proxyuser',
        basicAuthPassword: 'proxypass',
        useCustomHeaders: true,
        customHeaders: [{ key: 'X-Token', value: 'secret' }],
        useFallback: true,
        fallbackHost: 'vpn.example.com',
        fallbackPort: 9090,
        fallbackUseHttps: true,
        fallbackBasePath: undefined,
      }),
    );
  });

  it('drops Basic Auth and credentials in API-key mode', async () => {
    await renderForm();
    await fillPasswordServer();
    await toggle('server.useBasicAuth', true);
    await type('placeholders.proxyUsername', 'proxyuser');
    await chooseAuthMode('apiKey');
    await type('placeholders.apiKey', ' key-123 ');
    await pressSave();
    await waitFor(() => expect(sm.saveServer).toHaveBeenCalled());
    expect(savedServer()).toEqual(
      expect.objectContaining({
        useApiKey: true,
        apiKey: 'key-123',
        username: '',
        password: '',
        useBasicAuth: false,
        basicAuthUsername: '',
      }),
    );
  });

  it('saves a no-auth server without requiring credentials', async () => {
    await renderForm();
    await type('placeholders.serverName', 'Open');
    await type('placeholders.ipDomain', '10.0.0.5');
    await chooseAuthMode('none');
    await pressSave();
    await waitFor(() => expect(sm.saveServer).toHaveBeenCalled());
    expect(savedServer()).toEqual(
      expect.objectContaining({ bypassAuth: true, username: '', port: undefined }),
    );
  });

  it('saves a qui proxy server and its fallback, reusing the primary key', async () => {
    await renderForm();
    await type('placeholders.serverName', 'qui');
    await chooseAuthMode('quiProxy');
    await fireEvent.changeText(
      screen.getByTestId('qui-url'),
      `https://qui.example.com/qui/proxy/${QUI_KEY}`,
    );
    await toggle('server.useFallback', true);
    await fireEvent.changeText(
      screen.getByTestId('qui-url-fallback'),
      `http://10.0.0.2:7476/proxy/${QUI_KEY}`,
    );
    // In qui mode the scheme comes from the URL, so only the cert opt-in shows.
    expect(screen.queryByTestId('row-server.useHttps')).toBeNull();
    expect(screen.getByTestId('row-server.allowInsecureCert')).toBeTruthy();
    await pressSave();
    await waitFor(() => expect(sm.saveServer).toHaveBeenCalled());
    expect(savedServer()).toEqual(
      expect.objectContaining({
        host: 'qui.example.com',
        port: undefined,
        basePath: '/qui',
        useHttps: true,
        useQuiProxy: true,
        quiProxyKey: QUI_KEY,
        useFallback: true,
        fallbackHost: '10.0.0.2',
        fallbackPort: 7476,
        fallbackUseHttps: false,
        fallbackBasePath: '/',
      }),
    );
  });

  it('auto-connects the first server and warns when that connect fails', async () => {
    sm.getServers.mockResolvedValue([]);
    connectToServer.mockResolvedValue(false);
    await renderForm();
    await fillPasswordServer();
    await pressSave();
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(connectToServer).toHaveBeenCalledWith(savedServer());
    expect(showToast).toHaveBeenCalledWith('toast.connectionFailedCheck', 'warning');
  });

  it('reports a thrown connect error for the first server and still closes', async () => {
    sm.getServers.mockResolvedValue([]);
    connectToServer.mockRejectedValue(new Error('Connection refused'));
    await renderForm();
    await fillPasswordServer();
    await pressSave();
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(showToast).toHaveBeenCalledWith(
      'errors.connectionFailedManual(Connection refused)',
      'warning',
    );
  });

  it('stays silent when the first connect is superseded by a newer one', async () => {
    sm.getServers.mockResolvedValue([]);
    connectToServer.mockRejectedValue(new Error(CONNECT_SUPERSEDED_MESSAGE));
    await renderForm();
    await fillPasswordServer();
    await pressSave();
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(showToast).not.toHaveBeenCalledWith(expect.anything(), 'warning');
  });

  it('shows an error and stays open when saving fails', async () => {
    sm.saveServer.mockRejectedValue(new Error('disk full'));
    await renderForm();
    await fillPasswordServer();
    await pressSave();
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('errors.failedToSaveServer', 'error'),
    );
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByText('common.save')).toBeTruthy();
  });

  it('closes without saving from the header Cancel', async () => {
    await renderForm();
    await fireEvent.press(screen.getAllByText('common.cancel')[0]);
    expect(mockBack).toHaveBeenCalled();
    expect(sm.saveServer).not.toHaveBeenCalled();
  });
});

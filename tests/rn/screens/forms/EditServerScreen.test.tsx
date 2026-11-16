// EditServerScreen.test.tsx — app/server/[id].tsx. Shared form behaviour comes
// from serverFormHarness (run against a loaded but blank record); this file adds
// what only the edit form does: loading a stored server into the form,
// preserving fields the form doesn't show, disconnecting/updating the current
// server on save, and delete.
import React from 'react';
import { Alert } from 'react-native';
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import EditServerScreen from '@/app/server/[id]';
import { ServerManager } from '@/services/server-manager';
import { useServer } from '@/context/ServerContext';
import { useToast } from '@/context/ToastContext';
import * as Clipboard from 'expo-clipboard';
import { isInsecureCertAllowlistAvailable } from '@/modules/insecure-cert-allowlist';
import type { ServerConfig } from '@/types/api';
import {
  QUI_KEY,
  chooseAuthMode,
  describeSharedServerForm,
  pressSave,
  switchFor,
  type,
} from './serverFormHarness';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ id: 's1' }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: require('./serverFormHarness').translate }),
}));
jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../components/theme-mock').mockColors, isDark: false }),
}));
jest.mock('@/context/ToastContext', () => ({ useToast: jest.fn(), ModalToast: () => null }));
jest.mock('@/context/ServerContext', () => ({ useServer: jest.fn() }));
jest.mock('@/services/server-manager', () => ({
  ServerManager: {
    getServer: jest.fn(),
    saveServer: jest.fn(),
    deleteServer: jest.fn(),
    testConnection: jest.fn(),
  },
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
const server = {
  currentServer: null as ServerConfig | null,
  disconnect: jest.fn(),
  forgetCurrentServer: jest.fn(),
  updateCurrentServer: jest.fn(),
};

const BLANK: ServerConfig = { id: 's1', name: '', host: '', username: '', password: '' };

const STORED: ServerConfig = {
  id: 's1',
  name: 'Seedbox',
  host: 'seed.example.com',
  port: 8443,
  basePath: '/qbt',
  username: 'admin',
  password: 'pw',
  useHttps: true,
  allowInsecureCert: true,
  useBasicAuth: true,
  basicAuthUsername: 'gate',
  basicAuthPassword: 'gatepw',
  useCustomHeaders: true,
  customHeaders: [{ key: 'X-Auth', value: 'token' }],
  useFallback: true,
  fallbackHost: '10.0.0.9',
  fallbackPort: 8080,
  fallbackUseHttps: false,
  fallbackBasePath: '/alt',
  icon: 'server-outline',
  iconColor: '#00AA00',
};

beforeEach(() => {
  jest.clearAllMocks();
  server.currentServer = null;
  jest.mocked(useToast).mockReturnValue({ showToast } as unknown as ReturnType<typeof useToast>);
  jest.mocked(useServer).mockReturnValue(server as unknown as ReturnType<typeof useServer>);
  jest.mocked(isInsecureCertAllowlistAvailable).mockReturnValue(true);
  sm.getServer.mockResolvedValue({ ...BLANK });
  sm.saveServer.mockResolvedValue(undefined);
  sm.deleteServer.mockResolvedValue(undefined);
  sm.testConnection.mockResolvedValue({ success: true } as never);
  server.disconnect.mockResolvedValue(undefined);
});

const renderForm = async () => {
  await render(<EditServerScreen />);
  expect(await screen.findByText('server.editServer')).toBeTruthy();
};

it('closes from the header Cancel without saving', async () => {
  await renderForm();
  await fireEvent.press(screen.getAllByText('common.cancel')[0]);
  expect(mockBack).toHaveBeenCalled();
  expect(sm.saveServer).not.toHaveBeenCalled();
});

describeSharedServerForm('EditServerScreen', {
  renderForm,
  showToast,
  saveServer: sm.saveServer as unknown as jest.Mock,
  testConnection: sm.testConnection as unknown as jest.Mock,
  setClipboard: Clipboard.setStringAsync as unknown as jest.Mock,
  setCertAvailable: (v) => jest.mocked(isInsecureCertAllowlistAvailable).mockReturnValue(v),
});

const savedServer = () => sm.saveServer.mock.calls[0][0];

describe('EditServerScreen — loading', () => {
  it('loads the stored server by id into every field', async () => {
    sm.getServer.mockResolvedValue({ ...STORED });
    await renderForm();
    expect(sm.getServer).toHaveBeenCalledWith('s1');
    expect(screen.getByPlaceholderText('placeholders.serverName').props.value).toBe('Seedbox');
    expect(screen.getByPlaceholderText('placeholders.ipDomain').props.value).toBe(
      'seed.example.com',
    );
    const ports = screen.getAllByPlaceholderText('placeholders.portOptional');
    expect(ports[0].props.value).toBe('8443');
    expect(ports[1].props.value).toBe('8080');
    expect(screen.getByPlaceholderText('placeholders.username').props.value).toBe('admin');
    expect(screen.getByPlaceholderText('placeholders.proxyUsername').props.value).toBe('gate');
    expect(screen.getByPlaceholderText('placeholders.fallbackHost').props.value).toBe('10.0.0.9');
    expect(switchFor('server.useHttps').props.value).toBe(true);
    expect(switchFor('server.allowInsecureCert').props.value).toBe(true);
    expect(screen.getByTestId('headers-state')).toHaveTextContent('on:X-Auth');
    expect(screen.getByTestId('appearance-state')).toHaveTextContent('server-outline|#00AA00');
  });

  it('round-trips the hidden base paths and secrets on save, and updates the current server', async () => {
    sm.getServer.mockResolvedValue({ ...STORED });
    await renderForm();
    await pressSave();
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(savedServer()).toEqual(
      expect.objectContaining({
        id: 's1',
        name: 'Seedbox',
        host: 'seed.example.com',
        port: 8443,
        basePath: '/qbt',
        password: 'pw',
        useHttps: true,
        allowInsecureCert: true,
        basicAuthUsername: 'gate',
        basicAuthPassword: 'gatepw',
        customHeaders: [{ key: 'X-Auth', value: 'token' }],
        fallbackHost: '10.0.0.9',
        fallbackPort: 8080,
        fallbackBasePath: '/alt',
        icon: 'server-outline',
        iconColor: '#00AA00',
      }),
    );
    expect(server.updateCurrentServer).toHaveBeenCalledWith(savedServer());
    // Not the connected server → no disconnect.
    expect(server.disconnect).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('toast.serverSaved', 'success');
  });

  it('tests against the stored base paths a real connect would use', async () => {
    sm.getServer.mockResolvedValue({ ...STORED });
    await renderForm();
    await fireEvent.press(screen.getByText('server.testConnection'));
    await waitFor(() => expect(sm.testConnection).toHaveBeenCalled());
    expect(sm.testConnection.mock.calls[0][0]).toEqual(
      expect.objectContaining({ basePath: '/qbt', fallbackBasePath: '/alt', id: 's1' }),
    );
  });

  it('disconnects first when editing the connected server', async () => {
    sm.getServer.mockResolvedValue({ ...STORED });
    server.currentServer = { ...STORED };
    await renderForm();
    await pressSave();
    await waitFor(() => expect(sm.saveServer).toHaveBeenCalled());
    expect(server.disconnect).toHaveBeenCalled();
    expect(server.disconnect.mock.invocationCallOrder[0]).toBeLessThan(
      sm.saveServer.mock.invocationCallOrder[0],
    );
  });

  it('defaults a legacy record without optional fields', async () => {
    sm.getServer.mockResolvedValue({ id: 's1', name: 'Old', host: 'old.lan' } as ServerConfig);
    await renderForm();
    await type('placeholders.username', 'u');
    await type('placeholders.password', 'p');
    await pressSave();
    await waitFor(() => expect(sm.saveServer).toHaveBeenCalled());
    expect(savedServer()).toEqual(
      expect.objectContaining({
        port: undefined,
        basePath: '/',
        useHttps: false,
        useFallback: false,
        fallbackBasePath: undefined,
        icon: undefined,
      }),
    );
  });

  it('rebuilds the qui URL (and fallback URL) for a qui server', async () => {
    sm.getServer.mockResolvedValue({
      id: 's1',
      name: 'qui',
      host: 'qui.example.com',
      useHttps: true,
      basePath: '/qui',
      useQuiProxy: true,
      quiProxyKey: QUI_KEY,
      useFallback: true,
      fallbackHost: '10.0.0.2',
      fallbackPort: 7476,
      fallbackUseHttps: false,
    } as ServerConfig);
    await renderForm();
    expect(screen.getByTestId('qui-url').props.value).toBe(
      `https://qui.example.com/qui/proxy/${QUI_KEY}`,
    );
    expect(screen.getByTestId('qui-url-fallback').props.value).toBe(
      `http://10.0.0.2:7476/qui/proxy/${QUI_KEY}`,
    );
    await pressSave();
    await waitFor(() => expect(sm.saveServer).toHaveBeenCalled());
    expect(savedServer()).toEqual(
      expect.objectContaining({
        useQuiProxy: true,
        quiProxyKey: QUI_KEY,
        basePath: '/qui',
        fallbackHost: '10.0.0.2',
        fallbackBasePath: '/qui',
      }),
    );
  });

  it('shows the auth mode a legacy no-auth record derives to', async () => {
    sm.getServer.mockResolvedValue({ ...BLANK, bypassAuth: true });
    await renderForm();
    expect(screen.getByText('server.authMethodNone')).toBeTruthy();
    await chooseAuthMode('password');
    expect(screen.getByPlaceholderText('placeholders.username')).toBeTruthy();
  });

  it('closes with a toast when the server no longer exists', async () => {
    sm.getServer.mockResolvedValue(null);
    await render(<EditServerScreen />);
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(showToast).toHaveBeenCalledWith('toast.serverNotFound', 'error');
  });

  it('closes with a toast when loading fails', async () => {
    sm.getServer.mockRejectedValue(new Error('storage'));
    await render(<EditServerScreen />);
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(showToast).toHaveBeenCalledWith('errors.failedToLoadServer', 'error');
  });

  it('shows an error and stays open when saving fails', async () => {
    sm.getServer.mockResolvedValue({ ...STORED });
    sm.saveServer.mockRejectedValue(new Error('disk full'));
    await renderForm();
    await pressSave();
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('errors.failedToSaveServer', 'error'),
    );
    expect(mockBack).not.toHaveBeenCalled();
    expect(server.updateCurrentServer).not.toHaveBeenCalled();
  });
});

describe('EditServerScreen — delete', () => {
  const confirmDelete = async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await fireEvent.press(screen.getAllByText('server.deleteServer')[0]);
    expect(alertSpy).toHaveBeenCalledWith(
      'server.deleteServer',
      'server.deleteServerConfirm(Seedbox)',
      expect.any(Array),
    );
    const buttons = alertSpy.mock.calls[0][2] as { style?: string; onPress?: () => unknown }[];
    await act(async () => {
      await buttons.find((b) => b.style === 'destructive')!.onPress!();
    });
    alertSpy.mockRestore();
  };

  it('deletes after confirmation and closes', async () => {
    sm.getServer.mockResolvedValue({ ...STORED });
    await renderForm();
    await confirmDelete();
    expect(sm.deleteServer).toHaveBeenCalledWith('s1');
    expect(server.forgetCurrentServer).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('toast.serverDeleted(Seedbox)', 'success');
    expect(mockBack).toHaveBeenCalled();
  });

  it('forgets the remembered server when deleting the current one', async () => {
    sm.getServer.mockResolvedValue({ ...STORED });
    server.currentServer = { ...STORED };
    await renderForm();
    await confirmDelete();
    expect(server.forgetCurrentServer).toHaveBeenCalled();
  });

  it('reports a failed delete and stays open', async () => {
    sm.getServer.mockResolvedValue({ ...STORED });
    sm.deleteServer.mockRejectedValue(new Error('locked'));
    await renderForm();
    await confirmDelete();
    expect(showToast).toHaveBeenCalledWith('errors.failedToDeleteServer', 'error');
    expect(mockBack).not.toHaveBeenCalled();
  });
});

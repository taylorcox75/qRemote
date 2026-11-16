// SearchPluginsScreen.test.tsx — app/search/plugins.tsx: listing installed
// search plugins, enable/disable, uninstall (native confirm), install from URL,
// update-all, and the "Search + opens add dialogue" preference toggle.
import React from 'react';
import { Alert } from 'react-native';
import { act, render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PluginsScreen from '@/app/search/plugins';
import type { SearchPlugin } from '@/types/api';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => cb(), []);
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { name?: string }) => (opts?.name ? `${key}:${opts.name}` : key),
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../components/theme-mock').mockColors, isDark: false }),
}));

const mockShowToast = jest.fn();
jest.mock('@/context/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

let mockIsConnected = true;
jest.mock('@/context/ServerContext', () => ({
  useServer: () => ({ isConnected: mockIsConnected }),
}));

jest.mock('@/components/FocusAwareStatusBar', () => ({ FocusAwareStatusBar: () => null }));

const mockGetPlugins = jest.fn();
const mockEnablePlugin = jest.fn();
const mockUninstallPlugin = jest.fn();
const mockInstallPlugin = jest.fn();
const mockUpdatePlugins = jest.fn();
jest.mock('@/services/api/search', () => ({
  searchApi: {
    getPlugins: (...a: unknown[]) => mockGetPlugins(...a),
    enablePlugin: (...a: unknown[]) => mockEnablePlugin(...a),
    uninstallPlugin: (...a: unknown[]) => mockUninstallPlugin(...a),
    installPlugin: (...a: unknown[]) => mockInstallPlugin(...a),
    updatePlugins: (...a: unknown[]) => mockUpdatePlugins(...a),
  },
}));

const mockGetPreferences = jest.fn();
const mockSavePreferences = jest.fn();
jest.mock('@/services/storage', () => ({
  storageService: {
    getPreferences: (...a: unknown[]) => mockGetPreferences(...a),
    savePreferences: (...a: unknown[]) => mockSavePreferences(...a),
  },
}));

const plugin = (over: Partial<SearchPlugin>): SearchPlugin =>
  ({
    name: 'piratebay',
    fullName: 'The Pirate Bay',
    version: '3.1',
    enabled: true,
    url: 'https://example.com',
    supportedCategories: [],
    ...over,
  }) as SearchPlugin;

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PluginsScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsConnected = true;
  mockGetPlugins.mockResolvedValue([
    plugin({}),
    plugin({ name: 'eztv', fullName: 'EZTV', enabled: false, version: '' }),
  ]);
  mockGetPreferences.mockResolvedValue({ theme: 'dark' });
  mockSavePreferences.mockResolvedValue(undefined);
  mockEnablePlugin.mockResolvedValue(undefined);
  mockUninstallPlugin.mockResolvedValue(undefined);
  mockInstallPlugin.mockResolvedValue(undefined);
  mockUpdatePlugins.mockResolvedValue(undefined);
});

describe('PluginsScreen', () => {
  it('lists installed plugins with their version and internal name', async () => {
    await renderScreen();
    expect(await screen.findByText('The Pirate Bay')).toBeTruthy();
    expect(screen.getByText('EZTV')).toBeTruthy();
    expect(screen.getByText('v3.1 · piratebay')).toBeTruthy();
    // A plugin without a version shows a placeholder.
    expect(screen.getByText('v? · eztv')).toBeTruthy();
  });

  it('shows the empty state when no plugins are installed', async () => {
    mockGetPlugins.mockResolvedValue([]);
    await renderScreen();
    expect(await screen.findByText('screens.search.noPluginsTitle')).toBeTruthy();
  });

  it('shows the not-connected state and never queries the server when disconnected', async () => {
    mockIsConnected = false;
    await renderScreen();
    expect(await screen.findByText('toast.notConnected')).toBeTruthy();
    expect(mockGetPlugins).not.toHaveBeenCalled();
  });

  it('goes back from the header button', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('common.back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('toggles a plugin to the opposite of its enabled state and refetches', async () => {
    await renderScreen();
    await screen.findByText('EZTV');
    const switches = screen.getAllByRole('switch');
    const fetchesBefore = mockGetPlugins.mock.calls.length;
    // [0] is the preference toggle; [1] piratebay (enabled), [2] eztv (disabled).
    await fireEvent(switches[2], 'valueChange', true);
    await waitFor(() => expect(mockEnablePlugin).toHaveBeenCalledWith('eztv', true));
    await waitFor(() => expect(mockGetPlugins.mock.calls.length).toBeGreaterThan(fetchesBefore));
  });

  it('shows an error toast when enabling a plugin fails', async () => {
    mockEnablePlugin.mockRejectedValue(new Error('Forbidden'));
    await renderScreen();
    await screen.findByText('EZTV');
    const switches = screen.getAllByRole('switch');
    await fireEvent(switches[1], 'valueChange', false);
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('Forbidden', 'error'));
    expect(mockEnablePlugin).toHaveBeenCalledWith('piratebay', false);
  });

  it('uninstalls only after the destructive confirm button is pressed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen();
    await screen.findByText('EZTV');
    await fireEvent.press(screen.getAllByLabelText('common.delete')[0]);
    expect(alertSpy).toHaveBeenCalledWith(
      'screens.search.uninstallTitle',
      'screens.search.uninstallConfirm:The Pirate Bay',
      expect.any(Array),
    );
    expect(mockUninstallPlugin).not.toHaveBeenCalled();
    const buttons = alertSpy.mock.calls[0][2] as { style?: string; onPress?: () => unknown }[];
    await act(async () => {
      await buttons.find((b) => b.style === 'destructive')!.onPress!();
    });
    expect(mockUninstallPlugin).toHaveBeenCalledWith('piratebay');
    expect(mockShowToast).toHaveBeenCalledWith('screens.search.uninstalledToast', 'success');
    alertSpy.mockRestore();
  });

  it('reports an uninstall failure', async () => {
    mockUninstallPlugin.mockRejectedValue(new Error('nope'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen();
    await screen.findByText('EZTV');
    await fireEvent.press(screen.getAllByLabelText('common.delete')[1]);
    const buttons = alertSpy.mock.calls[0][2] as { style?: string; onPress?: () => unknown }[];
    await act(async () => {
      await buttons.find((b) => b.style === 'destructive')!.onPress!();
    });
    expect(mockUninstallPlugin).toHaveBeenCalledWith('eztv');
    expect(mockShowToast).toHaveBeenCalledWith('nope', 'error');
    alertSpy.mockRestore();
  });

  it('installs a plugin from the trimmed URL entered in the modal', async () => {
    await renderScreen();
    await screen.findByText('EZTV');
    await fireEvent.press(screen.getByText('screens.search.installPlugin'));
    await fireEvent.changeText(
      screen.getByPlaceholderText('screens.search.installPluginPlaceholder'),
      '  https://example.com/plugin.py  ',
    );
    await fireEvent.press(screen.getByText('common.confirm'));
    await waitFor(() =>
      expect(mockInstallPlugin).toHaveBeenCalledWith('https://example.com/plugin.py'),
    );
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('screens.search.installedToast', 'success'),
    );
  });

  it('does not call install for a blank URL', async () => {
    await renderScreen();
    await screen.findByText('EZTV');
    await fireEvent.press(screen.getByText('screens.search.installPlugin'));
    await fireEvent.changeText(
      screen.getByPlaceholderText('screens.search.installPluginPlaceholder'),
      '   ',
    );
    await fireEvent.press(screen.getByText('common.confirm'));
    // The modal stays open and nothing is sent to the server.
    expect(screen.getByPlaceholderText('screens.search.installPluginPlaceholder')).toBeTruthy();
    expect(mockInstallPlugin).not.toHaveBeenCalled();
  });

  it('reports an install failure', async () => {
    mockInstallPlugin.mockRejectedValue(new Error('bad url'));
    await renderScreen();
    await screen.findByText('EZTV');
    await fireEvent.press(screen.getByText('screens.search.installPlugin'));
    await fireEvent.changeText(
      screen.getByPlaceholderText('screens.search.installPluginPlaceholder'),
      'x',
    );
    await fireEvent.press(screen.getByText('common.confirm'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('bad url', 'error'));
  });

  it('starts an update of all plugins and reports success or failure', async () => {
    await renderScreen();
    await screen.findByText('EZTV');
    await fireEvent.press(screen.getByText('screens.search.updateAll'));
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('screens.search.updateStartedToast', 'success'),
    );
    expect(mockUpdatePlugins).toHaveBeenCalledTimes(1);

    mockUpdatePlugins.mockRejectedValueOnce(new Error('offline'));
    await fireEvent.press(screen.getByText('screens.search.updateAll'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('offline', 'error'));
  });

  it('reads the add-dialogue preference and persists a change without dropping other keys', async () => {
    mockGetPreferences.mockResolvedValue({ theme: 'dark', searchAddOpensDialogue: false });
    await renderScreen();
    await screen.findByText('EZTV');
    const prefSwitch = screen.getAllByRole('switch')[0];
    await waitFor(() => expect(prefSwitch.props.value).toBe(false));
    await fireEvent(prefSwitch, 'valueChange', true);
    await waitFor(() =>
      expect(mockSavePreferences).toHaveBeenCalledWith({
        theme: 'dark',
        searchAddOpensDialogue: true,
      }),
    );
  });

  it('defaults the add-dialogue preference to on when preferences cannot be read', async () => {
    mockGetPreferences.mockRejectedValue(new Error('storage'));
    await renderScreen();
    await screen.findByText('EZTV');
    const prefSwitch = screen.getAllByRole('switch')[0];
    expect(prefSwitch.props.value).toBe(true);
  });
});

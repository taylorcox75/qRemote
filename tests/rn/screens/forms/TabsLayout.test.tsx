// TabsLayout.test.tsx — app/(tabs)/_layout.tsx: which navigator mounts (JS tab
// bar vs. the Liquid Glass native tabs), and the RSS tab gating in each
// (connected AND rss_processing_enabled; the native tab is held steady through
// transient states and ignores preferences fetched before this connection).
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TabsLayout from '@/app/(tabs)/_layout';

type TabsScreenProps = {
  name: string;
  options: {
    href?: null;
    title: string;
    tabBarIcon: (p: { color: string; focused: boolean; size: number }) => React.ReactNode;
  };
};
type TriggerProps = { name: string; hidden?: boolean; children?: React.ReactNode };

jest.mock('expo-router', () => {
  const RN = require('react-native');
  const Tabs = ({ children }: { children: React.ReactNode }) => (
    <RN.View testID="js-tabs">{children}</RN.View>
  );
  Tabs.Screen = ({ name, options }: TabsScreenProps) => (
    <RN.View>
      <RN.Text testID={`js-tab-${name}`}>
        {`${options.title}|${options.href === null ? 'hidden' : 'shown'}`}
      </RN.Text>
      <RN.View testID={`js-tab-icon-focused-${name}`}>
        {options.tabBarIcon({ color: '#111111', focused: true, size: 24 })}
      </RN.View>
      <RN.View testID={`js-tab-icon-${name}`}>
        {options.tabBarIcon({ color: '#222222', focused: false, size: 24 })}
      </RN.View>
    </RN.View>
  );
  return { Tabs };
});

jest.mock('expo-router/native-tabs', () => {
  const RN = require('react-native');
  const NativeTabs = ({ children }: { children: React.ReactNode }) => (
    <RN.View testID="native-tabs">{children}</RN.View>
  );
  const Trigger = ({ name, hidden, children }: TriggerProps) => (
    <RN.View testID={`native-tab-${name}`} accessibilityHint={hidden ? 'hidden' : 'shown'}>
      {children}
    </RN.View>
  );
  Trigger.Icon = () => null;
  Trigger.Label = ({ children }: { children: React.ReactNode }) => <RN.Text>{children}</RN.Text>;
  NativeTabs.Trigger = Trigger;
  return { NativeTabs };
});

jest.mock('@expo/vector-icons', () => {
  const RN = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <RN.Text>{`icon:${name}`}</RN.Text> };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../components/theme-mock').mockColors }),
}));

let mockServer: {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  connectedAt: Date | null;
};
jest.mock('@/context/ServerContext', () => ({
  useServer: () => mockServer,
}));

let mockGlass = { tabBarGlass: false, loaded: true };
jest.mock('@/context/LiquidGlassContext', () => ({
  useLiquidGlass: () => mockGlass,
}));

const mockGetPreferences = jest.fn();
jest.mock('@/services/api/application', () => ({
  applicationApi: { getPreferences: (...a: unknown[]) => mockGetPreferences(...a) },
}));

let client: QueryClient;
const ui = () => (
  <QueryClientProvider client={client}>
    <TabsLayout />
  </QueryClientProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockServer = {
    isConnected: true,
    isConnecting: false,
    isReconnecting: false,
    connectedAt: new Date(Date.now() - 1000),
  };
  mockGlass = { tabBarGlass: false, loaded: true };
  mockGetPreferences.mockResolvedValue({ rss_processing_enabled: true });
});

afterEach(() => client.clear());

describe('TabsLayout — JS tab bar', () => {
  it('renders the five tabs and shows RSS once the server reports RSS processing on', async () => {
    await render(ui());
    expect(screen.getByTestId('js-tabs')).toBeTruthy();
    expect(screen.queryByTestId('native-tabs')).toBeNull();
    for (const name of ['(torrents)', 'transfer', 'search', 'settings']) {
      expect(screen.getByTestId(`js-tab-${name}`)).toBeTruthy();
    }
    await waitFor(() =>
      expect(screen.getByTestId('js-tab-rss')).toHaveTextContent('screens.rss.feedsTitle|shown'),
    );
    expect(mockGetPreferences).toHaveBeenCalledTimes(1);
  });

  it('switches each tab icon to its filled variant when focused', async () => {
    await render(ui());
    const iconName = (testID: string) => {
      const text = screen.getByTestId(testID).children[0] as { children: string[] };
      return text.children.join('').replace('icon:', '');
    };
    expect(iconName('js-tab-icon-focused-(torrents)')).toBe('list');
    expect(iconName('js-tab-icon-(torrents)')).toBe('list-outline');
    expect(iconName('js-tab-icon-focused-transfer')).toBe('speedometer');
    expect(iconName('js-tab-icon-search')).toBe('search-outline');
    expect(iconName('js-tab-icon-rss')).toBe('logo-rss');
    expect(iconName('js-tab-icon-focused-settings')).toBe('settings');
    expect(iconName('js-tab-icon-settings')).toBe('settings-outline');
  });

  it('hides RSS when the server has RSS processing off', async () => {
    mockGetPreferences.mockResolvedValue({ rss_processing_enabled: false });
    await render(ui());
    await waitFor(() => expect(mockGetPreferences).toHaveBeenCalled());
    expect(screen.getByTestId('js-tab-rss')).toHaveTextContent(/hidden$/);
  });

  it('hides RSS and never fetches preferences while disconnected', async () => {
    mockServer.isConnected = false;
    await render(ui());
    expect(screen.getByTestId('js-tab-rss')).toHaveTextContent(/hidden$/);
    expect(mockGetPreferences).not.toHaveBeenCalled();
  });
});

describe('TabsLayout — Liquid Glass native tabs', () => {
  beforeEach(() => {
    mockGlass = { tabBarGlass: true, loaded: true };
  });

  it('renders a plain placeholder until the glass preference has loaded', async () => {
    mockGlass = { tabBarGlass: true, loaded: false };
    await render(ui());
    expect(screen.queryByTestId('native-tabs')).toBeNull();
    expect(screen.queryByTestId('js-tabs')).toBeNull();
  });

  it('shows the RSS tab once preferences for this connection say RSS is on', async () => {
    await render(ui());
    expect(screen.getByTestId('native-tabs')).toBeTruthy();
    expect(screen.getByText('screens.settings.title')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId('native-tab-rss').props.accessibilityHint).toBe('shown'),
    );
  });

  it('ignores preferences fetched before the current connection began', async () => {
    // Data is in the cache already, but it predates connectedAt.
    client.setQueryData(['application', 'preferences'], { rss_processing_enabled: true });
    mockServer.connectedAt = new Date(Date.now() + 60_000);
    mockGetPreferences.mockReturnValue(new Promise(() => {}));
    await render(ui());
    expect(screen.getByTestId('native-tab-rss').props.accessibilityHint).toBe('hidden');
  });

  it('keeps the RSS tab through a reconnect and drops it on a settled disconnect', async () => {
    const view = await render(ui());
    await waitFor(() =>
      expect(screen.getByTestId('native-tab-rss').props.accessibilityHint).toBe('shown'),
    );

    mockServer = { ...mockServer, isConnected: false, isReconnecting: true };
    await view.rerender(ui());
    expect(screen.getByTestId('native-tab-rss').props.accessibilityHint).toBe('shown');

    mockServer = { ...mockServer, isConnected: false, isReconnecting: false };
    await view.rerender(ui());
    expect(screen.getByTestId('native-tab-rss').props.accessibilityHint).toBe('hidden');
  });
});

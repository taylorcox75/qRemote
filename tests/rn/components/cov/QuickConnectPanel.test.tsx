import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { QuickConnectPanel } from '@/components/QuickConnectPanel';
import { ServerConfig } from '@/types/api';

jest.mock('@/context/ThemeContext', () => require('@/tests/rn/components/cov/mocks').themeModule);
jest.mock('react-i18next', () => require('@/tests/rn/components/cov/mocks').i18nModule);
jest.mock(
  '@/components/FocusAwareStatusBar',
  () => require('@/tests/rn/components/cov/mocks').focusAwareStatusBarModule,
);

const server = (o: Partial<ServerConfig>): ServerConfig => ({
  id: 's1',
  name: 'Home',
  host: '10.0.0.2',
  port: 8080,
  username: 'admin',
  password: '',
  ...o,
});

const baseProps = {
  serversLoaded: true,
  connectingId: null as string | null,
  connectErrors: {} as Record<string, string>,
  onConnect: jest.fn(),
  onAddServer: jest.fn(),
};

describe('QuickConnectPanel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the empty state with an add button when there are no servers', async () => {
    await render(<QuickConnectPanel {...baseProps} savedServers={[]} />);
    expect(screen.getByText('screens.torrents.notConnected')).toBeTruthy();
    await fireEvent.press(screen.getByText('screens.settings.addServer'));
    expect(baseProps.onAddServer).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state while servers are still loading', async () => {
    await render(
      <QuickConnectPanel {...baseProps} serversLoaded={false} savedServers={[server({})]} />,
    );
    expect(screen.queryByText('Home')).toBeNull();
    expect(screen.getByText('screens.settings.addServer')).toBeTruthy();
  });

  it('lists servers with their addresses and connects on tap', async () => {
    const a = server({ id: 'a', name: 'Home', useHttps: true, host: 'home.lan', port: 443 });
    const b = server({ id: 'b', name: 'Seedbox', host: 'seed.example', port: 9091 });
    await render(<QuickConnectPanel {...baseProps} savedServers={[a, b]} />);
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Seedbox')).toBeTruthy();
    expect(screen.getByText(/seed\.example/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Seedbox'));
    expect(baseProps.onConnect).toHaveBeenCalledWith(b);
  });

  it('shows the error and a Retry label for a failed server', async () => {
    await render(
      <QuickConnectPanel
        {...baseProps}
        savedServers={[server({ id: 'a' })]}
        connectErrors={{ a: 'Connection refused' }}
      />,
    );
    expect(screen.getByText('Connection refused')).toBeTruthy();
    expect(screen.getByText('common.retry')).toBeTruthy();
  });

  it('disables every row while one server is connecting', async () => {
    const a = server({ id: 'a', name: 'Home' });
    const b = server({ id: 'b', name: 'Other' });
    await render(<QuickConnectPanel {...baseProps} savedServers={[a, b]} connectingId="a" />);
    // the connecting row shows a spinner instead of its Connect label
    expect(screen.getAllByText('common.connect')).toHaveLength(2); // row b + add-server row
    await fireEvent.press(screen.getByText('Other'));
    expect(baseProps.onConnect).not.toHaveBeenCalled();
  });

  it('opens add-server from the trailing row', async () => {
    await render(<QuickConnectPanel {...baseProps} savedServers={[server({})]} />);
    const connects = screen.getAllByText('common.connect');
    await fireEvent.press(connects[connects.length - 1]);
    expect(baseProps.onAddServer).toHaveBeenCalled();
  });
});

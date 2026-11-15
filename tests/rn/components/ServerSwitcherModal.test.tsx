import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ServerSwitcherModal } from '@/components/ServerSwitcherModal';
import { ServerConfig } from '@/types/api';
import { CONNECT_SUPERSEDED_MESSAGE } from '@/utils/error';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      surface: '#fff',
      text: '#000',
      textSecondary: '#666',
      surfaceOutline: '#ccc',
      primary: '#007aff',
      background: '#fff',
      success: '#34c759',
      error: '#ff3b30',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function makeServer(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    id: 'server-1',
    name: 'Home Server',
    host: '192.168.1.10',
    port: 8080,
    username: 'admin',
    password: '',
    ...overrides,
  };
}

const serverA = makeServer({ id: 'a', name: 'Home Server' });
const serverB = makeServer({ id: 'b', name: 'Seedbox' });

describe('ServerSwitcherModal', () => {
  it('renders nothing when not visible', async () => {
    await render(
      <ServerSwitcherModal
        visible={false}
        servers={[serverA, serverB]}
        currentServerId="a"
        onSelectServer={jest.fn()}
        onManageServers={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.queryByText('Home Server')).toBeNull();
  });

  it('lists every saved server when visible', async () => {
    await render(
      <ServerSwitcherModal
        visible
        servers={[serverA, serverB]}
        currentServerId="a"
        onSelectServer={jest.fn()}
        onManageServers={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('Home Server')).toBeTruthy();
    expect(screen.getByText('Seedbox')).toBeTruthy();
  });

  it('marks the current server', async () => {
    await render(
      <ServerSwitcherModal
        visible
        servers={[serverA, serverB]}
        currentServerId="a"
        onSelectServer={jest.fn()}
        onManageServers={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('screens.torrents.currentServer')).toBeTruthy();
  });

  it('invokes onSelectServer with the tapped, non-current server', async () => {
    const onSelectServer = jest.fn().mockResolvedValue(true);
    await render(
      <ServerSwitcherModal
        visible
        servers={[serverA, serverB]}
        currentServerId="a"
        onSelectServer={onSelectServer}
        onManageServers={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Seedbox'));
    await waitFor(() => expect(onSelectServer).toHaveBeenCalledWith(serverB));
  });

  it('shows no error when the switch was superseded by a newer connect', async () => {
    const onSelectServer = jest.fn().mockRejectedValue(new Error(CONNECT_SUPERSEDED_MESSAGE));
    await render(
      <ServerSwitcherModal
        visible
        servers={[serverA, serverB]}
        currentServerId="a"
        onSelectServer={onSelectServer}
        onManageServers={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Seedbox'));
    await waitFor(() => expect(onSelectServer).toHaveBeenCalled());
    expect(screen.queryByText(CONNECT_SUPERSEDED_MESSAGE)).toBeNull();
  });

  it('still shows a real connect error', async () => {
    const onSelectServer = jest.fn().mockRejectedValue(new Error('Server exploded'));
    await render(
      <ServerSwitcherModal
        visible
        servers={[serverA, serverB]}
        currentServerId="a"
        onSelectServer={onSelectServer}
        onManageServers={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Seedbox'));
    await waitFor(() => expect(screen.getByText('Server exploded')).toBeTruthy());
  });

  it('closes the modal instead of reconnecting when the current server is tapped', async () => {
    const onSelectServer = jest.fn();
    const onClose = jest.fn();
    await render(
      <ServerSwitcherModal
        visible
        servers={[serverA, serverB]}
        currentServerId="a"
        onSelectServer={onSelectServer}
        onManageServers={jest.fn()}
        onClose={onClose}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Home Server'));
    expect(onSelectServer).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('closes the modal once switching to another server succeeds', async () => {
    const onSelectServer = jest.fn().mockResolvedValue(true);
    const onClose = jest.fn();
    await render(
      <ServerSwitcherModal
        visible
        servers={[serverA, serverB]}
        currentServerId="a"
        onSelectServer={onSelectServer}
        onManageServers={jest.fn()}
        onClose={onClose}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Seedbox'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows an inline error and keeps the modal open when switching fails', async () => {
    const onSelectServer = jest.fn().mockResolvedValue(false);
    const onClose = jest.fn();
    await render(
      <ServerSwitcherModal
        visible
        servers={[serverA, serverB]}
        currentServerId="a"
        onSelectServer={onSelectServer}
        onManageServers={jest.fn()}
        onClose={onClose}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Seedbox'));
    await waitFor(() => expect(screen.getByText('errors.checkCredentials')).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onManageServers when the footer row is tapped', async () => {
    const onManageServers = jest.fn();
    await render(
      <ServerSwitcherModal
        visible
        servers={[serverA, serverB]}
        currentServerId="a"
        onSelectServer={jest.fn()}
        onManageServers={onManageServers}
        onClose={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByText('screens.torrents.manageServers'));
    expect(onManageServers).toHaveBeenCalled();
  });

  it('calls onClose when the backdrop is tapped', async () => {
    const onClose = jest.fn();
    await render(
      <ServerSwitcherModal
        visible
        servers={[serverA, serverB]}
        currentServerId="a"
        onSelectServer={jest.fn()}
        onManageServers={jest.fn()}
        onClose={onClose}
      />,
    );
    await fireEvent.press(screen.getByLabelText('common.close'));
    expect(onClose).toHaveBeenCalled();
  });
});

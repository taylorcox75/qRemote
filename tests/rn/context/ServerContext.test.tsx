import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServerProvider, useServer } from '@/context/ServerContext';
import { ServerManager } from '@/services/server-manager';
import { apiClient } from '@/services/api/client';
import { storageService } from '@/services/storage';

jest.mock('@/services/server-manager', () => ({
  ServerManager: {
    getCurrentServer: jest.fn(),
    getServers: jest.fn(),
    connectToServer: jest.fn(),
    disconnect: jest.fn(),
    reconnect: jest.fn(),
  },
}));

jest.mock('@/services/api/client', () => ({
  apiClient: {
    getServer: jest.fn(),
    setServer: jest.fn(),
  },
}));

jest.mock('@/services/storage', () => ({
  storageService: {
    getPreferences: jest.fn(),
  },
}));

jest.mock('@/services/connectivity-log', () => ({
  clogInfo: jest.fn(),
  clogWarn: jest.fn(),
  clogDebug: jest.fn(),
  clogError: jest.fn(),
}));

const server1: any = { id: 's1', host: 'host1', port: 8080 };
const server2: any = { id: 's2', host: 'host2', port: 8080 };

function Consumer({ onRender }: { onRender: (ctx: ReturnType<typeof useServer>) => void }) {
  const ctx = useServer();
  onRender(ctx);
  return <Text>{ctx.isConnected ? 'connected' : 'disconnected'}</Text>;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

async function renderProvider() {
  let latest: ReturnType<typeof useServer> | undefined;
  const queryClient = makeQueryClient();
  await render(
    <QueryClientProvider client={queryClient}>
      <ServerProvider>
        <Consumer onRender={(ctx) => (latest = ctx)} />
      </ServerProvider>
    </QueryClientProvider>
  );
  return () => latest!;
}

beforeEach(() => {
  jest.clearAllMocks();
  (storageService.getPreferences as jest.Mock).mockResolvedValue({});
  (ServerManager.getCurrentServer as jest.Mock).mockResolvedValue(null);
  (ServerManager.getServers as jest.Mock).mockResolvedValue([]);
  (apiClient.getServer as jest.Mock).mockReturnValue(null);
});

describe('ServerContext', () => {
  it('throws when useServer used outside provider', async () => {
    const BadConsumer = () => {
      useServer();
      return null;
    };
    // Suppress React error logging noise
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(<BadConsumer />)).rejects.toThrow(
      'useServer must be used within a ServerProvider'
    );
    spy.mockRestore();
  });

  it('starts disconnected when no server saved', async () => {
    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().isLoading).toBe(false));
    expect(getLatest().isConnected).toBe(false);
    expect(getLatest().currentServer).toBeNull();
    expect(screen.getByText('disconnected')).toBeTruthy();
  });

  it('clears apiClient at startup when no saved server but a stale server is set', async () => {
    (apiClient.getServer as jest.Mock).mockReturnValue(server1);
    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().isLoading).toBe(false));
    expect(apiClient.setServer).toHaveBeenCalledWith(null);
  });

  it('auto-connects to last server when autoConnectLastServer preference is not false', async () => {
    (ServerManager.getCurrentServer as jest.Mock).mockResolvedValue(server1);
    (ServerManager.connectToServer as jest.Mock).mockResolvedValue(true);
    (apiClient.getServer as jest.Mock).mockReturnValue(server1);

    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().isLoading).toBe(false));
    expect(getLatest().isConnected).toBe(true);
    expect(getLatest().currentServer).toEqual(server1);
  });

  it('does not auto-connect when autoConnectLastServer is false, but connects if exactly one server exists', async () => {
    (storageService.getPreferences as jest.Mock).mockResolvedValue({ autoConnectLastServer: false });
    (ServerManager.getServers as jest.Mock).mockResolvedValue([server1]);
    (ServerManager.connectToServer as jest.Mock).mockResolvedValue(true);
    (apiClient.getServer as jest.Mock).mockReturnValue(server1);

    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().isLoading).toBe(false));
    expect(ServerManager.getCurrentServer).not.toHaveBeenCalled();
    expect(getLatest().isConnected).toBe(true);
  });

  it('clears currentServer when auto-connect fails', async () => {
    (ServerManager.getCurrentServer as jest.Mock).mockResolvedValue(server1);
    (ServerManager.connectToServer as jest.Mock).mockResolvedValue(false);

    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().isLoading).toBe(false));
    expect(getLatest().isConnected).toBe(false);
    expect(getLatest().currentServer).toBeNull();
  });

  it('handles auto-connect throwing', async () => {
    (ServerManager.getCurrentServer as jest.Mock).mockResolvedValue(server1);
    (ServerManager.connectToServer as jest.Mock).mockRejectedValue(new Error('boom'));

    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().isLoading).toBe(false));
    expect(getLatest().isConnected).toBe(false);
    expect(getLatest().currentServer).toBeNull();
  });

  it('handles preferences load throwing entirely', async () => {
    (storageService.getPreferences as jest.Mock).mockRejectedValue(new Error('storage broke'));
    (apiClient.getServer as jest.Mock).mockReturnValue(server1);

    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().isLoading).toBe(false));
    expect(getLatest().isConnected).toBe(false);
    expect(apiClient.setServer).toHaveBeenCalledWith(null);
  });

  it('connectToServer sets connected state on success', async () => {
    (ServerManager.connectToServer as jest.Mock).mockResolvedValue(true);
    (apiClient.getServer as jest.Mock).mockReturnValue(server2);

    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().isLoading).toBe(false));

    await act(async () => {
      await getLatest().connectToServer(server2);
    });

    expect(getLatest().isConnected).toBe(true);
    expect(getLatest().currentServer).toEqual(server2);
  });

  it('connectToServer sets disconnected on failure', async () => {
    (ServerManager.connectToServer as jest.Mock).mockResolvedValue(false);

    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().isLoading).toBe(false));

    await act(async () => {
      await getLatest().connectToServer(server2);
    });

    expect(getLatest().isConnected).toBe(false);
    expect(getLatest().activeEndpoint).toBeNull();
  });

  it('connectToServer handles mutation error', async () => {
    (ServerManager.connectToServer as jest.Mock).mockRejectedValue(new Error('network'));

    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().isLoading).toBe(false));

    await expect(
      act(async () => {
        await getLatest().connectToServer(server2);
      })
    ).rejects.toThrow('network');

    expect(getLatest().isConnected).toBe(false);
  });

  it('disconnect resets state', async () => {
    (ServerManager.getCurrentServer as jest.Mock).mockResolvedValue(server1);
    (ServerManager.connectToServer as jest.Mock).mockResolvedValue(true);
    (apiClient.getServer as jest.Mock).mockReturnValue(server1);
    (ServerManager.disconnect as jest.Mock).mockResolvedValue(undefined);

    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().isLoading).toBe(false));
    expect(getLatest().isConnected).toBe(true);

    await act(async () => {
      await getLatest().disconnect();
    });

    expect(getLatest().isConnected).toBe(false);
    expect(getLatest().currentServer).toBeNull();
  });

  it('disconnect swallows ServerManager.disconnect errors', async () => {
    (ServerManager.getCurrentServer as jest.Mock).mockResolvedValue(server1);
    (ServerManager.connectToServer as jest.Mock).mockResolvedValue(true);
    (apiClient.getServer as jest.Mock).mockReturnValue(server1);
    (ServerManager.disconnect as jest.Mock).mockRejectedValue(new Error('fail'));

    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().isLoading).toBe(false));

    await act(async () => {
      await getLatest().disconnect();
    });

    expect(getLatest().isConnected).toBe(false);
  });

  it('reconnect() updates connection status on success/failure', async () => {
    (ServerManager.getCurrentServer as jest.Mock).mockResolvedValue(server1);
    (ServerManager.connectToServer as jest.Mock).mockResolvedValue(true);
    (apiClient.getServer as jest.Mock).mockReturnValue(server1);
    (ServerManager.reconnect as jest.Mock).mockResolvedValue(true);

    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().isLoading).toBe(false));

    let result: boolean | undefined;
    await act(async () => {
      result = await getLatest().reconnect();
    });
    expect(result).toBe(true);
    expect(getLatest().isConnected).toBe(true);

    (ServerManager.reconnect as jest.Mock).mockResolvedValue(false);
    await act(async () => {
      result = await getLatest().reconnect();
    });
    expect(result).toBe(false);
    expect(getLatest().isConnected).toBe(false);
  });

  it('reconnect() catches thrown errors', async () => {
    (ServerManager.getCurrentServer as jest.Mock).mockResolvedValue(server1);
    (ServerManager.connectToServer as jest.Mock).mockResolvedValue(true);
    (apiClient.getServer as jest.Mock).mockReturnValue(server1);
    (ServerManager.reconnect as jest.Mock).mockRejectedValue(new Error('boom'));

    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().isLoading).toBe(false));

    let result: boolean | undefined;
    await act(async () => {
      result = await getLatest().reconnect();
    });
    expect(result).toBe(false);
    expect(getLatest().isConnected).toBe(false);
  });

  it('checkAndReconnect returns false immediately with no current server', async () => {
    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().isLoading).toBe(false));

    let result: boolean | undefined;
    await act(async () => {
      result = await getLatest().checkAndReconnect();
    });
    expect(result).toBe(false);
  });

  it('checkAndReconnect succeeds via ServerManager.reconnect', async () => {
    (ServerManager.getCurrentServer as jest.Mock).mockResolvedValue(server1);
    (ServerManager.connectToServer as jest.Mock).mockResolvedValue(true);
    (apiClient.getServer as jest.Mock).mockReturnValue(server1);
    (ServerManager.reconnect as jest.Mock).mockResolvedValue(true);

    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().isLoading).toBe(false));

    let result: boolean | undefined;
    await act(async () => {
      result = await getLatest().checkAndReconnect();
    });
    expect(result).toBe(true);
  });

  it('checkAndReconnect falls back to connectToServer when reconnect throws', async () => {
    (ServerManager.getCurrentServer as jest.Mock).mockResolvedValue(server1);
    (ServerManager.connectToServer as jest.Mock).mockResolvedValue(true);
    (apiClient.getServer as jest.Mock).mockReturnValue(server1);
    (ServerManager.reconnect as jest.Mock).mockRejectedValue(new Error('session dead'));

    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().isLoading).toBe(false));

    (ServerManager.connectToServer as jest.Mock).mockResolvedValue(true);
    let result: boolean | undefined;
    await act(async () => {
      result = await getLatest().checkAndReconnect();
    });
    expect(result).toBe(true);
  });

  it('checkAndReconnect returns false when both reconnect and connectToServer fail', async () => {
    (ServerManager.getCurrentServer as jest.Mock).mockResolvedValue(server1);
    (ServerManager.connectToServer as jest.Mock).mockResolvedValue(true);
    (apiClient.getServer as jest.Mock).mockReturnValue(server1);

    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().isLoading).toBe(false));

    (ServerManager.reconnect as jest.Mock).mockRejectedValue(new Error('dead'));
    (ServerManager.connectToServer as jest.Mock).mockRejectedValue(new Error('dead too'));

    let result: boolean | undefined;
    await act(async () => {
      result = await getLatest().checkAndReconnect();
    });
    expect(result).toBe(false);
  });

  it('checkAndReconnect de-dupes concurrent calls into one in-flight promise', async () => {
    (ServerManager.getCurrentServer as jest.Mock).mockResolvedValue(server1);
    (ServerManager.connectToServer as jest.Mock).mockResolvedValue(true);
    (apiClient.getServer as jest.Mock).mockReturnValue(server1);

    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().isLoading).toBe(false));

    (ServerManager.reconnect as jest.Mock).mockResolvedValue(true);

    let r1: Promise<boolean>, r2: Promise<boolean>;
    await act(async () => {
      r1 = getLatest().checkAndReconnect();
      r2 = getLatest().checkAndReconnect();
      await Promise.all([r1, r2]);
    });

    // reconnect should have only been triggered once despite two callers
    expect((ServerManager.reconnect as jest.Mock).mock.calls.length).toBe(1);
  });
});

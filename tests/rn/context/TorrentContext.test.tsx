import React from 'react';
import { Text, AppState } from 'react-native';
import { render, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TorrentProvider, useTorrents } from '@/context/TorrentContext';
import { useServer } from '@/context/ServerContext';
import { syncApi } from '@/services/api/sync';
import { MainData } from '@/types/api';

jest.mock('@/context/ServerContext', () => ({ useServer: jest.fn() }));
jest.mock('@/services/api/sync', () => ({
  syncApi: { getMainData: jest.fn() },
}));
// The reactive auto-reconnect path has its own dedicated test coverage
// (tests/rn/hooks/useReactiveReconnect.test.ts) — mock it out here so this
// suite can isolate TorrentContext's own recovery-flag bookkeeping.
jest.mock('@/hooks/useReactiveReconnect', () => ({ useReactiveReconnect: jest.fn() }));

const emptyMainData: MainData = {
  rid: 1,
  full_update: true,
  torrents: {},
  categories: {},
  tags: [],
  server_state: {},
};

function Consumer({ onRender }: { onRender: (ctx: ReturnType<typeof useTorrents>) => void }) {
  const ctx = useTorrents();
  onRender(ctx);
  return <Text>{ctx.isRecoveringFromBackground ? 'recovering' : 'idle'}</Text>;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

async function renderProvider() {
  let latest: ReturnType<typeof useTorrents> | undefined;
  const queryClient = makeQueryClient();
  await render(
    <QueryClientProvider client={queryClient}>
      <TorrentProvider>
        <Consumer onRender={(ctx) => (latest = ctx)} />
      </TorrentProvider>
    </QueryClientProvider>,
  );
  return () => latest!;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(useServer)
    .mockReturnValue({ isConnected: true } as unknown as ReturnType<typeof useServer>);
});

describe('TorrentContext', () => {
  it('throws when useTorrents used outside provider', async () => {
    const BadConsumer = () => {
      useTorrents();
      return null;
    };
    // Suppress React error logging noise
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(<BadConsumer />)).rejects.toThrow(
      'useTorrents must be used within a TorrentProvider',
    );
    spy.mockRestore();
  });

  it('keeps isRecoveringFromBackground true across a foreground re-sync that fails', async () => {
    jest.mocked(syncApi.getMainData).mockResolvedValue(emptyMainData);

    let appStateHandler: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      appStateHandler = handler as (state: string) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });

    const getLatest = await renderProvider();

    // Let the initial successful sync land — this is the timestamp a naive
    // "dataUpdatedAt > 0" check would (wrongly) treat as proof recovery is
    // already done.
    await waitFor(() => expect(getLatest().initialLoadComplete).toBe(true));
    expect(getLatest().isRecoveringFromBackground).toBe(false);

    // The session died while backgrounded — the foreground re-sync fails.
    jest
      .mocked(syncApi.getMainData)
      .mockRejectedValue(new Error('Authentication failed. Please check your credentials.'));

    await act(async () => {
      appStateHandler?.('background');
    });
    await act(async () => {
      appStateHandler?.('active');
    });

    // Wait for the foreground re-sync to actually have been attempted (and
    // failed) before asserting on the flag it's supposed to leave behind.
    await waitFor(() => {
      expect(jest.mocked(syncApi.getMainData).mock.calls.length).toBeGreaterThan(1);
    });

    expect(getLatest().isRecoveringFromBackground).toBe(true);
    // The error is suppressed while recovering, so the torrents list keeps
    // showing its skeleton rather than a hard error during this window.
    expect(getLatest().error).toBeNull();
  });

  it('clears isRecoveringFromBackground once a genuinely new sync succeeds', async () => {
    jest.mocked(syncApi.getMainData).mockResolvedValue(emptyMainData);

    let appStateHandler: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      appStateHandler = handler as (state: string) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });

    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().initialLoadComplete).toBe(true));

    await act(async () => {
      appStateHandler?.('background');
    });
    await act(async () => {
      appStateHandler?.('active');
    });

    await waitFor(() => {
      expect(getLatest().isRecoveringFromBackground).toBe(false);
    });
  });
});

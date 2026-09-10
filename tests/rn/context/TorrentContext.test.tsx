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

afterEach(() => {
  // Some tests below spy on Date.now — restore it (and any other spies) so a
  // mocked clock can't leak into a later test.
  jest.restoreAllMocks();
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

  it('keeps isRecoveringFromBackground true across a foreground re-sync that fails, after a long background', async () => {
    jest.mocked(syncApi.getMainData).mockResolvedValue(emptyMainData);

    let appStateHandler: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      appStateHandler = handler as (state: string) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);

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
    // Longer than the "quick app-switch" threshold, so the full recovery
    // dance (not just a quiet incremental refresh) is expected to run.
    now += 11_000;
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

  it('clears isRecoveringFromBackground once a genuinely new sync succeeds, after a long background', async () => {
    jest.mocked(syncApi.getMainData).mockResolvedValue(emptyMainData);

    let appStateHandler: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      appStateHandler = handler as (state: string) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().initialLoadComplete).toBe(true));

    await act(async () => {
      appStateHandler?.('background');
    });
    now += 11_000;
    await act(async () => {
      appStateHandler?.('active');
    });

    await waitFor(() => {
      expect(getLatest().isRecoveringFromBackground).toBe(false);
    });
  });

  it('skips the recovery skeleton for a quick app-switch, but still refreshes', async () => {
    jest.mocked(syncApi.getMainData).mockResolvedValue(emptyMainData);

    let appStateHandler: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      appStateHandler = handler as (state: string) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    const getLatest = await renderProvider();
    await waitFor(() => expect(getLatest().initialLoadComplete).toBe(true));

    const callsBeforeSwitch = jest.mocked(syncApi.getMainData).mock.calls.length;

    await act(async () => {
      appStateHandler?.('background');
    });
    // Well under the "long background" threshold — a glance at another app.
    now += 1_000;
    await act(async () => {
      appStateHandler?.('active');
    });

    // Still nudges an immediate refresh rather than waiting out the normal
    // poll interval...
    await waitFor(() => {
      expect(jest.mocked(syncApi.getMainData).mock.calls.length).toBeGreaterThan(callsBeforeSwitch);
    });
    // ...but never shows the recovery skeleton for it.
    expect(getLatest().isRecoveringFromBackground).toBe(false);
  });
});

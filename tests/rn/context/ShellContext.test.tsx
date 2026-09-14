import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { ShellProvider, useShell, ShellState } from '@/context/ShellContext';
import { useLayoutIdiom } from '@/hooks/useLayoutIdiom';
import { useTorrents } from '@/context/TorrentContext';
import { useServer } from '@/context/ServerContext';
import { TorrentInfo } from '@/types/api';

jest.mock('@/hooks/useLayoutIdiom', () => ({ useLayoutIdiom: jest.fn() }));
jest.mock('@/context/TorrentContext', () => ({ useTorrents: jest.fn() }));
jest.mock('@/context/ServerContext', () => ({ useServer: jest.fn() }));

function makeTorrent(hash: string): TorrentInfo {
  return { hash, name: hash } as unknown as TorrentInfo;
}

function mockTorrents(torrents: TorrentInfo[], initialLoadComplete: boolean) {
  jest.mocked(useTorrents).mockReturnValue({
    torrents,
    categories: {},
    tags: [],
    serverState: null,
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    sync: jest.fn(),
    isRecoveringFromBackground: false,
    initialLoadComplete,
  } as unknown as ReturnType<typeof useTorrents>);
}

function Consumer({ onRender }: { onRender: (ctx: ShellState) => void }) {
  const ctx = useShell();
  onRender(ctx);
  return (
    <>
      <Text>{ctx.selectedHash ?? 'none'}</Text>
      <TouchableOpacity onPress={() => ctx.setSelectedHash('abc')}>
        <Text>select</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => ctx.toggleSidebar()}>
        <Text>toggle</Text>
      </TouchableOpacity>
    </>
  );
}

describe('ShellContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useLayoutIdiom).mockReturnValue('regular');
    jest.mocked(useServer).mockReturnValue({
      isConnected: true,
    } as unknown as ReturnType<typeof useServer>);
    mockTorrents([makeTorrent('abc')], true);
  });

  it('throws when useShell used outside a provider', async () => {
    const Bad = () => {
      useShell();
      return null;
    };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(<Bad />)).rejects.toThrow('useShell must be used within a ShellProvider');
    spy.mockRestore();
  });

  it('defaults idiom, selectedHash, listFilter and sidebarCollapsed', async () => {
    let latest: ShellState | undefined;
    await render(
      <ShellProvider>
        <Consumer onRender={(ctx) => (latest = ctx)} />
      </ShellProvider>,
    );
    await waitFor(() => expect(latest).toBeDefined());
    expect(latest!.idiom).toBe('regular');
    expect(latest!.selectedHash).toBeNull();
    expect(latest!.listFilter).toEqual({
      status: 'all',
      category: null,
      tags: [],
      tracker: null,
    });
    expect(latest!.sidebarCollapsed).toBe(false);
  });

  it('setSelectedHash updates state', async () => {
    let latest: ShellState | undefined;
    await render(
      <ShellProvider>
        <Consumer onRender={(ctx) => (latest = ctx)} />
      </ShellProvider>,
    );
    await waitFor(() => expect(latest).toBeDefined());
    fireEvent.press(screen.getByText('select'));
    await waitFor(() => expect(latest!.selectedHash).toBe('abc'));
  });

  it('setListFilter replaces the filter', async () => {
    let latest: ShellState | undefined;
    await render(
      <ShellProvider>
        <Consumer onRender={(ctx) => (latest = ctx)} />
      </ShellProvider>,
    );
    await waitFor(() => expect(latest).toBeDefined());
    await (async () => {
      latest!.setListFilter({
        status: 'downloading',
        category: 'movies',
        tags: ['x'],
        tracker: null,
      });
    })();
    await waitFor(() =>
      expect(latest!.listFilter).toEqual({
        status: 'downloading',
        category: 'movies',
        tags: ['x'],
        tracker: null,
      }),
    );
  });

  it('toggleSidebar flips sidebarCollapsed', async () => {
    let latest: ShellState | undefined;
    await render(
      <ShellProvider>
        <Consumer onRender={(ctx) => (latest = ctx)} />
      </ShellProvider>,
    );
    await waitFor(() => expect(latest).toBeDefined());
    fireEvent.press(screen.getByText('toggle'));
    await waitFor(() => expect(latest!.sidebarCollapsed).toBe(true));
    fireEvent.press(screen.getByText('toggle'));
    await waitFor(() => expect(latest!.sidebarCollapsed).toBe(false));
  });

  it('clears selectedHash once the torrent no longer exists after initial load', async () => {
    mockTorrents([makeTorrent('abc')], true);
    let latest: ShellState | undefined;
    const { rerender } = await render(
      <ShellProvider>
        <Consumer onRender={(ctx) => (latest = ctx)} />
      </ShellProvider>,
    );
    await waitFor(() => expect(latest).toBeDefined());
    fireEvent.press(screen.getByText('select'));
    await waitFor(() => expect(latest!.selectedHash).toBe('abc'));

    mockTorrents([], true);
    await rerender(
      <ShellProvider>
        <Consumer onRender={(ctx) => (latest = ctx)} />
      </ShellProvider>,
    );

    await waitFor(() => expect(latest!.selectedHash).toBeNull());
  });

  it('does not clear selectedHash while initial load is still in progress', async () => {
    mockTorrents([], false);
    let latest: ShellState | undefined;
    const { rerender } = await render(
      <ShellProvider>
        <Consumer onRender={(ctx) => (latest = ctx)} />
      </ShellProvider>,
    );
    await waitFor(() => expect(latest).toBeDefined());
    fireEvent.press(screen.getByText('select'));
    await waitFor(() => expect(latest!.selectedHash).toBe('abc'));

    // Re-render with the same (still loading, empty) torrents state.
    await rerender(
      <ShellProvider>
        <Consumer onRender={(ctx) => (latest = ctx)} />
      </ShellProvider>,
    );

    expect(latest!.selectedHash).toBe('abc');
  });

  it('clears selectedHash when the server disconnects', async () => {
    let latest: ShellState | undefined;
    const { rerender } = await render(
      <ShellProvider>
        <Consumer onRender={(ctx) => (latest = ctx)} />
      </ShellProvider>,
    );
    await waitFor(() => expect(latest).toBeDefined());
    fireEvent.press(screen.getByText('select'));
    await waitFor(() => expect(latest!.selectedHash).toBe('abc'));

    jest.mocked(useServer).mockReturnValue({
      isConnected: false,
    } as unknown as ReturnType<typeof useServer>);
    await rerender(
      <ShellProvider>
        <Consumer onRender={(ctx) => (latest = ctx)} />
      </ShellProvider>,
    );

    await waitFor(() => expect(latest!.selectedHash).toBeNull());
  });
});

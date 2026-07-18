import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { useSearchJob } from '@/hooks/useSearchJob';
import { searchApi } from '@/services/api/search';
import { useServer } from '@/context/ServerContext';
import { useReactiveReconnect } from '@/hooks/useReactiveReconnect';

jest.mock('@/services/api/search', () => ({
  searchApi: {
    start: jest.fn(),
    stop: jest.fn(),
    deleteSearch: jest.fn(),
    getStatus: jest.fn(),
    getResults: jest.fn(),
  },
}));
jest.mock('@/context/ServerContext', () => ({ useServer: jest.fn() }));
jest.mock('@/hooks/useReactiveReconnect', () => ({ useReactiveReconnect: jest.fn() }));

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useSearchJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useServer).mockReturnValue({ isConnected: true } as any);
    jest.mocked(searchApi.getStatus).mockResolvedValue([]);
    jest.mocked(searchApi.getResults).mockResolvedValue({
      status: 'Running',
      total: 0,
      results: [],
    } as any);
    jest.mocked(searchApi.stop).mockResolvedValue(undefined as any);
    jest.mocked(searchApi.deleteSearch).mockResolvedValue(undefined as any);
  });

  it('starts idle with no job', async () => {
    const { result } = await renderHook(() => useSearchJob(), { wrapper: makeWrapper() });
    expect(result.current.jobId).toBeNull();
    expect(result.current.status).toBeNull();
    expect(result.current.results).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  it('shows error when starting while not connected', async () => {
    jest.mocked(useServer).mockReturnValue({ isConnected: false } as any);
    const { result } = await renderHook(() => useSearchJob(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.start('term', 'all', 'all');
    });
    expect(result.current.error).toBe('Not connected to a server.');
    expect(searchApi.start).not.toHaveBeenCalled();
  });

  it('starts a search job and polls for status/results', async () => {
    jest.mocked(searchApi.start).mockResolvedValue({ id: 42 } as any);
    const { result } = await renderHook(() => useSearchJob(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.start('ubuntu', 'all', 'all');
    });

    expect(result.current.jobId).toBe(42);

    await waitFor(() => {
      expect(result.current.status).toBe('Running');
    });
    expect(searchApi.getResults).toHaveBeenCalledWith(42, 1000, 0);
  });

  it('retries start once on a 409 conflict then succeeds', async () => {
    jest
      .mocked(searchApi.start)
      .mockRejectedValueOnce(new Error('409 conflict'))
      .mockResolvedValueOnce({ id: 7 } as any);
    const { result } = await renderHook(() => useSearchJob(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.start('term', 'all', 'all');
    });

    expect(searchApi.start).toHaveBeenCalledTimes(2);
    expect(result.current.jobId).toBe(7);
    expect(result.current.error).toBeNull();
  });

  it('sets mutationError when the 409 retry also fails', async () => {
    jest
      .mocked(searchApi.start)
      .mockRejectedValueOnce(new Error('409 conflict'))
      .mockRejectedValueOnce(new Error('still broken'));
    const { result } = await renderHook(() => useSearchJob(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.start('term', 'all', 'all');
    });

    expect(result.current.error).toBe('still broken');
    expect(result.current.jobId).toBeNull();
  });

  it('sets mutationError for a non-409 start failure', async () => {
    jest.mocked(searchApi.start).mockRejectedValue(new Error('server exploded'));
    const { result } = await renderHook(() => useSearchJob(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.start('term', 'all', 'all');
    });

    expect(result.current.error).toBe('server exploded');
    expect(result.current.jobId).toBeNull();
  });

  it('stops and deletes a previous job before starting a new one', async () => {
    jest
      .mocked(searchApi.start)
      .mockResolvedValueOnce({ id: 1 } as any)
      .mockResolvedValueOnce({ id: 2 } as any);
    const { result } = await renderHook(() => useSearchJob(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.start('first', 'all', 'all');
    });
    expect(result.current.jobId).toBe(1);

    await act(async () => {
      await result.current.start('second', 'all', 'all');
    });

    expect(searchApi.stop).toHaveBeenCalledWith(1);
    expect(searchApi.deleteSearch).toHaveBeenCalledWith(1);
    expect(result.current.jobId).toBe(2);
  });

  it('stop() invokes searchApi.stop for the active job', async () => {
    jest.mocked(searchApi.start).mockResolvedValue({ id: 5 } as any);
    const { result } = await renderHook(() => useSearchJob(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.start('term', 'all', 'all');
    });
    await act(async () => {
      await result.current.stop();
    });

    expect(searchApi.stop).toHaveBeenCalledWith(5);
  });

  it('stop() is a no-op when there is no active job', async () => {
    const { result } = await renderHook(() => useSearchJob(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.stop();
    });
    expect(searchApi.stop).not.toHaveBeenCalled();
  });

  it('tolerates a failing stop call (job already stopped/removed server-side)', async () => {
    jest.mocked(searchApi.start).mockResolvedValue({ id: 9 } as any);
    jest.mocked(searchApi.stop).mockRejectedValue(new Error('stop boom'));
    const { result } = await renderHook(() => useSearchJob(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.start('term', 'all', 'all');
    });
    await act(async () => {
      await result.current.stop();
    });

    expect(searchApi.stop).toHaveBeenCalledWith(9);
    expect(result.current.error).toBeNull();
  });

  it('reset() clears job state and deletes the server-side job when connected', async () => {
    jest.mocked(searchApi.start).mockResolvedValue({ id: 11 } as any);
    const { result } = await renderHook(() => useSearchJob(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.start('term', 'all', 'all');
    });
    await act(async () => {
      await result.current.reset();
    });

    expect(searchApi.deleteSearch).toHaveBeenCalledWith(11);
    expect(result.current.jobId).toBeNull();
  });

  it('reset() does not call deleteSearch when there is no active job', async () => {
    const { result } = await renderHook(() => useSearchJob(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.reset();
    });
    expect(searchApi.deleteSearch).not.toHaveBeenCalled();
  });

  it('force-clears local state when disconnected mid-search', async () => {
    jest.mocked(searchApi.start).mockResolvedValue({ id: 3 } as any);
    const { result, rerender } = await renderHook(
      ({ connected }: { connected: boolean }) => {
        jest.mocked(useServer).mockReturnValue({ isConnected: connected } as any);
        return useSearchJob();
      },
      { wrapper: makeWrapper(), initialProps: { connected: true } },
    );

    await act(async () => {
      await result.current.start('term', 'all', 'all');
    });
    expect(result.current.jobId).toBe(3);

    await act(async () => {
      await rerender({ connected: false });
    });

    expect(result.current.jobId).toBeNull();
  });

  it('deletes the server-side job on unmount', async () => {
    jest.mocked(searchApi.start).mockResolvedValue({ id: 21 } as any);
    const { result, unmount } = await renderHook(() => useSearchJob(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.start('term', 'all', 'all');
    });

    unmount();

    await waitFor(() => {
      expect(searchApi.deleteSearch).toHaveBeenCalledWith(21);
    });
  });

  it('refreshes on AppState becoming active while a job is running', async () => {
    let appStateHandler: ((state: string) => void) | undefined;
    const addListenerSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, handler) => {
        appStateHandler = handler as (state: string) => void;
        return { remove: jest.fn() } as any;
      });

    jest.mocked(searchApi.start).mockResolvedValue({ id: 55 } as any);
    const { result } = await renderHook(() => useSearchJob(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.start('term', 'all', 'all');
    });

    jest.mocked(searchApi.getResults).mockClear();

    await act(async () => {
      appStateHandler?.('active');
    });

    await waitFor(() => {
      expect(searchApi.getResults).toHaveBeenCalled();
    });

    // Intentionally not restored: AppState is a singleton, and restoring it here
    // triggers a jest/RN quirk where subsequent addEventListener calls return
    // undefined instead of a real subscription (breaking later tests' unmount).
    void addListenerSpy;
  });

  it('surfaces query errors via getErrorMessage and calls useReactiveReconnect', async () => {
    jest.mocked(searchApi.start).mockResolvedValue({ id: 99 } as any);
    jest.mocked(searchApi.getResults).mockRejectedValue(new Error('poll failed'));
    const { result } = await renderHook(() => useSearchJob(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.start('term', 'all', 'all');
    });

    await waitFor(
      () => {
        expect(result.current.error).toBe('poll failed');
      },
      { timeout: 3000 }
    );
    expect(useReactiveReconnect).toHaveBeenCalled();
  });

  it('stops polling once status is Stopped', async () => {
    jest.mocked(searchApi.start).mockResolvedValue({ id: 8 } as any);
    jest.mocked(searchApi.getResults).mockResolvedValue({
      status: 'Stopped',
      total: 5,
      results: [{ fileName: 'x' } as any],
    } as any);
    const { result } = await renderHook(() => useSearchJob(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.start('term', 'all', 'all');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('Stopped');
    });
    expect(result.current.total).toBe(5);
    expect(result.current.results).toHaveLength(1);
  });
});

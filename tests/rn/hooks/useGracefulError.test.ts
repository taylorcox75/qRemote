import { renderHook, act } from '@testing-library/react-native';
import { useGracefulError } from '@/hooks/useGracefulError';

describe('useGracefulError', () => {
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('reports no error and no pending state when there is no error', async () => {
    const { result } = await renderHook(
      ({ error }: { error: string | null }) => useGracefulError(error),
      { initialProps: { error: null as string | null } },
    );
    expect(result.current.graceError).toBeNull();
    expect(result.current.isPendingError).toBe(false);
  });

  it('withholds the error until the grace period elapses', async () => {
    jest.useFakeTimers();
    const { result, rerender } = await renderHook(
      ({ error }: { error: string | null }) => useGracefulError(error, 2500),
      { initialProps: { error: null as string | null } },
    );

    await rerender({ error: 'Network Error' });
    expect(result.current.graceError).toBeNull();
    expect(result.current.isPendingError).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(2400);
    });
    expect(result.current.graceError).toBeNull();
    expect(result.current.isPendingError).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current.graceError).toBe('Network Error');
    expect(result.current.isPendingError).toBe(false);
  });

  it('clears without ever surfacing the error if it resolves before the grace period', async () => {
    jest.useFakeTimers();
    const { result, rerender } = await renderHook(
      ({ error }: { error: string | null }) => useGracefulError(error, 2500),
      { initialProps: { error: 'Network Error' as string | null } },
    );
    expect(result.current.isPendingError).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await rerender({ error: null });

    expect(result.current.graceError).toBeNull();
    expect(result.current.isPendingError).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current.graceError).toBeNull();
  });

  it('restarts the grace window for a new error after the previous one cleared', async () => {
    jest.useFakeTimers();
    const { result, rerender } = await renderHook(
      ({ error }: { error: string | null }) => useGracefulError(error, 2500),
      { initialProps: { error: 'Authentication failed' as string | null } },
    );

    await act(async () => {
      jest.advanceTimersByTime(2500);
    });
    expect(result.current.graceError).toBe('Authentication failed');

    await rerender({ error: null });
    expect(result.current.graceError).toBeNull();

    await rerender({ error: 'Connection timeout' });
    expect(result.current.graceError).toBeNull();
    expect(result.current.isPendingError).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(2500);
    });
    expect(result.current.graceError).toBe('Connection timeout');
  });

  it('uses the default grace period when none is provided', async () => {
    jest.useFakeTimers();
    const { result, rerender } = await renderHook(
      ({ error }: { error: string | null }) => useGracefulError(error),
      { initialProps: { error: null as string | null } },
    );
    await rerender({ error: 'Network Error' });

    await act(async () => {
      jest.advanceTimersByTime(2499);
    });
    expect(result.current.graceError).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.graceError).toBe('Network Error');
  });
});

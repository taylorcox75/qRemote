import { renderHook } from '@testing-library/react-native';
import { useReactiveReconnect, isReconnectableError } from '@/hooks/useReactiveReconnect';
import { useServer } from '@/context/ServerContext';

jest.mock('@/context/ServerContext', () => ({
  useServer: jest.fn(),
}));

describe('isReconnectableError', () => {
  it('matches known reconnectable fragments', () => {
    expect(isReconnectableError('Authentication failed: bad creds')).toBe(true);
    expect(isReconnectableError('No server configured')).toBe(true);
    expect(isReconnectableError('Connection timeout after 5s')).toBe(true);
    expect(isReconnectableError('Network Error')).toBe(true);
  });

  it('does not match unrelated messages', () => {
    expect(isReconnectableError('Some other error')).toBe(false);
  });
});

describe('useReactiveReconnect', () => {
  let checkAndReconnect: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    checkAndReconnect = jest.fn().mockResolvedValue(true);
    jest.mocked(useServer).mockReturnValue({
      isConnected: true,
      checkAndReconnect,
    } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('does nothing when there is no error', async () => {
    await renderHook(({ error }: { error: unknown }) => useReactiveReconnect(error), {
      initialProps: { error: null as unknown },
    });
    expect(checkAndReconnect).not.toHaveBeenCalled();
  });

  it('does nothing when not connected', async () => {
    jest.mocked(useServer).mockReturnValue({
      isConnected: false,
      checkAndReconnect,
    } as any);
    await renderHook(() => useReactiveReconnect(new Error('Network Error')));
    expect(checkAndReconnect).not.toHaveBeenCalled();
  });

  it('does nothing when the error is not reconnectable', async () => {
    await renderHook(() => useReactiveReconnect(new Error('Some random failure')));
    expect(checkAndReconnect).not.toHaveBeenCalled();
  });

  it('calls checkAndReconnect for a reconnectable error', async () => {
    await renderHook(() => useReactiveReconnect(new Error('Network Error')));
    expect(checkAndReconnect).toHaveBeenCalledTimes(1);
  });

  it('respects the cooldown between attempts', async () => {
    const { rerender } = await renderHook(
      ({ error }: { error: unknown }) => useReactiveReconnect(error),
      { initialProps: { error: new Error('Network Error') as unknown } },
    );
    expect(checkAndReconnect).toHaveBeenCalledTimes(1);

    // Rerender with a new error instance quickly — should be within cooldown.
    await rerender({ error: new Error('Connection timeout') });
    expect(checkAndReconnect).toHaveBeenCalledTimes(1);
  });

  it('allows a new attempt after the cooldown has elapsed', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_000_000);
    const { rerender } = await renderHook(
      ({ error }: { error: unknown }) => useReactiveReconnect(error),
      { initialProps: { error: new Error('Network Error') as unknown } },
    );
    expect(checkAndReconnect).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(1_000_000 + 16_000);
    await rerender({ error: new Error('Connection timeout') });
    expect(checkAndReconnect).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });

  it('does not start a new reconnect while one is in flight', async () => {
    let resolveReconnect: (v: boolean) => void = () => {};
    checkAndReconnect.mockReturnValue(
      new Promise((resolve) => {
        resolveReconnect = resolve;
      }),
    );
    const { rerender } = await renderHook(
      ({ error }: { error: unknown }) => useReactiveReconnect(error),
      { initialProps: { error: new Error('Network Error') as unknown } },
    );
    expect(checkAndReconnect).toHaveBeenCalledTimes(1);

    // Force cooldown to have "elapsed" by manipulating error identity + time.
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 20_000);
    await rerender({ error: new Error('Network Error 2') });
    // Still only 1 call because reconnectingRef is true (in-flight).
    expect(checkAndReconnect).toHaveBeenCalledTimes(1);

    resolveReconnect(true);
    nowSpy.mockRestore();
  });
});

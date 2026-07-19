import { renderHook, act } from '@testing-library/react-native';
import { useSpeedTracker } from '@/hooks/useSpeedTracker';

describe('useSpeedTracker', () => {
  it('resets stats on mount when enabled', async () => {
    const { result } = await renderHook(() => useSpeedTracker(true));
    expect(result.current.speedData).toEqual([]);
    expect(result.current.stats.averageDownload).toBe(0);
    expect(result.current.stats.peakDownload).toBe(0);
    expect(result.current.getLatestSpeeds()).toEqual({ download: 0, upload: 0 });
  });

  it('does not reset when disabled on mount', async () => {
    const { result } = await renderHook(() => useSpeedTracker(false));
    // still starts empty since state is initialized empty regardless
    expect(result.current.speedData).toEqual([]);
  });

  it('adds speed data points and updates stats/peaks', async () => {
    const { result } = await renderHook(() => useSpeedTracker(true));

    await act(async () => {
      result.current.addSpeedData(100, 50);
    });
    expect(result.current.speedData).toHaveLength(1);
    expect(result.current.stats.peakDownload).toBe(100);
    expect(result.current.stats.peakUpload).toBe(50);
    expect(result.current.stats.averageDownload).toBe(100);
    expect(result.current.getLatestSpeeds()).toEqual({ download: 100, upload: 50 });

    await act(async () => {
      result.current.addSpeedData(200, 20);
    });
    expect(result.current.speedData).toHaveLength(2);
    expect(result.current.stats.peakDownload).toBe(200);
    expect(result.current.stats.peakUpload).toBe(50);
    expect(result.current.getLatestSpeeds()).toEqual({ download: 200, upload: 20 });
  });

  it('caps stored data points at MAX_DATA_POINTS (60)', async () => {
    const { result } = await renderHook(() => useSpeedTracker(true));

    await act(async () => {
      for (let i = 0; i < 65; i++) {
        result.current.addSpeedData(i, i);
      }
    });
    expect(result.current.speedData).toHaveLength(60);
    expect(result.current.speedData[59].downloadSpeed).toBe(64);
  });

  it('resetStats clears data, stats, and last speeds', async () => {
    const { result } = await renderHook(() => useSpeedTracker(true));

    await act(async () => {
      result.current.addSpeedData(100, 50);
    });
    expect(result.current.speedData).toHaveLength(1);

    await act(async () => {
      result.current.resetStats();
    });
    expect(result.current.speedData).toEqual([]);
    expect(result.current.stats.averageDownload).toBe(0);
    expect(result.current.stats.peakDownload).toBe(0);
    expect(result.current.getLatestSpeeds()).toEqual({ download: 0, upload: 0 });
  });
});

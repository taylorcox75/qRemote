import { renderHook } from '@testing-library/react-native';
import { useSpeedHistory } from '@/hooks/useSpeedHistory';
import { useTransfer } from '@/context/TransferContext';

jest.mock('@/context/TransferContext', () => ({
  useTransfer: jest.fn(),
}));

describe('useSpeedHistory', () => {
  it('returns zeroed history and zero current speeds when transferInfo is null', async () => {
    jest.mocked(useTransfer).mockReturnValue({ transferInfo: null } as any);
    const { result } = await renderHook(() => useSpeedHistory());
    expect(result.current.downloadHistory).toHaveLength(30);
    expect(result.current.downloadHistory.every((v) => v === 0)).toBe(true);
    expect(result.current.uploadHistory).toHaveLength(30);
    expect(result.current.currentDownload).toBe(0);
    expect(result.current.currentUpload).toBe(0);
  });

  it('appends a converted reading and drops the oldest when transferInfo updates', async () => {
    const mockUseTransfer = jest.mocked(useTransfer);
    mockUseTransfer.mockReturnValue({
      transferInfo: { dl_info_speed: 1024 * 1024 * 2, up_info_speed: 1024 * 1024 },
    } as any);

    const { result, rerender } = await renderHook(() => useSpeedHistory());

    expect(result.current.downloadHistory[29]).toBeCloseTo(2);
    expect(result.current.uploadHistory[29]).toBeCloseTo(1);
    expect(result.current.currentDownload).toBe(1024 * 1024 * 2);
    expect(result.current.currentUpload).toBe(1024 * 1024);

    mockUseTransfer.mockReturnValue({
      transferInfo: { dl_info_speed: 1024 * 1024 * 4, up_info_speed: 1024 * 1024 * 3 },
    } as any);
    await rerender({});

    expect(result.current.downloadHistory).toHaveLength(30);
    expect(result.current.downloadHistory[28]).toBeCloseTo(2);
    expect(result.current.downloadHistory[29]).toBeCloseTo(4);
    expect(result.current.uploadHistory[29]).toBeCloseTo(3);
  });
});

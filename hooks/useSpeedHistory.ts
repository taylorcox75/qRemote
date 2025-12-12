import { useState, useEffect, useRef } from 'react';
import { useTransfer } from '../context/TransferContext';

const MAX_HISTORY_LENGTH = 30; // Keep last 30 readings

/**
 * Hook to track download/upload speed history for graphs
 */
export function useSpeedHistory() {
  const { transferInfo } = useTransfer();
  const [downloadHistory, setDownloadHistory] = useState<number[]>(
    Array(MAX_HISTORY_LENGTH).fill(0)
  );
  const [uploadHistory, setUploadHistory] = useState<number[]>(
    Array(MAX_HISTORY_LENGTH).fill(0)
  );

  useEffect(() => {
    if (transferInfo) {
      // Add new reading and remove oldest
      setDownloadHistory((prev) => {
        const newHistory = [...prev.slice(1), transferInfo.dl_info_speed / 1024 / 1024]; // Convert to MB/s
        return newHistory;
      });

      setUploadHistory((prev) => {
        const newHistory = [...prev.slice(1), transferInfo.up_info_speed / 1024 / 1024]; // Convert to MB/s
        return newHistory;
      });
    }
  }, [transferInfo]);

  return {
    downloadHistory,
    uploadHistory,
    currentDownload: transferInfo?.dl_info_speed || 0,
    currentUpload: transferInfo?.up_info_speed || 0,
  };
}



import { useState, useEffect, useRef, useCallback } from 'react';

interface SpeedDataPoint {
  timestamp: number;
  downloadSpeed: number;
  uploadSpeed: number;
}

interface SpeedStats {
  averageDownload: number;
  averageUpload: number;
  peakDownload: number;
  peakUpload: number;
  sessionStartTime: number;
}

const MAX_DATA_POINTS = 60; // 60 seconds at 1 sample per second
const COLLECTION_INTERVAL = 1000; // 1 second

export function useSpeedTracker(enabled: boolean = true) {
  const [speedData, setSpeedData] = useState<SpeedDataPoint[]>([]);
  const [stats, setStats] = useState<SpeedStats>({
    averageDownload: 0,
    averageUpload: 0,
    peakDownload: 0,
    peakUpload: 0,
    sessionStartTime: Date.now(),
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpeedsRef = useRef<{ download: number; upload: number }>({ download: 0, upload: 0 });
  const statsRef = useRef<SpeedStats>(stats);

  const addSpeedData = useCallback((downloadSpeed: number, uploadSpeed: number) => {
    const now = Date.now();
    const newPoint: SpeedDataPoint = {
      timestamp: now,
      downloadSpeed,
      uploadSpeed,
    };

    setSpeedData((prev) => {
      const updated = [...prev, newPoint];
      // Keep only last MAX_DATA_POINTS
      if (updated.length > MAX_DATA_POINTS) {
        return updated.slice(-MAX_DATA_POINTS);
      }
      return updated;
    });

    lastSpeedsRef.current = { download: downloadSpeed, upload: uploadSpeed };

    // Update stats
    setStats((prev) => {
      const dataPoints = prev.sessionStartTime > 0 
        ? Math.max(1, Math.floor((now - prev.sessionStartTime) / COLLECTION_INTERVAL))
        : 1;
      
      // Calculate new averages (incremental average)
      const newAvgDownload = prev.averageDownload > 0
        ? (prev.averageDownload * (dataPoints - 1) + downloadSpeed) / dataPoints
        : downloadSpeed;
      const newAvgUpload = prev.averageUpload > 0
        ? (prev.averageUpload * (dataPoints - 1) + uploadSpeed) / dataPoints
        : uploadSpeed;

      const newStats: SpeedStats = {
        averageDownload: newAvgDownload,
        averageUpload: newAvgUpload,
        peakDownload: Math.max(prev.peakDownload, downloadSpeed),
        peakUpload: Math.max(prev.peakUpload, uploadSpeed),
        sessionStartTime: prev.sessionStartTime > 0 ? prev.sessionStartTime : now,
      };

      statsRef.current = newStats;
      return newStats;
    });
  }, []);

  const resetStats = useCallback(() => {
    setSpeedData([]);
    const now = Date.now();
    const resetStats: SpeedStats = {
      averageDownload: 0,
      averageUpload: 0,
      peakDownload: 0,
      peakUpload: 0,
      sessionStartTime: now,
    };
    setStats(resetStats);
    statsRef.current = resetStats;
    lastSpeedsRef.current = { download: 0, upload: 0 };
  }, []);

  // Note: Speed data is collected externally via addSpeedData when transferInfo updates
  // This effect just handles cleanup
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Reset on mount when enabled
    resetStats();

    return () => {
      // Cleanup is handled externally
    };
  }, [enabled, resetStats]);

  return {
    speedData,
    stats,
    addSpeedData,
    resetStats,
    getLatestSpeeds: () => lastSpeedsRef.current,
  };
}


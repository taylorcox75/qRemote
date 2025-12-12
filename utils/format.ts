/**
 * Format utilities for displaying bytes, speeds, and time
 */

/**
 * Format bytes to human readable size
 */
export const formatSize = (bytes: number | undefined | null): string => {
  // Handle null, undefined, NaN, or non-positive values
  if (bytes == null || isNaN(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

/**
 * Format bytes per second to human readable speed
 */
export const formatSpeed = (bytes: number | undefined | null): string => {
  // Handle null, undefined, NaN, or non-positive values
  if (bytes == null || isNaN(bytes) || bytes <= 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

/**
 * Format seconds to human readable time duration
 */
export const formatTime = (seconds: number | undefined | null): string => {
  if (seconds == null || isNaN(seconds) || seconds < 0) return '∞';
  if (seconds === 0) return 'Done';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
};

/**
 * Format a ratio value (e.g., 1.5 -> "1.50")
 */
export const formatRatio = (ratio: number | undefined | null): string => {
  if (ratio == null || isNaN(ratio)) return '0.00';
  return ratio.toFixed(2);
};

/**
 * Convert KB/s to bytes/s
 */
export const kbToBytes = (kb: number): number => kb * 1024;

/**
 * Convert bytes/s to KB/s
 */
export const bytesToKb = (bytes: number): number => bytes / 1024;

/**
 * Format a percentage (0-1 range to percentage string)
 */
export const formatPercent = (value: number | undefined | null): string => {
  if (value == null || isNaN(value)) return '0%';
  return `${(value * 100).toFixed(1)}%`;
};

/**
 * Format a Unix timestamp to a locale date string
 * Returns "Not provided" for invalid timestamps (0, -1, or undefined)
 */
export const formatDate = (timestamp: number | undefined | null): string => {
  // Check if timestamp is invalid (0, -1, null, undefined, or NaN)
  if (timestamp == null || isNaN(timestamp) || timestamp <= 0) {
    return 'Not provided';
  }
  
  // Convert Unix timestamp (seconds) to milliseconds and format
  try {
    const date = new Date(timestamp * 1000);
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'Not provided';
    }
    return date.toLocaleString();
  } catch {
    return 'Not provided';
  }
};
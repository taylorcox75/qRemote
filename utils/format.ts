/**
 * Format utilities for displaying bytes, speeds, and time
 */

/**
 * Format bytes to human readable size.
 * Uses IEC binary prefixes (KiB = 1024 B, MiB = 1024 KiB, …) so the labels
 * match qBittorrent's WebUI and the underlying math (k = 1024).
 */
export const formatSize = (bytes: number | undefined | null): string => {
  // Handle null, undefined, NaN, or non-positive values
  if (bytes == null || isNaN(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

/**
 * Format bytes per second to human readable speed.
 * Uses IEC binary prefixes (KiB/s, MiB/s, GiB/s) for consistency with
 * qBittorrent's WebUI display.
 */
export const formatSpeed = (bytes: number | undefined | null): string => {
  // Handle null, undefined, NaN, or non-positive values
  if (bytes == null || isNaN(bytes) || bytes <= 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KiB/s', 'MiB/s', 'GiB/s'];
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
 * Convert KiB/s (1024 B/s) to bytes/s. Function name keeps the legacy `kb`
 * abbreviation for compatibility with existing callers, but the value is
 * binary-kilobytes (KiB).
 */
export const kbToBytes = (kb: number): number => kb * 1024;

/**
 * Convert bytes/s to KiB/s (1024 B/s). See note on `kbToBytes` about the
 * function-name abbreviation.
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
 * One-ULP guard for flooring binary floats that represent exact decimals:
 * 0.29 * 100 === 28.999999999999996, which Math.floor would truncate to 28.
 * Small enough that a genuinely-below-boundary value (e.g. 0.9999) can never
 * be pushed across it.
 */
const FLOOR_EPSILON = 1e-6;

/**
 * Floor a value to `decimals` places without ever rounding up.
 */
export const floorTo = (value: number, decimals: number): number => {
  const factor = Math.pow(10, decimals);
  return Math.floor(value * factor + FLOOR_EPSILON) / factor;
};

/**
 * Format a 0-1 progress fraction as a truncated percentage string.
 * Truncates rather than rounds so an incomplete torrent (0.9995) never
 * displays as "100%" — below 1.0 the file cannot yet be assembled.
 */
export const formatProgress = (
  fraction: number | undefined | null,
  decimals: number = 1,
): string => {
  if (fraction == null || isNaN(fraction)) return `${(0).toFixed(decimals)}%`;
  return `${floorTo(fraction * 100, decimals).toFixed(decimals)}%`;
};

/**
 * Format an availability ratio truncated to 3 decimals (e.g. 0.9999 -> "0.999").
 * Truncates rather than rounds because availability just below 1.0 means the
 * complete file cannot be assembled from currently-connected peers — rounding
 * up to "1.000" hides exactly the state the user needs to see.
 */
export const formatAvailability = (availability: number | undefined | null): string => {
  if (availability == null || isNaN(availability)) return '0.000';
  return floorTo(availability, 3).toFixed(3);
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
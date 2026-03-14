import {
  formatSize,
  formatSpeed,
  formatTime,
  formatDate,
  formatRatio,
  formatPercent,
} from '@/utils/format';

describe('formatSize', () => {
  it('returns "0 B" for 0 bytes', () => {
    expect(formatSize(0)).toBe('0 B');
  });

  it('returns "0 B" for null', () => {
    expect(formatSize(null)).toBe('0 B');
  });

  it('returns "0 B" for undefined', () => {
    expect(formatSize(undefined)).toBe('0 B');
  });

  it('returns "0 B" for NaN', () => {
    expect(formatSize(NaN)).toBe('0 B');
  });

  it('returns "0 B" for negative values', () => {
    expect(formatSize(-100)).toBe('0 B');
  });

  it('formats bytes correctly', () => {
    expect(formatSize(500)).toBe('500.00 B');
  });

  it('formats KB correctly', () => {
    expect(formatSize(1024)).toBe('1.00 KB');
    expect(formatSize(1536)).toBe('1.50 KB');
  });

  it('formats MB correctly', () => {
    expect(formatSize(1048576)).toBe('1.00 MB');
    expect(formatSize(5 * 1024 * 1024)).toBe('5.00 MB');
  });

  it('formats GB correctly', () => {
    expect(formatSize(1073741824)).toBe('1.00 GB');
  });

  it('formats TB correctly', () => {
    expect(formatSize(1099511627776)).toBe('1.00 TB');
  });

  it('handles very large numbers', () => {
    const result = formatSize(5 * 1099511627776);
    expect(result).toBe('5.00 TB');
  });
});

describe('formatSpeed', () => {
  it('returns "0 B/s" for 0 bytes', () => {
    expect(formatSpeed(0)).toBe('0 B/s');
  });

  it('returns "0 B/s" for null', () => {
    expect(formatSpeed(null)).toBe('0 B/s');
  });

  it('returns "0 B/s" for undefined', () => {
    expect(formatSpeed(undefined)).toBe('0 B/s');
  });

  it('returns "0 B/s" for NaN', () => {
    expect(formatSpeed(NaN)).toBe('0 B/s');
  });

  it('returns "0 B/s" for negative values', () => {
    expect(formatSpeed(-500)).toBe('0 B/s');
  });

  it('formats B/s correctly', () => {
    expect(formatSpeed(500)).toBe('500.0 B/s');
  });

  it('formats KB/s correctly', () => {
    expect(formatSpeed(1024)).toBe('1.0 KB/s');
    expect(formatSpeed(8700)).toBe('8.5 KB/s');
  });

  it('formats MB/s correctly', () => {
    expect(formatSpeed(1048576)).toBe('1.0 MB/s');
  });

  it('formats GB/s correctly', () => {
    expect(formatSpeed(1073741824)).toBe('1.0 GB/s');
  });

  it('handles very large numbers', () => {
    const result = formatSpeed(10 * 1073741824);
    expect(result).toBe('10.0 GB/s');
  });
});

describe('formatTime', () => {
  it('returns "Done" for 0 seconds', () => {
    expect(formatTime(0)).toBe('Done');
  });

  it('returns "∞" for negative values', () => {
    expect(formatTime(-1)).toBe('∞');
    expect(formatTime(-100)).toBe('∞');
  });

  it('returns "∞" for null', () => {
    expect(formatTime(null)).toBe('∞');
  });

  it('returns "∞" for undefined', () => {
    expect(formatTime(undefined)).toBe('∞');
  });

  it('returns "∞" for NaN', () => {
    expect(formatTime(NaN)).toBe('∞');
  });

  it('formats seconds only', () => {
    expect(formatTime(45)).toBe('45s');
  });

  it('formats minutes and seconds', () => {
    expect(formatTime(90)).toBe('1m 30s');
    expect(formatTime(600)).toBe('10m 0s');
  });

  it('formats hours and minutes', () => {
    expect(formatTime(3600)).toBe('1h 0m');
    expect(formatTime(3661)).toBe('1h 1m');
  });

  it('handles very large values (days worth)', () => {
    expect(formatTime(86400)).toBe('24h 0m');
    expect(formatTime(100000)).toBe('27h 46m');
  });
});

describe('formatDate', () => {
  it('returns a date string for valid timestamps', () => {
    const result = formatDate(1700000000);
    expect(typeof result).toBe('string');
    expect(result).not.toBe('Not provided');
  });

  it('returns "Not provided" for 0', () => {
    expect(formatDate(0)).toBe('Not provided');
  });

  it('returns "Not provided" for negative values', () => {
    expect(formatDate(-1)).toBe('Not provided');
  });

  it('returns "Not provided" for null', () => {
    expect(formatDate(null)).toBe('Not provided');
  });

  it('returns "Not provided" for undefined', () => {
    expect(formatDate(undefined)).toBe('Not provided');
  });

  it('returns "Not provided" for NaN', () => {
    expect(formatDate(NaN)).toBe('Not provided');
  });

  it('produces valid date for Unix epoch + 1', () => {
    const result = formatDate(1);
    expect(result).not.toBe('Not provided');
  });
});

describe('formatRatio', () => {
  it('returns "0.00" for null', () => {
    expect(formatRatio(null)).toBe('0.00');
  });

  it('returns "0.00" for undefined', () => {
    expect(formatRatio(undefined)).toBe('0.00');
  });

  it('returns "0.00" for NaN', () => {
    expect(formatRatio(NaN)).toBe('0.00');
  });

  it('formats 0 correctly', () => {
    expect(formatRatio(0)).toBe('0.00');
  });

  it('formats positive ratios correctly', () => {
    expect(formatRatio(1.5)).toBe('1.50');
    expect(formatRatio(0.123)).toBe('0.12');
  });

  it('formats negative ratios', () => {
    expect(formatRatio(-1)).toBe('-1.00');
  });

  it('formats very large ratios', () => {
    expect(formatRatio(999.999)).toBe('1000.00');
  });
});

describe('formatPercent', () => {
  it('returns "0%" for null', () => {
    expect(formatPercent(null)).toBe('0%');
  });

  it('returns "0%" for undefined', () => {
    expect(formatPercent(undefined)).toBe('0%');
  });

  it('returns "0%" for NaN', () => {
    expect(formatPercent(NaN)).toBe('0%');
  });

  it('formats 0 correctly', () => {
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('formats 100% correctly', () => {
    expect(formatPercent(1)).toBe('100.0%');
  });

  it('formats partial percentages', () => {
    expect(formatPercent(0.5)).toBe('50.0%');
    expect(formatPercent(0.723)).toBe('72.3%');
  });

  it('formats values > 1', () => {
    expect(formatPercent(1.5)).toBe('150.0%');
  });

  it('formats negative values', () => {
    expect(formatPercent(-0.1)).toBe('-10.0%');
  });
});

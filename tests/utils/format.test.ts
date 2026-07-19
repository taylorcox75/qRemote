import {
  formatSize,
  formatSpeed,
  formatTime,
  formatDate,
  formatRatio,
  formatPercent,
  floorTo,
  formatProgress,
  formatAvailability,
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

  it('formats KiB correctly', () => {
    expect(formatSize(1024)).toBe('1.00 KiB');
    expect(formatSize(1536)).toBe('1.50 KiB');
  });

  it('formats MiB correctly', () => {
    expect(formatSize(1048576)).toBe('1.00 MiB');
    expect(formatSize(5 * 1024 * 1024)).toBe('5.00 MiB');
  });

  it('formats GiB correctly', () => {
    expect(formatSize(1073741824)).toBe('1.00 GiB');
  });

  it('formats TiB correctly', () => {
    expect(formatSize(1099511627776)).toBe('1.00 TiB');
  });

  it('handles very large numbers', () => {
    const result = formatSize(5 * 1099511627776);
    expect(result).toBe('5.00 TiB');
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

  it('formats KiB/s correctly', () => {
    expect(formatSpeed(1024)).toBe('1.0 KiB/s');
    expect(formatSpeed(8700)).toBe('8.5 KiB/s');
  });

  it('formats MiB/s correctly', () => {
    expect(formatSpeed(1048576)).toBe('1.0 MiB/s');
  });

  it('formats GiB/s correctly', () => {
    expect(formatSpeed(1073741824)).toBe('1.0 GiB/s');
  });

  it('handles very large numbers', () => {
    const result = formatSpeed(10 * 1073741824);
    expect(result).toBe('10.0 GiB/s');
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

describe('floorTo', () => {
  it('floors without rounding up', () => {
    expect(floorTo(99.99, 1)).toBe(99.9);
    expect(floorTo(99.95, 0)).toBe(99);
  });

  it('does not truncate exact decimals that binary floats under-represent', () => {
    // 0.29 * 100 === 28.999999999999996 — naive Math.floor gives 28
    expect(floorTo(0.29 * 100, 0)).toBe(29);
    expect(floorTo(0.58 * 100, 0)).toBe(58);
    expect(floorTo(1.005, 3)).toBe(1.005);
  });

  it('never pushes a genuinely-below-boundary value across it', () => {
    expect(floorTo(99.9999, 0)).toBe(99);
    expect(floorTo(0.9999, 3)).toBe(0.999);
  });
});

describe('formatProgress', () => {
  it('returns zero for null, undefined, and NaN', () => {
    expect(formatProgress(null)).toBe('0.0%');
    expect(formatProgress(undefined)).toBe('0.0%');
    expect(formatProgress(NaN)).toBe('0.0%');
    expect(formatProgress(null, 0)).toBe('0%');
  });

  it('truncates instead of rounding up near completion', () => {
    expect(formatProgress(0.9995)).toBe('99.9%');
    expect(formatProgress(0.999999)).toBe('99.9%');
    expect(formatProgress(0.995, 0)).toBe('99%');
  });

  it('shows 100% only at exactly complete', () => {
    expect(formatProgress(1)).toBe('100.0%');
    expect(formatProgress(1, 0)).toBe('100%');
  });

  it('does not understate exact percentages (float one-ULP guard)', () => {
    expect(formatProgress(0.29, 0)).toBe('29%');
    expect(formatProgress(0.58, 0)).toBe('58%');
    expect(formatProgress(0.723)).toBe('72.3%');
  });

  it('truncates mid-range extra precision', () => {
    expect(formatProgress(0.8615)).toBe('86.1%');
  });
});

describe('formatAvailability', () => {
  it('returns "0.000" for null, undefined, and NaN', () => {
    expect(formatAvailability(null)).toBe('0.000');
    expect(formatAvailability(undefined)).toBe('0.000');
    expect(formatAvailability(NaN)).toBe('0.000');
  });

  it('truncates instead of rounding up to 1.000', () => {
    expect(formatAvailability(0.9999)).toBe('0.999');
    expect(formatAvailability(0.99999)).toBe('0.999');
  });

  it('shows 1.000 only at exactly 1', () => {
    expect(formatAvailability(1)).toBe('1.000');
  });

  it('handles ratios above 1 and float one-ULP values', () => {
    expect(formatAvailability(2.5)).toBe('2.500');
    // 1.005 * 1000 === 1004.9999999999999 — naive Math.floor gives 1.004
    expect(formatAvailability(1.005)).toBe('1.005');
  });
});

describe('formatDate', () => {
  it('returns "Not provided" for a value that produces an invalid Date', () => {
    expect(formatDate(Infinity)).toBe('Not provided');
  });

  it('returns "Not provided" when Date construction throws', () => {
    const RealDate = global.Date;
    function ThrowingDate(): never {
      throw new Error('boom');
    }
    global.Date = ThrowingDate as unknown as DateConstructor;
    try {
      expect(formatDate(1700000000)).toBe('Not provided');
    } finally {
      global.Date = RealDate;
    }
  });

  it('formats a valid timestamp', () => {
    expect(formatDate(1700000000)).not.toBe('Not provided');
  });
});

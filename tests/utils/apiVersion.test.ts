import { parseApiVersion, getApiFeatures } from '@/utils/apiVersion';

describe('parseApiVersion', () => {
  it('parses a standard major.minor.patch string', () => {
    expect(parseApiVersion('2.11.3')).toEqual({ major: 2, minor: 11, patch: 3 });
  });

  it('defaults patch to 0 when omitted', () => {
    expect(parseApiVersion('2.8')).toEqual({ major: 2, minor: 8, patch: 0 });
  });

  it('trims whitespace', () => {
    expect(parseApiVersion('  2.8.1  ')).toEqual({ major: 2, minor: 8, patch: 1 });
  });

  it('returns null when fewer than 2 parts are given', () => {
    expect(parseApiVersion('2')).toBeNull();
  });

  it('returns null for non-numeric parts', () => {
    expect(parseApiVersion('a.b.c')).toBeNull();
    expect(parseApiVersion('2.x')).toBeNull();
  });
});

describe('getApiFeatures', () => {
  it('returns the full v5 feature set when apiVersion is null', () => {
    const features = getApiFeatures(null);
    expect(features).toEqual({
      useStartStopEndpoints: true,
      hasRatioLimitFields: true,
      hasContentPath: true,
      supportsInactiveSeedingLimit: true,
      supportsSetCookies: true,
      supportsSearchDownloadTorrent: true,
    });
  });

  it('returns the full v5 feature set when apiVersion is unparseable', () => {
    expect(getApiFeatures('garbage')).toEqual(getApiFeatures(null));
  });

  it('gates v5-only features off below 2.11', () => {
    const features = getApiFeatures('2.9.0');
    expect(features.useStartStopEndpoints).toBe(false);
    expect(features.hasContentPath).toBe(false);
    expect(features.supportsInactiveSeedingLimit).toBe(false);
    expect(features.supportsSetCookies).toBe(false);
    expect(features.supportsSearchDownloadTorrent).toBe(false);
    // ratio limit fields only require 2.8+
    expect(features.hasRatioLimitFields).toBe(true);
  });

  it('gates hasRatioLimitFields off below 2.8', () => {
    const features = getApiFeatures('2.7.0');
    expect(features.hasRatioLimitFields).toBe(false);
  });

  it('enables all v5 features at exactly 2.11.0', () => {
    const features = getApiFeatures('2.11.0');
    expect(features.useStartStopEndpoints).toBe(true);
    expect(features.hasContentPath).toBe(true);
    expect(features.supportsInactiveSeedingLimit).toBe(true);
    expect(features.supportsSetCookies).toBe(true);
    expect(features.supportsSearchDownloadTorrent).toBe(true);
  });

  it('enables v5 features above major version 2 (e.g. 3.0.0)', () => {
    const features = getApiFeatures('3.0.0');
    expect(features.useStartStopEndpoints).toBe(true);
  });

  it('handles a higher minor within the same major correctly via gte', () => {
    expect(getApiFeatures('2.12.0').useStartStopEndpoints).toBe(true);
  });

  it('handles a lower major version correctly (1.x is below 2.11)', () => {
    const features = getApiFeatures('1.9.0');
    expect(features.useStartStopEndpoints).toBe(false);
    expect(features.hasRatioLimitFields).toBe(false);
  });
});

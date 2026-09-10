import { parseApiVersion, getApiFeatures, getPauseOnAddPreferenceKey } from '@/utils/apiVersion';

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
      useAddStoppedEnabledPreference: true,
      useStoppedAddParam: true,
      useContentLayoutAddParam: true,
      supportsGetDirectoryContent: true,
      supportsSearchPubDate: true,
      hasIsPrivate: true,
      hasModernProxyFields: true,
      supportsI2p: true,
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
    expect(features.useAddStoppedEnabledPreference).toBe(false);
    expect(features.useStoppedAddParam).toBe(false);
    expect(features.supportsGetDirectoryContent).toBe(false);
    expect(features.supportsSearchPubDate).toBe(false);
    expect(features.supportsI2p).toBe(false);
    // ratio limit fields only require 2.8+, modern proxy fields and is_private only require 2.9+,
    // contentLayout only requires 2.7+
    expect(features.hasRatioLimitFields).toBe(true);
    expect(features.hasModernProxyFields).toBe(true);
    expect(features.hasIsPrivate).toBe(true);
    expect(features.useContentLayoutAddParam).toBe(true);
  });

  it('gates useContentLayoutAddParam off below 2.7', () => {
    expect(getApiFeatures('2.6.0').useContentLayoutAddParam).toBe(false);
  });

  it('gates hasIsPrivate off below 2.9 (is_private was added alongside the 4.6 proxy fields)', () => {
    expect(getApiFeatures('2.8.5').hasIsPrivate).toBe(false);
  });

  it('enables hasIsPrivate at exactly 2.9.0', () => {
    expect(getApiFeatures('2.9.0').hasIsPrivate).toBe(true);
  });

  it('gates hasRatioLimitFields off below 2.8', () => {
    const features = getApiFeatures('2.7.0');
    expect(features.hasRatioLimitFields).toBe(false);
  });

  it('gates hasModernProxyFields off below 2.9 but keeps hasRatioLimitFields on', () => {
    const features = getApiFeatures('2.8.5');
    expect(features.hasModernProxyFields).toBe(false);
    expect(features.hasRatioLimitFields).toBe(true);
  });

  it('enables hasModernProxyFields at exactly 2.9.0', () => {
    expect(getApiFeatures('2.9.0').hasModernProxyFields).toBe(true);
  });

  it('enables all v5 features at exactly 2.11.0', () => {
    const features = getApiFeatures('2.11.0');
    expect(features.useStartStopEndpoints).toBe(true);
    expect(features.hasContentPath).toBe(true);
    expect(features.supportsInactiveSeedingLimit).toBe(true);
    expect(features.supportsSetCookies).toBe(true);
    expect(features.supportsSearchDownloadTorrent).toBe(true);
    expect(features.useAddStoppedEnabledPreference).toBe(true);
    expect(features.useStoppedAddParam).toBe(true);
    expect(features.useContentLayoutAddParam).toBe(true);
    expect(features.supportsGetDirectoryContent).toBe(true);
    expect(features.supportsSearchPubDate).toBe(true);
    expect(features.hasIsPrivate).toBe(true);
    expect(features.hasModernProxyFields).toBe(true);
    expect(features.supportsI2p).toBe(true);
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
    expect(features.hasModernProxyFields).toBe(false);
  });
});

describe('getPauseOnAddPreferenceKey', () => {
  it('uses the renamed key on qBit 5.0+ (WebAPI >= 2.11)', () => {
    expect(getPauseOnAddPreferenceKey(getApiFeatures('2.11.0'))).toBe('add_stopped_enabled');
  });

  it('uses the legacy key on qBit 4.x (WebAPI < 2.11)', () => {
    expect(getPauseOnAddPreferenceKey(getApiFeatures('2.9.0'))).toBe('start_paused_enabled');
  });
});

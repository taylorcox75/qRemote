import { parseApiVersion, getApiFeatures, getPauseOnAddPreferenceKey } from '@/utils/apiVersion';

describe('parseApiVersion', () => {
  it('returns null instead of throwing for a non-string (#308)', () => {
    expect(parseApiVersion(2.6 as unknown as string)).toBeNull();
    expect(getApiFeatures(2.6 as unknown as string).useStartStopEndpoints).toBe(true);
  });

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
      supportsShareLimitAction: true,
      supportsRenameFolder: true,
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
      supportsFetchMetadata: true,
      supportsFetchMetadataDownloader: true,
    });
  });

  it('returns the full v5 feature set when apiVersion is unparseable', () => {
    expect(getApiFeatures('garbage')).toEqual(getApiFeatures(null));
  });

  it('gates v5-only features off below 2.11', () => {
    const features = getApiFeatures('2.9.0');
    expect(features.useStartStopEndpoints).toBe(false);
    expect(features.hasContentPath).toBe(false);
    expect(features.supportsShareLimitAction).toBe(false);
    expect(features.supportsSetCookies).toBe(false);
    expect(features.supportsSearchDownloadTorrent).toBe(false);
    expect(features.useAddStoppedEnabledPreference).toBe(false);
    expect(features.useStoppedAddParam).toBe(false);
    expect(features.supportsGetDirectoryContent).toBe(false);
    expect(features.supportsSearchPubDate).toBe(false);
    expect(features.supportsFetchMetadata).toBe(false);
    expect(features.supportsFetchMetadataDownloader).toBe(false);
    // ratio limit fields only require 2.8+, modern proxy fields and is_private only require 2.9+,
    // contentLayout only requires 2.7+
    expect(features.hasRatioLimitFields).toBe(true);
    expect(features.hasModernProxyFields).toBe(true);
    expect(features.hasIsPrivate).toBe(true);
    expect(features.useContentLayoutAddParam).toBe(true);
  });

  it('gates inactiveSeedingTimeLimit on WebAPI 2.9.2 (qBit 4.6.0rc1), where setShareLimits starts requiring it', () => {
    // 4.5.5 = 2.8.19, 4.6.0beta1 = 2.9.1: not accepted yet.
    expect(getApiFeatures('2.8.19').supportsInactiveSeedingLimit).toBe(false);
    expect(getApiFeatures('2.9.1').supportsInactiveSeedingLimit).toBe(false);
    // 4.6.0 = 2.9.2, 4.6.7 = 2.9.3: required — omitting it answers 400.
    expect(getApiFeatures('2.9.2').supportsInactiveSeedingLimit).toBe(true);
    expect(getApiFeatures('2.9.3').supportsInactiveSeedingLimit).toBe(true);
    expect(getApiFeatures('2.11.0').supportsInactiveSeedingLimit).toBe(true);
  });

  it('keeps shareLimitAction on the 5.0 gate, separate from inactiveSeedingTimeLimit', () => {
    expect(getApiFeatures('2.9.3').supportsShareLimitAction).toBe(false);
    expect(getApiFeatures('2.11.0').supportsShareLimitAction).toBe(true);
    expect(getApiFeatures('2.15.1').supportsShareLimitAction).toBe(true);
  });

  it('gates I2P settings on WebAPI 2.9.3 (qBit 4.6.1), where setPreferences first writes them', () => {
    expect(getApiFeatures('2.9.2').supportsI2p).toBe(false);
    expect(getApiFeatures('2.9.3').supportsI2p).toBe(true);
    expect(getApiFeatures('2.11.0').supportsI2p).toBe(true);
  });

  it('gates renameFolder on WebAPI 2.7.0', () => {
    expect(getApiFeatures('2.6.0').supportsRenameFolder).toBe(false);
    expect(getApiFeatures('2.7.0').supportsRenameFolder).toBe(true);
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

  it('gates fetchMetadata (#267) on WebAPI 2.11.9, not on the 5.0 boundary', () => {
    // qBit 5.0 (2.11.0) through 5.1.x (2.11.4) predate the endpoint.
    expect(getApiFeatures('2.11.0').supportsFetchMetadata).toBe(false);
    expect(getApiFeatures('2.11.4').supportsFetchMetadata).toBe(false);
    expect(getApiFeatures('2.11.8').supportsFetchMetadata).toBe(false);
    expect(getApiFeatures('2.11.9').supportsFetchMetadata).toBe(true);
    expect(getApiFeatures('2.11.10').supportsFetchMetadata).toBe(true);
    expect(getApiFeatures('2.12.0').supportsFetchMetadata).toBe(true);
    expect(getApiFeatures('2.8.19').supportsFetchMetadata).toBe(false);
  });

  it('gates the fetchMetadata "downloader" param on WebAPI 2.13.1', () => {
    expect(getApiFeatures('2.11.9').supportsFetchMetadataDownloader).toBe(false);
    expect(getApiFeatures('2.13.0').supportsFetchMetadataDownloader).toBe(false);
    expect(getApiFeatures('2.13.1').supportsFetchMetadataDownloader).toBe(true);
    expect(getApiFeatures('2.15.1').supportsFetchMetadataDownloader).toBe(true);
    // Unknown/unparseable version assumes the newest feature set.
    expect(getApiFeatures(null).supportsFetchMetadataDownloader).toBe(true);
    expect(getApiFeatures('garbage').supportsFetchMetadata).toBe(true);
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

describe('app.config magnet registration', () => {
  const config = require('../../app.config.js');
  const expoConfig = config.expo;

  it('registers magnet URL scheme on iOS', () => {
    const urlTypes = expoConfig?.ios?.infoPlist?.CFBundleURLTypes;
    expect(Array.isArray(urlTypes)).toBe(true);

    const hasMagnetScheme = urlTypes.some((entry: { CFBundleURLSchemes?: string[] }) =>
      Array.isArray(entry.CFBundleURLSchemes) && entry.CFBundleURLSchemes.includes('magnet')
    );

    expect(hasMagnetScheme).toBe(true);
  });

  it('registers magnet intent filter on Android', () => {
    const intentFilters = expoConfig?.android?.intentFilters;
    expect(Array.isArray(intentFilters)).toBe(true);

    const hasMagnetIntent = intentFilters.some((filter: { data?: Array<{ scheme?: string }> }) =>
      Array.isArray(filter.data) && filter.data.some((d) => d.scheme === 'magnet')
    );

    expect(hasMagnetIntent).toBe(true);
  });
});

describe('app.config torrent file registration', () => {
  const config = require('../../app.config.js');
  const expoConfig = config.expo;

  it('registers .torrent document types on iOS', () => {
    const documentTypes = expoConfig?.ios?.infoPlist?.CFBundleDocumentTypes;
    expect(Array.isArray(documentTypes)).toBe(true);

    const hasTorrentType = documentTypes.some((entry: { LSItemContentTypes?: string[] }) =>
      Array.isArray(entry.LSItemContentTypes) && entry.LSItemContentTypes.includes('org.bittorrent.torrent')
    );

    expect(hasTorrentType).toBe(true);
  });

  it('declares the torrent UTI with the .torrent extension on iOS', () => {
    const importedTypes = expoConfig?.ios?.infoPlist?.UTImportedTypeDeclarations;
    expect(Array.isArray(importedTypes)).toBe(true);

    const torrentType = importedTypes.find(
      (entry: { UTTypeIdentifier?: string }) => entry.UTTypeIdentifier === 'org.bittorrent.torrent'
    );

    expect(torrentType).toBeDefined();
    expect(torrentType.UTTypeTagSpecification['public.filename-extension']).toContain('torrent');
    expect(torrentType.UTTypeTagSpecification['public.mime-type']).toContain('application/x-bittorrent');
  });

  it('registers torrent mime-type intent filter on Android', () => {
    const intentFilters = expoConfig?.android?.intentFilters;
    expect(Array.isArray(intentFilters)).toBe(true);

    const hasTorrentIntent = intentFilters.some((filter: { data?: Array<{ mimeType?: string }> }) =>
      Array.isArray(filter.data) && filter.data.some((d) => d.mimeType === 'application/x-bittorrent')
    );

    expect(hasTorrentIntent).toBe(true);
  });
});

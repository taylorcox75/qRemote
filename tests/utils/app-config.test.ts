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

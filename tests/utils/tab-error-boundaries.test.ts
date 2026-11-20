import fs from 'fs';
import path from 'path';

// With Liquid Glass on, expo-router native tabs mount every tab as soon as the
// app connects (#334). A render error in any tab must stay inside that tab, so
// each tab's route entry exports its own ErrorBoundary.
const TAB_ENTRIES = [
  'app/(tabs)/(torrents)/_layout.tsx',
  'app/(tabs)/transfer.tsx',
  'app/(tabs)/search.tsx',
  'app/(tabs)/rss/_layout.tsx',
  'app/(tabs)/settings/_layout.tsx',
];

describe('tab error boundaries', () => {
  it.each(TAB_ENTRIES)('%s exports an ErrorBoundary', (file) => {
    const src = fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');
    expect(src).toMatch(/export \{ AppErrorBoundary as ErrorBoundary \}/);
  });

  it('covers every tab directory and file under app/(tabs)', () => {
    const tabsDir = path.join(__dirname, '../../app/(tabs)');
    const entries = fs
      .readdirSync(tabsDir)
      .filter((name) => name !== '_layout.tsx' && !name.startsWith('.'));
    const covered = TAB_ENTRIES.map((f) => f.split('/')[2]);
    for (const name of entries) expect(covered).toContain(name);
  });
});

import {
  orderPluginsWithPins,
  prunePinnedPlugins,
  togglePinnedPlugin,
} from '@/utils/search-plugins';

const names = (list: { name: string }[]) => list.map((p) => p.name);

describe('orderPluginsWithPins', () => {
  const sorted = [
    { name: 'alpha', enabled: true },
    { name: 'beta', enabled: true },
    { name: 'gamma', enabled: true },
    { name: 'delta', enabled: false },
  ];

  it('returns the list unchanged (as a copy) when nothing is pinned', () => {
    const result = orderPluginsWithPins(sorted, []);
    expect(names(result)).toEqual(['alpha', 'beta', 'gamma', 'delta']);
    expect(result).not.toBe(sorted);
  });

  it('treats undefined or null pins as none', () => {
    expect(names(orderPluginsWithPins(sorted, undefined))).toEqual(names(sorted));
    expect(names(orderPluginsWithPins(sorted, null))).toEqual(names(sorted));
  });

  it('moves pinned plugins to the front, keeping the incoming order within each group', () => {
    const result = orderPluginsWithPins(sorted, ['gamma', 'beta']);
    // gamma was pinned first, but the existing sorted order wins inside the group.
    expect(names(result)).toEqual(['beta', 'gamma', 'alpha', 'delta']);
  });

  it('keeps a disabled pinned plugin behind enabled pinned ones', () => {
    const result = orderPluginsWithPins(sorted, ['delta', 'alpha']);
    expect(names(result)).toEqual(['alpha', 'delta', 'beta', 'gamma']);
  });

  it('ignores pinned names that are not installed', () => {
    const result = orderPluginsWithPins(sorted, ['ghost', 'beta']);
    expect(names(result)).toEqual(['beta', 'alpha', 'gamma', 'delta']);
  });

  it('does not duplicate a plugin pinned twice', () => {
    const result = orderPluginsWithPins(sorted, ['beta', 'beta']);
    expect(names(result)).toEqual(['beta', 'alpha', 'gamma', 'delta']);
  });

  it('handles an empty plugin list', () => {
    expect(orderPluginsWithPins([], ['alpha'])).toEqual([]);
  });

  it('preserves the full plugin objects', () => {
    const result = orderPluginsWithPins(sorted, ['delta']);
    expect(result[0]).toBe(sorted[3]);
  });
});

describe('prunePinnedPlugins', () => {
  const installed = [{ name: 'alpha' }, { name: 'beta' }];

  it('returns [] for no pins', () => {
    expect(prunePinnedPlugins([], installed)).toEqual([]);
    expect(prunePinnedPlugins(undefined, installed)).toEqual([]);
    expect(prunePinnedPlugins(null, installed)).toEqual([]);
  });

  it('drops names that are no longer installed', () => {
    expect(prunePinnedPlugins(['alpha', 'ghost', 'beta'], installed)).toEqual(['alpha', 'beta']);
  });

  it('removes duplicates, keeping the first occurrence', () => {
    expect(prunePinnedPlugins(['beta', 'alpha', 'beta'], installed)).toEqual(['beta', 'alpha']);
  });

  it('prunes everything when no plugins are installed', () => {
    expect(prunePinnedPlugins(['alpha'], [])).toEqual([]);
  });
});

describe('togglePinnedPlugin', () => {
  const installed = [{ name: 'alpha' }, { name: 'beta' }, { name: 'gamma' }];

  it('pins an unpinned plugin, appending it', () => {
    expect(togglePinnedPlugin([], 'beta', installed)).toEqual(['beta']);
    expect(togglePinnedPlugin(['gamma'], 'alpha', installed)).toEqual(['gamma', 'alpha']);
  });

  it('unpins a pinned plugin', () => {
    expect(togglePinnedPlugin(['alpha', 'beta'], 'alpha', installed)).toEqual(['beta']);
    expect(togglePinnedPlugin(['beta'], 'beta', installed)).toEqual([]);
  });

  it('treats undefined or null pins as none', () => {
    expect(togglePinnedPlugin(undefined, 'alpha', installed)).toEqual(['alpha']);
    expect(togglePinnedPlugin(null, 'alpha', installed)).toEqual(['alpha']);
  });

  it('cannot pin a plugin that is not installed', () => {
    expect(togglePinnedPlugin(['alpha'], 'ghost', installed)).toEqual(['alpha']);
  });

  it('drops pins for uninstalled plugins and duplicates while toggling', () => {
    expect(togglePinnedPlugin(['ghost', 'alpha', 'alpha'], 'beta', installed)).toEqual([
      'alpha',
      'beta',
    ]);
  });

  it('does not mutate the pinned list it is given', () => {
    const pinned = ['alpha'];
    togglePinnedPlugin(pinned, 'beta', installed);
    expect(pinned).toEqual(['alpha']);
  });
});

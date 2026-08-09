import { groupCartItemsForAdd } from '@/utils/search-cart';
import { SearchCartItem } from '@/context/SearchCartContext';

function item(overrides: Partial<SearchCartItem>): SearchCartItem {
  return {
    fileUrl: 'magnet:?xt=urn:btih:default',
    fileName: 'Result',
    fileSize: 100,
    nbSeeders: 5,
    indexerLabel: 'IndexerA',
    ...overrides,
  };
}

describe('groupCartItemsForAdd', () => {
  it('returns an empty array for an empty cart', () => {
    expect(groupCartItemsForAdd([], true)).toEqual([]);
    expect(groupCartItemsForAdd([], false)).toEqual([]);
  });

  it('returns a single untagged group when auto-tag is off, regardless of indexer mix', () => {
    const items = [
      item({ fileUrl: 'url1', indexerLabel: 'IndexerA' }),
      item({ fileUrl: 'url2', indexerLabel: 'IndexerB' }),
    ];
    expect(groupCartItemsForAdd(items, false)).toEqual([{ urls: ['url1', 'url2'], tag: null }]);
  });

  it('returns a single tagged group when auto-tag is on and every item shares one indexer', () => {
    const items = [
      item({ fileUrl: 'url1', indexerLabel: 'IndexerA' }),
      item({ fileUrl: 'url2', indexerLabel: 'IndexerA' }),
    ];
    expect(groupCartItemsForAdd(items, true)).toEqual([
      { urls: ['url1', 'url2'], tag: 'IndexerA' },
    ]);
  });

  it('splits into one group per indexer, in first-appearance order', () => {
    const items = [
      item({ fileUrl: 'url1', indexerLabel: 'IndexerA' }),
      item({ fileUrl: 'url2', indexerLabel: 'IndexerB' }),
      item({ fileUrl: 'url3', indexerLabel: 'IndexerA' }),
    ];
    expect(groupCartItemsForAdd(items, true)).toEqual([
      { urls: ['url1', 'url3'], tag: 'IndexerA' },
      { urls: ['url2'], tag: 'IndexerB' },
    ]);
  });

  it('groups empty and whitespace-only labels into one untagged bucket', () => {
    const items = [
      item({ fileUrl: 'url1', indexerLabel: '' }),
      item({ fileUrl: 'url2', indexerLabel: '   ' }),
    ];
    expect(groupCartItemsForAdd(items, true)).toEqual([{ urls: ['url1', 'url2'], tag: null }]);
  });

  it('produces both a labeled and an untagged group for a mixed cart', () => {
    const items = [
      item({ fileUrl: 'url1', indexerLabel: 'IndexerA' }),
      item({ fileUrl: 'url2', indexerLabel: '' }),
      item({ fileUrl: 'url3', indexerLabel: 'IndexerA' }),
    ];
    expect(groupCartItemsForAdd(items, true)).toEqual([
      { urls: ['url1', 'url3'], tag: 'IndexerA' },
      { urls: ['url2'], tag: null },
    ]);
  });
});

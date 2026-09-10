// Minimal local mirror of services/tmdb.ts's Artwork shape (the module itself
// is mocked below, so we don't import types from it).
type TmdbMediaType = 'movie' | 'tv';
interface Artwork {
  tmdbId: number;
  mediaType: TmdbMediaType;
  title: string;
  year?: number;
  posterPath: string | null;
  backdropPath: string | null;
  popularity: number;
}

const mockAsyncStorageBacking: Record<string, string> = {};
const mockGetItem = jest.fn((key: string) => Promise.resolve(mockAsyncStorageBacking[key] ?? null));
const mockSetItem = jest.fn((key: string, value: string) => {
  mockAsyncStorageBacking[key] = value;
  return Promise.resolve();
});
const mockRemoveItem = jest.fn((key: string) => {
  delete mockAsyncStorageBacking[key];
  return Promise.resolve();
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: mockGetItem,
  setItem: mockSetItem,
  removeItem: mockRemoveItem,
}));

class MockTmdbRateLimitError extends Error {
  retryAfterMs: number;
  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = 'TmdbRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

const mockSearchArtwork = jest.fn();

jest.mock('@/services/tmdb', () => ({
  searchArtwork: mockSearchArtwork,
  TmdbRateLimitError: MockTmdbRateLimitError,
}));

interface ParsedReleaseName {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  looksLikeTV: boolean;
  resolution?: string;
  source?: string;
  codec?: string;
  group?: string;
  languages: string[];
}

const mockParseReleaseName = jest.fn((name: string): ParsedReleaseName => ({
  title: name,
  looksLikeTV: false,
  languages: [] as string[],
}));

jest.mock('@/utils/release-name', () => ({
  parseReleaseName: mockParseReleaseName,
}));

// The store is a module-level singleton (in-memory cache, in-flight map,
// semaphore, debounce timer). Tests must not leak that state into each
// other, so each test requires a fresh module instance after
// jest.resetModules(). The jest.mock factories above close over the
// "mock"-prefixed consts rather than creating new jest.fn()s, so those
// references stay valid (and controllable) across resets.
type ArtworkStoreModule = typeof import('@/services/artwork-store');
let store: ArtworkStoreModule;

function makeArtwork(overrides: Partial<Artwork> = {}): Artwork {
  return {
    tmdbId: 603,
    mediaType: 'movie',
    title: 'The Matrix',
    year: 1999,
    posterPath: '/poster.jpg',
    backdropPath: '/backdrop.jpg',
    popularity: 42,
    ...overrides,
  };
}

async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  jest.useRealTimers();
  jest.resetModules();
  Object.keys(mockAsyncStorageBacking).forEach((k) => delete mockAsyncStorageBacking[k]);
  mockGetItem.mockClear();
  mockSetItem.mockClear();
  mockRemoveItem.mockClear();
  mockSearchArtwork.mockReset();
  mockParseReleaseName.mockReset();
  mockParseReleaseName.mockImplementation((name: string) => ({
    title: name,
    looksLikeTV: false,
    languages: [] as string[],
  }));
  store = require('@/services/artwork-store');
});

describe('artwork-store', () => {
  describe('lookupArtwork', () => {
    it('skips the lookup and returns null when the parsed title is empty', async () => {
      mockParseReleaseName.mockReturnValueOnce({ title: '', looksLikeTV: false, languages: [] });

      const result = await store.lookupArtwork('####.mkv');

      expect(result).toBeNull();
      expect(mockSearchArtwork).not.toHaveBeenCalled();
      expect(store.peekArtwork('####.mkv')).toBeUndefined();
    });

    it('caches a hit in memory and skips a second search', async () => {
      const artwork = makeArtwork();
      mockSearchArtwork.mockResolvedValueOnce(artwork);

      const first = await store.lookupArtwork('The.Matrix.1999.mkv');
      expect(first).toEqual(artwork);
      expect(mockSearchArtwork).toHaveBeenCalledTimes(1);

      mockSearchArtwork.mockClear();
      const second = await store.lookupArtwork('The.Matrix.1999.mkv');
      expect(second).toEqual(artwork);
      expect(mockSearchArtwork).not.toHaveBeenCalled();
      expect(store.peekArtwork('The.Matrix.1999.mkv')).toEqual(artwork);
    });

    it('sends TMDB only the parsed title/year, never the raw release name (privacy invariant)', async () => {
      jest.useFakeTimers();
      const rawName = 'The.Matrix.1999.1080p.BluRay.x264-GRP';
      mockParseReleaseName.mockReturnValueOnce({
        title: 'The Matrix',
        year: 1999,
        looksLikeTV: false,
        languages: [],
      });
      const artwork = makeArtwork();
      mockSearchArtwork.mockResolvedValueOnce(artwork);

      await store.lookupArtwork(rawName);

      expect(mockSearchArtwork).toHaveBeenCalledWith('The Matrix', 1999);
      expect(mockSearchArtwork.mock.calls[0][0]).not.toBe(rawName);

      // Cache-by-raw is the contract: the raw name is only ever used as the
      // lookup/cache key, both in memory and in the persisted snapshot.
      expect(store.peekArtwork(rawName)).toEqual(artwork);
      await jest.advanceTimersByTimeAsync(500);
      expect(mockSetItem).toHaveBeenCalledWith(
        'artwork_cache_v1',
        JSON.stringify({ [rawName]: artwork }),
      );
      jest.useRealTimers();
    });

    it('caches a negative result (no match) and skips a second search', async () => {
      mockSearchArtwork.mockResolvedValueOnce(null);

      const first = await store.lookupArtwork('Some.Obscure.Release.mkv');
      expect(first).toBeNull();
      expect(mockSearchArtwork).toHaveBeenCalledTimes(1);

      mockSearchArtwork.mockClear();
      const second = await store.lookupArtwork('Some.Obscure.Release.mkv');
      expect(second).toBeNull();
      expect(mockSearchArtwork).not.toHaveBeenCalled();
      expect(store.peekArtwork('Some.Obscure.Release.mkv')).toBeNull();
    });

    it('does not persist a negative cache entry when the lookup itself fails (network error, bad key, 5xx)', async () => {
      mockSearchArtwork.mockRejectedValueOnce(new Error('Network Error'));

      const result = await store.lookupArtwork('Transient.Failure.mkv');

      expect(result).toBeNull();
      expect(store.peekArtwork('Transient.Failure.mkv')).toBeUndefined();
      expect(mockSetItem).not.toHaveBeenCalled();

      // Regaining connectivity (or fixing the key) must look it up again,
      // not serve a stale negative verdict.
      const artwork = makeArtwork({ title: 'Transient Failure' });
      mockSearchArtwork.mockResolvedValueOnce(artwork);
      const retryResult = await store.lookupArtwork('Transient.Failure.mkv');
      expect(retryResult).toEqual(artwork);
    });

    it('dedupes two concurrent lookups of the same raw name into one search', async () => {
      let resolveSearch: (v: Artwork | null) => void = () => {};
      const pending = new Promise<Artwork | null>((resolve) => {
        resolveSearch = resolve;
      });
      mockSearchArtwork.mockReturnValueOnce(pending);

      const p1 = store.lookupArtwork('Duplicate.Name.mkv');
      const p2 = store.lookupArtwork('Duplicate.Name.mkv');

      await flush();
      expect(mockSearchArtwork).toHaveBeenCalledTimes(1);

      const artwork = makeArtwork({ title: 'Duplicate Name' });
      resolveSearch(artwork);

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toEqual(artwork);
      expect(r2).toEqual(artwork);
      expect(mockSearchArtwork).toHaveBeenCalledTimes(1);
    });

    it('caps concurrent searchArtwork calls at 4 and releases a slot on completion', async () => {
      const deferreds: Array<{ resolve: (v: Artwork | null) => void }> = [];
      mockSearchArtwork.mockImplementation(
        () =>
          new Promise<Artwork | null>((resolve) => {
            deferreds.push({ resolve });
          }),
      );

      const names = ['Show.A.mkv', 'Show.B.mkv', 'Show.C.mkv', 'Show.D.mkv', 'Show.E.mkv'];
      const promises = names.map((n) => store.lookupArtwork(n));

      await flush();
      expect(mockSearchArtwork).toHaveBeenCalledTimes(4);
      expect(deferreds).toHaveLength(4);

      // Freeing one slot lets the 5th queued lookup start its search.
      deferreds[0].resolve(makeArtwork({ title: names[0] }));
      await flush();
      expect(mockSearchArtwork).toHaveBeenCalledTimes(5);
      expect(deferreds).toHaveLength(5);

      deferreds.slice(1).forEach((d, i) => d.resolve(makeArtwork({ title: names[i + 1] })));
      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
    });

    it('retries once after a 429, then succeeds and caches the result', async () => {
      jest.useFakeTimers();
      const artwork = makeArtwork();
      mockSearchArtwork
        .mockRejectedValueOnce(new MockTmdbRateLimitError('rate limited', 1200))
        .mockResolvedValueOnce(artwork);

      const promise = store.lookupArtwork('Rate.Limited.Once.mkv');
      await jest.advanceTimersByTimeAsync(1200);
      const result = await promise;

      expect(result).toEqual(artwork);
      expect(mockSearchArtwork).toHaveBeenCalledTimes(2);
      expect(store.peekArtwork('Rate.Limited.Once.mkv')).toEqual(artwork);
      jest.useRealTimers();
    });

    it('caps the retry wait at 10s even when retryAfterMs is larger', async () => {
      jest.useFakeTimers();
      const artwork = makeArtwork();
      mockSearchArtwork
        .mockRejectedValueOnce(new MockTmdbRateLimitError('rate limited', 60000))
        .mockResolvedValueOnce(artwork);

      const promise = store.lookupArtwork('Rate.Limited.Long.mkv');
      await jest.advanceTimersByTimeAsync(10000);
      const result = await promise;

      expect(result).toEqual(artwork);
      expect(mockSearchArtwork).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });

    it('resolves null without persisting after a second 429', async () => {
      jest.useFakeTimers();
      mockSearchArtwork
        .mockRejectedValueOnce(new MockTmdbRateLimitError('rate limited', 500))
        .mockRejectedValueOnce(new MockTmdbRateLimitError('rate limited again', 500));

      const promise = store.lookupArtwork('Always.Limited.mkv');
      await jest.advanceTimersByTimeAsync(500);
      const result = await promise;

      expect(result).toBeNull();
      expect(mockSearchArtwork).toHaveBeenCalledTimes(2);
      expect(store.peekArtwork('Always.Limited.mkv')).toBeUndefined();
      expect(mockSetItem).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('persistence', () => {
    it('write-behind persists lookups (debounced) and a fresh store instance loads them back', async () => {
      jest.useFakeTimers();
      const artwork = makeArtwork();
      mockSearchArtwork.mockResolvedValueOnce(artwork);

      await store.lookupArtwork('Persisted.Movie.2021.mkv');
      expect(mockSetItem).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(500);
      expect(mockSetItem).toHaveBeenCalledWith(
        'artwork_cache_v1',
        JSON.stringify({ 'Persisted.Movie.2021.mkv': artwork }),
      );
      jest.useRealTimers();

      // Simulate a fresh app start: new module instance, same backing
      // AsyncStorage data (mockAsyncStorageBacking is not reset here).
      jest.resetModules();
      mockSearchArtwork.mockClear();
      const freshStore: ArtworkStoreModule = require('@/services/artwork-store');

      const result = await freshStore.lookupArtwork('Persisted.Movie.2021.mkv');
      expect(result).toEqual(artwork);
      expect(mockSearchArtwork).not.toHaveBeenCalled();
    });

    it('debounces multiple rapid writes into a single persisted snapshot', async () => {
      jest.useFakeTimers();
      mockSearchArtwork
        .mockResolvedValueOnce(makeArtwork({ tmdbId: 1, title: 'One' }))
        .mockResolvedValueOnce(makeArtwork({ tmdbId: 2, title: 'Two' }));

      await store.lookupArtwork('One.mkv');
      await jest.advanceTimersByTimeAsync(200);
      await store.lookupArtwork('Two.mkv');
      expect(mockSetItem).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(500);
      expect(mockSetItem).toHaveBeenCalledTimes(1);
      const persisted = JSON.parse(mockSetItem.mock.calls[0][1] as string);
      expect(Object.keys(persisted)).toEqual(['One.mkv', 'Two.mkv']);
      jest.useRealTimers();
    });
  });

  describe('clearArtworkCache', () => {
    it('wipes the in-memory cache and removes the persisted entry', async () => {
      const artwork = makeArtwork();
      mockSearchArtwork.mockResolvedValueOnce(artwork);
      await store.lookupArtwork('To.Clear.mkv');
      expect(store.peekArtwork('To.Clear.mkv')).toEqual(artwork);

      await store.clearArtworkCache();

      expect(store.peekArtwork('To.Clear.mkv')).toBeUndefined();
      expect(mockRemoveItem).toHaveBeenCalledWith('artwork_cache_v1');

      mockSearchArtwork.mockClear();
      mockSearchArtwork.mockResolvedValueOnce(artwork);
      const result = await store.lookupArtwork('To.Clear.mkv');
      expect(result).toEqual(artwork);
      expect(mockSearchArtwork).toHaveBeenCalledTimes(1);
    });
  });
});

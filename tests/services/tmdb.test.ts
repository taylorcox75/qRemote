const mockGet = jest.fn();

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({ get: mockGet })),
  },
}));

const mockSecureStore: Record<string, string> = {};

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStore[key] = value;
    return Promise.resolve();
  }),
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockSecureStore[key] ?? null)),
  deleteItemAsync: jest.fn((key: string) => {
    delete mockSecureStore[key];
    return Promise.resolve();
  }),
}));

import * as SecureStore from 'expo-secure-store';
import {
  searchArtwork,
  pickBest,
  posterUrl,
  backdropUrl,
  getTmdbApiKey,
  setTmdbApiKey,
  hasTmdbApiKey,
  TMDB_KEY_STORAGE,
  TmdbRateLimitError,
  TmdbLookupError,
} from '@/services/tmdb';

function axiosError(status: number, headers?: Record<string, string>) {
  const err = new Error(`Request failed with status code ${status}`) as Error & {
    response: { status: number; headers?: Record<string, string> };
  };
  err.response = { status, headers };
  return err;
}

describe('tmdb service', () => {
  beforeEach(() => {
    Object.keys(mockSecureStore).forEach((k) => delete mockSecureStore[k]);
    jest.clearAllMocks();
  });

  describe('pickBest', () => {
    const results = [
      {
        id: 1,
        media_type: 'person',
        title: 'Someone Famous',
        poster_path: '/person.jpg',
        popularity: 999,
      },
      {
        id: 2,
        media_type: 'movie',
        title: 'No Poster Movie',
        poster_path: null,
        popularity: 500,
        release_date: '2020-01-01',
      },
      {
        id: 3,
        media_type: 'movie',
        title: 'Old Match',
        poster_path: '/old.jpg',
        popularity: 10,
        release_date: '2015-05-01',
      },
      {
        id: 4,
        media_type: 'tv',
        name: 'Year Match Show',
        poster_path: '/tv.jpg',
        popularity: 20,
        first_air_date: '2020-03-01',
      },
      {
        id: 5,
        media_type: 'movie',
        title: 'Most Popular',
        poster_path: '/popular.jpg',
        popularity: 80,
        release_date: '2018-01-01',
      },
    ];

    it('drops person results and results without a poster', () => {
      const chosen = pickBest(results, 2020);
      expect(chosen?.tmdbId).not.toBe(1);
      expect(chosen?.tmdbId).not.toBe(2);
    });

    it('prefers an exact year match over popularity', () => {
      const chosen = pickBest(results, 2020);
      expect(chosen?.tmdbId).toBe(4);
      expect(chosen?.title).toBe('Year Match Show');
      expect(chosen?.mediaType).toBe('tv');
      expect(chosen?.year).toBe(2020);
    });

    it('falls back to highest popularity when no year match', () => {
      const chosen = pickBest(results, 1999);
      expect(chosen?.tmdbId).toBe(5);
      expect(chosen?.title).toBe('Most Popular');
    });

    it('falls back to highest popularity when no preferred year given', () => {
      const chosen = pickBest(results);
      expect(chosen?.tmdbId).toBe(5);
    });

    it('returns null when nothing qualifies', () => {
      expect(pickBest([{ media_type: 'person', poster_path: '/x.jpg' }])).toBeNull();
      expect(pickBest([])).toBeNull();
    });

    it('returns null for non-array input', () => {
      expect(pickBest(null as unknown as unknown[])).toBeNull();
    });
  });

  describe('searchArtwork', () => {
    it('returns null without making a request when no key is available', async () => {
      const result = await searchArtwork('Nashville', 2012);
      expect(result).toBeNull();
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('fetches results and returns the best match using the passed-in key', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          results: [
            {
              id: 42,
              media_type: 'tv',
              name: 'Nashville',
              poster_path: '/nash.jpg',
              backdrop_path: '/nash-bg.jpg',
              popularity: 55,
              first_air_date: '2012-10-16',
            },
          ],
        },
      });

      const result = await searchArtwork('Nashville', 2012, 'my-key');

      expect(mockGet).toHaveBeenCalledWith('/search/multi', {
        params: { api_key: 'my-key', query: 'Nashville', include_adult: false },
      });
      expect(result).toEqual({
        tmdbId: 42,
        mediaType: 'tv',
        title: 'Nashville',
        year: 2012,
        posterPath: '/nash.jpg',
        backdropPath: '/nash-bg.jpg',
        popularity: 55,
      });
    });

    it('falls back to the stored key when no key argument is given', async () => {
      await setTmdbApiKey('stored-key');
      mockGet.mockResolvedValueOnce({ data: { results: [] } });

      await searchArtwork('Some Movie');

      expect(mockGet).toHaveBeenCalledWith('/search/multi', {
        params: { api_key: 'stored-key', query: 'Some Movie', include_adult: false },
      });
    });

    it('throws TmdbLookupError on a 401 response (a lookup failure, not a no-match)', async () => {
      mockGet.mockRejectedValueOnce(axiosError(401));
      await expect(searchArtwork('Nashville', undefined, 'my-key')).rejects.toThrow(
        TmdbLookupError,
      );
    });

    it('throws TmdbRateLimitError on a 429 with a parsed Retry-After header', async () => {
      mockGet.mockRejectedValueOnce(axiosError(429, { 'retry-after': '5' }));

      await expect(searchArtwork('Nashville', undefined, 'my-key')).rejects.toThrow(
        TmdbRateLimitError,
      );

      mockGet.mockRejectedValueOnce(axiosError(429, { 'retry-after': '5' }));
      try {
        await searchArtwork('Nashville', undefined, 'my-key');
        fail('expected TmdbRateLimitError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TmdbRateLimitError);
        expect((error as TmdbRateLimitError).retryAfterMs).toBe(5000);
      }
    });

    it('defaults retryAfterMs to 2000 when the 429 has no Retry-After header', async () => {
      mockGet.mockRejectedValueOnce(axiosError(429));
      try {
        await searchArtwork('Nashville', undefined, 'my-key');
        fail('expected TmdbRateLimitError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TmdbRateLimitError);
        expect((error as TmdbRateLimitError).retryAfterMs).toBe(2000);
      }
    });

    it('throws TmdbLookupError on malformed / undecodable response data', async () => {
      mockGet.mockRejectedValueOnce(new SyntaxError('Unexpected token in JSON'));
      await expect(searchArtwork('Nashville', undefined, 'my-key')).rejects.toThrow(
        TmdbLookupError,
      );
    });

    it('throws TmdbLookupError on a network error', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network Error'));
      await expect(searchArtwork('Nashville', undefined, 'my-key')).rejects.toThrow(
        TmdbLookupError,
      );
    });

    it('returns null for a blank title without making a request', async () => {
      const result = await searchArtwork('   ', undefined, 'my-key');
      expect(result).toBeNull();
      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  describe('posterUrl / backdropUrl', () => {
    it('builds a poster URL for a given size', () => {
      expect(posterUrl('/abc.jpg', 'w342')).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
    });

    it('returns null passthrough for a null poster path', () => {
      expect(posterUrl(null, 'w154')).toBeNull();
    });

    it('builds a backdrop URL at w780', () => {
      expect(backdropUrl('/bg.jpg')).toBe('https://image.tmdb.org/t/p/w780/bg.jpg');
    });

    it('returns null passthrough for a null backdrop path', () => {
      expect(backdropUrl(null)).toBeNull();
    });
  });

  describe('key storage', () => {
    it('getTmdbApiKey returns null when nothing is stored', async () => {
      expect(await getTmdbApiKey()).toBeNull();
    });

    it('setTmdbApiKey stores a trimmed key, then getTmdbApiKey reads it back', async () => {
      await setTmdbApiKey('  abc123  ');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(TMDB_KEY_STORAGE, 'abc123');
      expect(await getTmdbApiKey()).toBe('abc123');
    });

    it('hasTmdbApiKey reflects whether a key is stored', async () => {
      expect(await hasTmdbApiKey()).toBe(false);
      await setTmdbApiKey('a-key');
      expect(await hasTmdbApiKey()).toBe(true);
    });

    it('setTmdbApiKey with an empty string deletes the stored key', async () => {
      await setTmdbApiKey('a-key');
      expect(await hasTmdbApiKey()).toBe(true);

      await setTmdbApiKey('');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(TMDB_KEY_STORAGE);
      expect(await getTmdbApiKey()).toBeNull();
    });

    it('setTmdbApiKey with only whitespace deletes the stored key', async () => {
      await setTmdbApiKey('a-key');
      await setTmdbApiKey('   ');
      expect(await getTmdbApiKey()).toBeNull();
    });
  });
});

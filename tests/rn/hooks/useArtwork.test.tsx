import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useArtwork } from '@/hooks/useArtwork';
import { useArtworkSettings } from '@/context/ArtworkContext';
import { lookupArtwork, peekArtwork } from '@/services/artwork-store';
import type { Artwork } from '@/services/tmdb';

jest.mock('@/context/ArtworkContext', () => ({ useArtworkSettings: jest.fn() }));
jest.mock('@/services/artwork-store', () => ({
  lookupArtwork: jest.fn(),
  peekArtwork: jest.fn(),
}));

const mockUseArtworkSettings = useArtworkSettings as jest.Mock;
const mockLookupArtwork = lookupArtwork as jest.Mock;
const mockPeekArtwork = peekArtwork as jest.Mock;

const sampleArtwork: Artwork = {
  tmdbId: 1,
  mediaType: 'tv',
  title: 'Nashville',
  year: 2012,
  posterPath: '/abc.jpg',
  backdropPath: null,
  popularity: 10,
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useArtwork', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: a resolved null means the store persisted a genuine
    // negative-cache entry (peekArtwork now knows this rawName). Individual
    // tests override this to simulate an unpersisted, transient failure.
    mockPeekArtwork.mockReturnValue(null);
  });

  it('returns undefined artwork and never calls lookupArtwork when the feature is inactive', async () => {
    mockUseArtworkSettings.mockReturnValue({ active: false });

    const { result } = await renderHook(() => useArtwork('Nashville.S01E15.1080p'), {
      wrapper: makeWrapper(),
    });

    expect(result.current.artwork).toBeUndefined();
    expect(result.current.loading).toBe(false);
    expect(mockLookupArtwork).not.toHaveBeenCalled();
  });

  it('returns undefined artwork and skips the lookup when rawName is undefined', async () => {
    mockUseArtworkSettings.mockReturnValue({ active: true });

    const { result } = await renderHook(() => useArtwork(undefined), {
      wrapper: makeWrapper(),
    });

    expect(result.current.artwork).toBeUndefined();
    expect(mockLookupArtwork).not.toHaveBeenCalled();
  });

  it('resolves matched artwork via lookupArtwork when active with a rawName', async () => {
    mockUseArtworkSettings.mockReturnValue({ active: true });
    mockLookupArtwork.mockResolvedValue(sampleArtwork);

    const { result } = await renderHook(() => useArtwork('Nashville.S01E15.1080p'), {
      wrapper: makeWrapper(),
    });

    expect(result.current.loading).toBe(true);
    expect(mockLookupArtwork).toHaveBeenCalledWith('Nashville.S01E15.1080p');

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.artwork).toEqual(sampleArtwork);
  });

  it('resolves a negative cache entry (null) as a non-loading, non-undefined result', async () => {
    mockUseArtworkSettings.mockReturnValue({ active: true });
    mockLookupArtwork.mockResolvedValue(null);

    const { result } = await renderHook(() => useArtwork('Some.Unmatched.Release'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.artwork).toBeNull();
  });

  it('surfaces a transient lookup failure (unpersisted null) as undefined instead of a cached no-match', async () => {
    mockUseArtworkSettings.mockReturnValue({ active: true });
    // The store resolves null without persisting on a transient failure
    // (network error, bad key, second 429) - peekArtwork still doesn't know
    // this rawName right after lookupArtwork resolves.
    mockLookupArtwork.mockResolvedValue(null);
    mockPeekArtwork.mockReturnValue(undefined);

    const { result } = await renderHook(() => useArtwork('Transient.Failure.Release'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    // Not null: a transient failure must never read the same as a genuine
    // no-match, or it would sit as a placeholder for the rest of the session
    // (staleTime: Infinity) instead of retrying on the next mount/focus.
    expect(result.current.artwork).toBeUndefined();
  });

  it('does not re-fetch on remount with the same rawName within one QueryClient (staleTime: Infinity)', async () => {
    mockUseArtworkSettings.mockReturnValue({ active: true });
    mockLookupArtwork.mockResolvedValue(sampleArtwork);
    const wrapper = makeWrapper();

    const first = await renderHook(() => useArtwork('Nashville.S01E15.1080p'), { wrapper });
    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
    });
    expect(mockLookupArtwork).toHaveBeenCalledTimes(1);

    const second = await renderHook(() => useArtwork('Nashville.S01E15.1080p'), { wrapper });
    expect(second.result.current.artwork).toEqual(sampleArtwork);
    expect(second.result.current.loading).toBe(false);
    expect(mockLookupArtwork).toHaveBeenCalledTimes(1);
  });

  it('keys the query by rawName, issuing a separate lookup for a different name', async () => {
    mockUseArtworkSettings.mockReturnValue({ active: true });
    mockLookupArtwork.mockResolvedValue(sampleArtwork);
    const wrapper = makeWrapper();

    const first = await renderHook(() => useArtwork('Name.One'), { wrapper });
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    const second = await renderHook(() => useArtwork('Name.Two'), { wrapper });
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(mockLookupArtwork).toHaveBeenCalledTimes(2);
    expect(mockLookupArtwork).toHaveBeenNthCalledWith(1, 'Name.One');
    expect(mockLookupArtwork).toHaveBeenNthCalledWith(2, 'Name.Two');
  });

  it('becomes inactive (undefined artwork) after a rerender flips active to false', async () => {
    mockUseArtworkSettings.mockReturnValue({ active: true });
    mockLookupArtwork.mockResolvedValue(sampleArtwork);

    const { result, rerender } = await renderHook(() => useArtwork('Nashville.S01E15.1080p'), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.artwork).toEqual(sampleArtwork);

    mockUseArtworkSettings.mockReturnValue({ active: false });
    await rerender({});

    expect(result.current.artwork).toBeUndefined();
    expect(result.current.loading).toBe(false);
  });
});

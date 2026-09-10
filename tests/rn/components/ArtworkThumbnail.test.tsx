import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { ArtworkThumbnail } from '@/components/ArtworkThumbnail';
import { useArtworkSettings } from '@/context/ArtworkContext';
import { useArtwork } from '@/hooks/useArtwork';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors }),
}));
jest.mock('@/context/ArtworkContext', () => ({ useArtworkSettings: jest.fn() }));
jest.mock('@/hooks/useArtwork', () => ({ useArtwork: jest.fn() }));
// posterUrl is pure - stub it directly rather than pulling in the real
// services/tmdb.ts (axios/expo-secure-store) for a component-level test.
jest.mock('@/services/tmdb', () => ({
  posterUrl: jest.fn((path: string | null, size: string) =>
    path ? `https://image.tmdb.org/t/p/${size}${path}` : null,
  ),
}));

const mockUseArtworkSettings = useArtworkSettings as jest.Mock;
const mockUseArtwork = useArtwork as jest.Mock;

describe('ArtworkThumbnail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders null when the feature is inactive', async () => {
    mockUseArtworkSettings.mockReturnValue({ active: false });
    mockUseArtwork.mockReturnValue({ artwork: undefined, loading: false });

    const { toJSON } = await render(<ArtworkThumbnail name="Nashville S01E15" width={44} />);

    expect(toJSON()).toBeNull();
  });

  it('renders the placeholder when inactive and showPlaceholderWhenInactive is set', async () => {
    mockUseArtworkSettings.mockReturnValue({ active: false });
    mockUseArtwork.mockReturnValue({ artwork: undefined, loading: false });

    await render(
      <ArtworkThumbnail name="Nashville S01E15" width={44} showPlaceholderWhenInactive />,
    );

    expect(screen.getByTestId('artwork-thumbnail-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('artwork-thumbnail-image')).toBeNull();
  });

  it('renders the placeholder when active with no artwork match', async () => {
    mockUseArtworkSettings.mockReturnValue({ active: true });
    mockUseArtwork.mockReturnValue({ artwork: null, loading: false });

    await render(<ArtworkThumbnail name="Nashville S01E15" width={44} />);

    expect(screen.getByTestId('artwork-thumbnail-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('artwork-thumbnail-image')).toBeNull();
  });

  it('renders the placeholder (no spinner) while loading', async () => {
    mockUseArtworkSettings.mockReturnValue({ active: true });
    mockUseArtwork.mockReturnValue({ artwork: undefined, loading: true });

    await render(<ArtworkThumbnail name="Nashville S01E15" width={44} />);

    expect(screen.getByTestId('artwork-thumbnail-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('artwork-thumbnail-image')).toBeNull();
  });

  it('renders an Image at the w154 size for a width below 100', async () => {
    mockUseArtworkSettings.mockReturnValue({ active: true });
    mockUseArtwork.mockReturnValue({
      artwork: { posterPath: '/abc.jpg' },
      loading: false,
    });

    await render(<ArtworkThumbnail name="Nashville S01E15" width={44} />);

    const image = screen.getByTestId('artwork-thumbnail-image');
    expect(image.props.source.uri).toBe('https://image.tmdb.org/t/p/w154/abc.jpg');
  });

  it('renders an Image at the w342 size for a width of 100 or more', async () => {
    mockUseArtworkSettings.mockReturnValue({ active: true });
    mockUseArtwork.mockReturnValue({
      artwork: { posterPath: '/abc.jpg' },
      loading: false,
    });

    await render(<ArtworkThumbnail name="Nashville S01E15" width={148} />);

    const image = screen.getByTestId('artwork-thumbnail-image');
    expect(image.props.source.uri).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
  });

  it('falls back to the placeholder when the artwork has no poster path', async () => {
    mockUseArtworkSettings.mockReturnValue({ active: true });
    mockUseArtwork.mockReturnValue({
      artwork: { posterPath: null },
      loading: false,
    });

    await render(<ArtworkThumbnail name="Nashville S01E15" width={44} />);

    expect(screen.getByTestId('artwork-thumbnail-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('artwork-thumbnail-image')).toBeNull();
  });

  it('uses a square crop (height === width) when square is set', async () => {
    mockUseArtworkSettings.mockReturnValue({ active: true });
    mockUseArtwork.mockReturnValue({ artwork: null, loading: false });

    await render(<ArtworkThumbnail name="Nashville S01E15" width={60} square />);

    const plate = screen.getByTestId('artwork-thumbnail-plate');
    expect(StyleSheet.flatten(plate.props.style)).toMatchObject({ width: 60, height: 60 });
  });

  it('uses a 2:3 poster crop (height = width * 1.5) by default', async () => {
    mockUseArtworkSettings.mockReturnValue({ active: true });
    mockUseArtwork.mockReturnValue({ artwork: null, loading: false });

    await render(<ArtworkThumbnail name="Nashville S01E15" width={60} />);

    const plate = screen.getByTestId('artwork-thumbnail-plate');
    expect(StyleSheet.flatten(plate.props.style)).toMatchObject({ width: 60, height: 90 });
  });
});

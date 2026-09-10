import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { TorrentRow } from '@/components/TorrentRow';
import { TorrentInfo } from '@/types/api';
import { formatProgress, formatTime } from '@/utils/format';
import { mockColors } from './theme-mock';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// Same rationale as TorrentCard.test.tsx: ArtworkThumbnail reads the
// artwork feature flag directly, not via props. Default to inactive so it
// renders null and every assertion below stays unaffected by artwork.
jest.mock('@/context/ArtworkContext', () => ({
  useArtworkSettings: jest.fn(() => ({
    enabled: false,
    hasKey: false,
    active: false,
    refresh: jest.fn(),
  })),
}));
jest.mock('@/hooks/useArtwork', () => ({
  useArtwork: jest.fn(() => ({ artwork: undefined, loading: false })),
}));
jest.mock('@/services/tmdb', () => ({
  posterUrl: jest.fn((path: string | null, size: string) =>
    path ? `https://image.tmdb.org/t/p/${size}${path}` : null,
  ),
}));

const baseTorrent: TorrentInfo = {
  hash: 'abc123',
  name: 'Sample Torrent',
  state: 'downloading',
  progress: 0.5,
  dlspeed: 1000,
  upspeed: 0,
  eta: 100,
  num_seeds: 1,
  num_complete: 2,
  num_leechs: 1,
  num_incomplete: 2,
  ratio: 0.1,
  size: 1000,
  total_size: 1000,
  completed: 500,
  uploaded: 100,
  added_on: 1700000000,
  save_path: '',
  category: '',
  tags: '',
  tracker: '',
  availability: -1,
  popularity: 0,
  seeding_time: 0,
} as unknown as TorrentInfo;

describe('TorrentRow', () => {
  it('renders the torrent name', async () => {
    await render(<TorrentRow torrent={baseTorrent} selected={false} onPress={jest.fn()} />);
    expect(screen.getByText('Sample Torrent')).toBeTruthy();
  });

  it('renders the right-aligned percent with tabular nums', async () => {
    await render(<TorrentRow torrent={baseTorrent} selected={false} onPress={jest.fn()} />);
    const percent = screen.getByText(formatProgress(baseTorrent.progress, 0));
    expect(percent).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    await render(<TorrentRow torrent={baseTorrent} selected={false} onPress={onPress} />);
    fireEvent.press(screen.getByText('Sample Torrent'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls onLongPress when long-pressed', async () => {
    const onLongPress = jest.fn();
    await render(
      <TorrentRow
        torrent={baseTorrent}
        selected={false}
        onPress={jest.fn()}
        onLongPress={onLongPress}
      />,
    );
    fireEvent(screen.getByText('Sample Torrent'), 'longPress');
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('shows the ETA when hasEta is true', async () => {
    await render(<TorrentRow torrent={baseTorrent} selected={false} onPress={jest.fn()} />);
    expect(screen.getByText(formatTime(baseTorrent.eta))).toBeTruthy();
  });

  it('hides the ETA when the torrent is complete (hasEta false)', async () => {
    const completed = { ...baseTorrent, progress: 1, eta: 8640000 } as TorrentInfo;
    await render(<TorrentRow torrent={completed} selected={false} onPress={jest.fn()} />);
    expect(screen.queryByText(formatTime(baseTorrent.eta))).toBeNull();
  });

  it('renders the state label via StatusBadge', async () => {
    await render(<TorrentRow torrent={baseTorrent} selected={false} onPress={jest.fn()} />);
    expect(screen.getByText('states.downloading')).toBeTruthy();
  });

  it('uses the theme primaryOpac background when selected', async () => {
    await render(<TorrentRow torrent={baseTorrent} selected onPress={jest.fn()} />);
    const row = screen.getByText('Sample Torrent').parent?.parent?.parent;
    expect(StyleSheet.flatten(row?.props.style)).toMatchObject({
      backgroundColor: mockColors.primaryOpac,
    });
  });
});

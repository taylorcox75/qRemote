import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { TorrentCard } from '@/components/TorrentCard';
import { TorrentInfo } from '@/types/api';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
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

describe('TorrentCard expanded detail grid — addedOn pairing', () => {
  it('keeps date and time together when only status (an odd single short field) precedes it', async () => {
    await render(
      <TorrentCard
        torrent={baseTorrent}
        onPress={jest.fn()}
        compact={false}
        expandedCardFields={{
          status: true,
          progress: false,
          dlSpeed: false,
          ulSpeed: false,
          eta: false,
          seeds: false,
          peers: false,
          ratio: false,
          ratioLimit: false,
          maxRatio: false,
          uploaded: false,
          availability: false,
          popularity: false,
          seedingTime: false,
          addedOn: true,
          tags: false,
          category: false,
          tracker: false,
          savePath: false,
        }}
      />,
    );

    expect(screen.getByText('screens.settings.expandedCardFieldsList.addedOn')).toBeTruthy();
    expect(screen.getByText('screens.settings.expandedCardFieldsList.addedTime')).toBeTruthy();

    const dateNode = screen.getByText('screens.settings.expandedCardFieldsList.addedOn');
    const timeNode = screen.getByText('screens.settings.expandedCardFieldsList.addedTime');

    // Date and time each live in a 50%-width cell; those cells must share one
    // dedicated wrapping row (the PairRow), not just the outer detail grid —
    // otherwise (the original bug) they're independent siblings in the grid
    // and flex-wrap can place them on different visual rows.
    const dateRow = dateNode.parent?.parent;
    const timeRow = timeNode.parent?.parent;
    expect(dateRow).toBe(timeRow);

    const rowStyle = dateRow?.props.style;
    expect(rowStyle).toMatchObject({ flexDirection: 'row', width: '100%' });
    // The outer detail grid additionally wraps and has margin/padding — the
    // pair's wrapper must be a distinct, narrower row, not the grid itself.
    expect(rowStyle).not.toHaveProperty('flexWrap');
  });

  it('renders nothing extra when addedOn is disabled', async () => {
    await render(
      <TorrentCard
        torrent={baseTorrent}
        onPress={jest.fn()}
        compact={false}
        expandedCardFields={{
          status: false,
          progress: false,
          dlSpeed: false,
          ulSpeed: false,
          eta: false,
          seeds: false,
          peers: false,
          ratio: false,
          ratioLimit: false,
          maxRatio: false,
          uploaded: false,
          availability: false,
          popularity: false,
          seedingTime: false,
          addedOn: false,
          tags: false,
          category: false,
          tracker: false,
          savePath: false,
        }}
      />,
    );

    expect(screen.queryByText('screens.settings.expandedCardFieldsList.addedOn')).toBeNull();
  });
});

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { TorrentTable } from '@/components/TorrentTable';
import { TorrentInfo } from '@/types/api';
import { formatSize, formatRatio } from '@/utils/format';
import { mockColors } from './theme-mock';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// Same rationale as TorrentRow.test.tsx: ArtworkThumbnail reads the artwork
// feature flag directly, not via props. Default to inactive; the name cell
// still renders its 28pt placeholder plate via showPlaceholderWhenInactive.
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

function torrent(overrides: Partial<TorrentInfo>): TorrentInfo {
  return {
    hash: 'h',
    name: 'Torrent',
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
    ...overrides,
  } as unknown as TorrentInfo;
}

const TORRENTS: TorrentInfo[] = [
  torrent({ hash: 'h1', name: 'Alpha Torrent' }),
  torrent({ hash: 'h2', name: 'Beta Torrent' }),
];

function baseProps() {
  return {
    torrents: TORRENTS,
    selectedHash: null,
    onSelect: jest.fn(),
    onContextMenu: jest.fn(),
    sortBy: 'name' as const,
    sortDirection: 'asc' as const,
    onSortChange: jest.fn(),
    alternatingRows: true,
  };
}

describe('TorrentTable', () => {
  it('renders every column header', async () => {
    await render(<TorrentTable {...baseProps()} />);
    for (const key of [
      'name',
      'size',
      'progress',
      'status',
      'down',
      'up',
      'seeds',
      'peers',
      'eta',
      'ratio',
      'added',
    ]) {
      expect(screen.getByText(`table.columns.${key}`)).toBeTruthy();
    }
  });

  it('renders a row per torrent', async () => {
    await render(<TorrentTable {...baseProps()} />);
    expect(screen.getByText('Alpha Torrent')).toBeTruthy();
    expect(screen.getByText('Beta Torrent')).toBeTruthy();
  });

  it('renders size and ratio for a row', async () => {
    await render(<TorrentTable {...baseProps()} />);
    expect(screen.getAllByText(formatSize(1000)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(formatRatio(0.1)).length).toBeGreaterThan(0);
  });

  it('calls onSelect with the hash when a row is pressed', async () => {
    const onSelect = jest.fn();
    await render(<TorrentTable {...baseProps()} onSelect={onSelect} />);
    fireEvent.press(screen.getByText('Alpha Torrent'));
    expect(onSelect).toHaveBeenCalledWith('h1');
  });

  it('toggles sort direction when pressing the already-active sort column', async () => {
    const onSortChange = jest.fn();
    await render(
      <TorrentTable
        {...baseProps()}
        sortBy="name"
        sortDirection="asc"
        onSortChange={onSortChange}
      />,
    );
    fireEvent.press(screen.getByText('table.columns.name'));
    expect(onSortChange).toHaveBeenCalledWith('name', 'desc');
  });

  it('sorts ascending by default when pressing a different column header', async () => {
    const onSortChange = jest.fn();
    await render(
      <TorrentTable
        {...baseProps()}
        sortBy="name"
        sortDirection="asc"
        onSortChange={onSortChange}
      />,
    );
    fireEvent.press(screen.getByText('table.columns.size'));
    expect(onSortChange).toHaveBeenCalledWith('size', 'asc');
  });

  it('does not call onSortChange for a column with no SortField (status)', async () => {
    const onSortChange = jest.fn();
    await render(<TorrentTable {...baseProps()} onSortChange={onSortChange} />);
    fireEvent.press(screen.getByText('table.columns.status'));
    expect(onSortChange).not.toHaveBeenCalled();
  });

  it('applies alternating row backgrounds when alternatingRows is true', async () => {
    await render(<TorrentTable {...baseProps()} alternatingRows />);
    const row0 = screen.getByText('Alpha Torrent').parent?.parent;
    const row1 = screen.getByText('Beta Torrent').parent?.parent;
    expect(StyleSheet.flatten(row0?.props.style)).toMatchObject({
      backgroundColor: mockColors.surface,
    });
    expect(StyleSheet.flatten(row1?.props.style)).toMatchObject({
      backgroundColor: mockColors.background,
    });
  });

  it('uses the theme primaryOpac background for the selected row', async () => {
    await render(<TorrentTable {...baseProps()} selectedHash="h1" />);
    const row0 = screen.getByText('Alpha Torrent').parent?.parent;
    expect(StyleSheet.flatten(row0?.props.style)).toMatchObject({
      backgroundColor: mockColors.primaryOpac,
    });
  });

  it('has no top padding by default (regular/mac-idiom-agnostic)', async () => {
    await render(<TorrentTable {...baseProps()} />);
    const flattened = StyleSheet.flatten(screen.getByTestId('torrent-table-hscroll').props.style);
    expect(flattened?.paddingTop ?? 0).toBe(0);
  });

  it('reserves paddingTop equal to topInset so the header row clears the mac shell overlay', async () => {
    await render(<TorrentTable {...baseProps()} topInset={100} />);
    expect(
      StyleSheet.flatten(screen.getByTestId('torrent-table-hscroll').props.style),
    ).toMatchObject({ paddingTop: 100 });
  });
});

describe('TorrentTable context menu', () => {
  it('calls onContextMenu with the hash and anchor on long-press', async () => {
    const onContextMenu = jest.fn();
    await render(<TorrentTable {...baseProps()} onContextMenu={onContextMenu} />);
    fireEvent(screen.getByText('Alpha Torrent'), 'longPress', {
      nativeEvent: { pageX: 40, pageY: 60 },
    });
    expect(onContextMenu).toHaveBeenCalledWith('h1', { x: 40, y: 60 });
  });

  // Right-click (onPointerDown) never fires on this RN/Fabric build (see the
  // component's comment) - the ellipsis button is the real mouse path.
  it('renders an ellipsis menu button per row that calls onContextMenu', async () => {
    // The mocked native View shares MockNativeMethods across instances, so
    // the component's measureInWindow call lands on this prototype jest.fn
    // (same pattern as TorrentCard's three-dot menu button test).
    const measureInWindow = (View as unknown as { prototype: { measureInWindow: jest.Mock } })
      .prototype.measureInWindow;
    measureInWindow.mockImplementation(
      (callback: (x: number, y: number, width: number, height: number) => void) =>
        callback(120, 300, 28, 24),
    );
    const onContextMenu = jest.fn();
    const onSelect = jest.fn();
    await render(
      <TorrentTable {...baseProps()} onContextMenu={onContextMenu} onSelect={onSelect} />,
    );

    const menuButtons = screen.getAllByLabelText('actions.torrentMenu');
    expect(menuButtons).toHaveLength(2);
    fireEvent.press(menuButtons[0], { nativeEvent: {} });

    expect(onContextMenu).toHaveBeenCalledWith('h1', { x: 120, y: 324 });
    // Tapping the menu button must not also select the row.
    expect(onSelect).not.toHaveBeenCalled();
    measureInWindow.mockReset();
  });
});

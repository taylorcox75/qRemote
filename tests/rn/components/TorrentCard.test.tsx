import React from 'react';
import { StyleSheet, View } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { TorrentCard } from '@/components/TorrentCard';
import { TorrentInfo } from '@/types/api';
import { ExpandedCardField } from '@/types/preferences';
import { formatProgress, formatSize, formatSpeed, formatTime } from '@/utils/format';
import { spacing, borderRadius } from '@/constants/spacing';
import { mockColors } from './theme-mock';

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

// dlspeed > 0 → getStateColor resolves to stateDownloading for baseTorrent.
const downloadingColor = mockColors.stateDownloading;

const allFieldsOff: Record<ExpandedCardField, boolean> = {
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
};

const fieldsOn = (...keys: ExpandedCardField[]): Record<ExpandedCardField, boolean> => {
  const fields = { ...allFieldsOff };
  for (const key of keys) fields[key] = true;
  return fields;
};

describe('TorrentCard state badge', () => {
  it('renders the state label as a tinted pill in the header (not in the stats line)', async () => {
    await render(<TorrentCard torrent={baseTorrent} onPress={jest.fn()} />);

    // The label appears exactly once — in the badge. It is no longer a
    // segment of the stats line.
    const labels = screen.getAllByText('states.downloading');
    expect(labels).toHaveLength(1);

    // Text uses the theme text color (state-colored text on its own tint can
    // be unreadable); the state color lives in the tint layer below.
    const badgeText = labels[0];
    expect(StyleSheet.flatten(badgeText.props.style)).toMatchObject({
      color: mockColors.text,
      fontSize: 11,
      fontWeight: '600',
    });

    // The pill's tint is an absolutely-filled sibling View: state color at
    // low opacity, so the text on top stays fully opaque.
    const badge = badgeText.parent;
    const tintLayer = badge?.children[0];
    expect(tintLayer).not.toBe(badgeText);
    const tintStyle = StyleSheet.flatten((tintLayer as any).props.style);
    expect(tintStyle).toMatchObject({
      backgroundColor: downloadingColor,
      opacity: 0.28,
      position: 'absolute',
    });
    expect(StyleSheet.flatten(badge?.props.style)).toMatchObject({ overflow: 'hidden' });
  });

  it('does not render the old state dot', async () => {
    await render(<TorrentCard torrent={baseTorrent} onPress={jest.fn()} />);

    // The 6x6 dot was replaced by the badge; no remaining view should carry
    // its signature style.
    const allViews = screen.root?.queryAll((node) => node.type === 'View') ?? [];
    const dot = allViews.find((v) => {
      const s = StyleSheet.flatten(v.props.style);
      return s?.width === 6 && s?.height === 6 && s?.borderRadius === 3;
    });
    expect(dot).toBeUndefined();
  });
});

describe('TorrentCard stats line', () => {
  it('orders segments percent · ETA · down speed · ratio for a downloading torrent', async () => {
    await render(<TorrentCard torrent={baseTorrent} onPress={jest.fn()} />);

    // baseTorrent: eta meaningful (hasEta), upspeed 0 → no up segment,
    // ratio always last as "X.XX ⇅".
    const expected = [
      formatProgress(baseTorrent.progress, 0),
      formatTime(baseTorrent.eta),
      `${formatSpeed(baseTorrent.dlspeed)} ↓`,
      '0.10 ⇅',
    ].join('  ·  ');
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it('omits ETA when meaningless, puts up speed before down speed, and always keeps ratio', async () => {
    const seedingTorrent = {
      ...baseTorrent,
      progress: 1,
      eta: 8640000,
      dlspeed: 500,
      upspeed: 2000,
      ratio: 1.234,
    } as TorrentInfo;
    await render(<TorrentCard torrent={seedingTorrent} onPress={jest.fn()} />);

    const expected = [
      formatProgress(1, 0),
      `${formatSpeed(2000)} ↑`,
      `${formatSpeed(500)} ↓`,
      '1.23 ⇅',
    ].join('  ·  ');
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it('keeps the compact stats line in detailed mode (always on, not toggleable)', async () => {
    await render(
      <TorrentCard
        torrent={baseTorrent}
        onPress={jest.fn()}
        compact={false}
        expandedCardFields={allFieldsOff}
      />,
    );

    const compactLine = [
      formatProgress(baseTorrent.progress, 0),
      formatTime(baseTorrent.eta),
      `${formatSpeed(baseTorrent.dlspeed)} ↓`,
      '0.10 ⇅',
    ].join('  ·  ');
    expect(screen.getByText(compactLine)).toBeTruthy();
    expect(
      screen.getByText(`${formatSize(baseTorrent.completed)} / ${formatSize(baseTorrent.total_size)}`),
    ).toBeTruthy();
  });
});

describe('TorrentCard container (left accent border + compact density)', () => {
  it('paints a state-colored left accent and uses the tightened compact padding', async () => {
    await render(<TorrentCard torrent={baseTorrent} onPress={jest.fn()} />);

    // name Text → headerRow View → card container.
    const card = screen.getByText('Sample Torrent').parent?.parent;
    expect(StyleSheet.flatten(card?.props.style)).toMatchObject({
      borderLeftWidth: 1.5,
      borderLeftColor: downloadingColor,
      backgroundColor: mockColors.surface,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm - 2,
      borderRadius: borderRadius.medium,
    });
  });

  it('uses roomier padding and larger radius in detailed mode', async () => {
    await render(
      <TorrentCard
        torrent={baseTorrent}
        onPress={jest.fn()}
        compact={false}
        expandedCardFields={allFieldsOff}
      />,
    );

    const card = screen.getByText('Sample Torrent').parent?.parent;
    expect(StyleSheet.flatten(card?.props.style)).toMatchObject({
      borderLeftWidth: 1.5,
      borderLeftColor: downloadingColor,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.large,
    });
  });

  it('renders the name at 15pt semibold with a tight line height', async () => {
    await render(<TorrentCard torrent={baseTorrent} onPress={jest.fn()} />);

    const name = screen.getByText('Sample Torrent');
    expect(name.props.numberOfLines).toBe(2);
    expect(StyleSheet.flatten(name.props.style)).toMatchObject({
      fontSize: 15,
      fontWeight: '600',
      lineHeight: 18,
    });
  });
});

describe('TorrentCard pause/play circle', () => {
  it('renders a filled 24pt circle in the state color and calls onPauseResume', async () => {
    const onPauseResume = jest.fn();
    await render(
      <TorrentCard torrent={baseTorrent} onPress={jest.fn()} onPauseResume={onPauseResume} />,
    );

    const button = screen.getByLabelText('actions.pause');
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: downloadingColor,
    });

    fireEvent.press(button, { nativeEvent: {} });
    expect(onPauseResume).toHaveBeenCalledTimes(1);
  });

  it('renders a slightly larger pause circle in detailed mode', async () => {
    await render(
      <TorrentCard
        torrent={baseTorrent}
        onPress={jest.fn()}
        onPauseResume={jest.fn()}
        compact={false}
        expandedCardFields={allFieldsOff}
      />,
    );

    const button = screen.getByLabelText('actions.pause');
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: downloadingColor,
    });
  });

  it('shows the resume label when the torrent is paused', async () => {
    await render(
      <TorrentCard
        torrent={{ ...baseTorrent, state: 'pausedDL', dlspeed: 0 } as TorrentInfo}
        onPress={jest.fn()}
        onPauseResume={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('actions.resume')).toBeTruthy();
    expect(screen.queryByLabelText('actions.pause')).toBeNull();
  });

  it('renders no pause button when onPauseResume is not provided', async () => {
    await render(<TorrentCard torrent={baseTorrent} onPress={jest.fn()} />);

    expect(screen.queryByLabelText('actions.pause')).toBeNull();
    expect(screen.queryByLabelText('actions.resume')).toBeNull();
  });
});

describe('TorrentCard three-dot menu button', () => {
  // The mocked native View shares MockNativeMethods across instances, so the
  // component's measureInWindow call lands on this prototype jest.fn.
  const measureInWindow = (View as any).prototype.measureInWindow as jest.Mock;

  afterEach(() => {
    measureInWindow.mockReset();
  });

  it('renders only when onMenuPress is provided', async () => {
    await render(<TorrentCard torrent={baseTorrent} onPress={jest.fn()} />);
    expect(screen.queryByLabelText('actions.torrentMenu')).toBeNull();

    await screen.unmount();

    await render(
      <TorrentCard torrent={baseTorrent} onPress={jest.fn()} onMenuPress={jest.fn()} />,
    );
    expect(screen.getByLabelText('actions.torrentMenu')).toBeTruthy();
  });

  it('measures itself and calls onMenuPress with the bottom-left corner', async () => {
    measureInWindow.mockImplementation(
      (callback: (x: number, y: number, width: number, height: number) => void) =>
        callback(120, 300, 28, 24),
    );
    const onMenuPress = jest.fn();
    const onPress = jest.fn();
    await render(
      <TorrentCard torrent={baseTorrent} onPress={onPress} onMenuPress={onMenuPress} />,
    );

    fireEvent.press(screen.getByLabelText('actions.torrentMenu'), { nativeEvent: {} });

    // Bottom-left corner: x unchanged, y + height (frozen contract).
    expect(onMenuPress).toHaveBeenCalledTimes(1);
    expect(onMenuPress).toHaveBeenCalledWith({ x: 120, y: 324 });
    // Tapping the menu button must not also open the torrent detail.
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('TorrentCard expanded detail grid — stacked label-over-value cells', () => {
  it('renders no detail grid when all optional fields are disabled', async () => {
    await render(
      <TorrentCard
        torrent={baseTorrent}
        onPress={jest.fn()}
        compact={false}
        expandedCardFields={allFieldsOff}
      />,
    );

    expect(screen.queryByText('screens.settings.expandedCardFieldsList.progress')).toBeNull();
    expect(screen.queryByText('screens.settings.expandedCardFieldsList.seeds')).toBeNull();
    // Always-on compact lines remain even with every grid field off.
    expect(screen.getByText(`${formatSize(500)} / ${formatSize(1000)}`)).toBeTruthy();
  });

  it('renders short fields as 25%-width cells by default (4 columns)', async () => {
    await render(
      <TorrentCard
        torrent={baseTorrent}
        onPress={jest.fn()}
        compact={false}
        expandedCardFields={fieldsOn('seeds', 'peers')}
      />,
    );

    const label = screen.getByText('screens.settings.expandedCardFieldsList.seeds');
    const cell = label.parent;
    expect(StyleSheet.flatten(cell?.props.style)).toMatchObject({ width: '25%' });

    // Label on top (11pt secondary), value beneath (13pt primary).
    expect(cell?.children[0]).toBe(label);
    expect(StyleSheet.flatten(label.props.style)).toMatchObject({
      fontSize: 11,
      color: mockColors.textSecondary,
    });
    const value = cell?.children[1] as any;
    expect(StyleSheet.flatten(value.props.style)).toMatchObject({
      fontSize: 13,
      color: mockColors.text,
    });
    expect(screen.getAllByText('1 / 2')).toHaveLength(2);
    expect(screen.getByText('screens.settings.expandedCardFieldsList.peers')).toBeTruthy();
  });

  it('honors a custom gridColumns prop for cell width', async () => {
    await render(
      <TorrentCard
        torrent={baseTorrent}
        onPress={jest.fn()}
        compact={false}
        expandedCardFields={fieldsOn('seeds')}
        gridColumns={3}
      />,
    );

    const label = screen.getByText('screens.settings.expandedCardFieldsList.seeds');
    expect(StyleSheet.flatten(label.parent?.props.style)).toMatchObject({ width: '33.33%' });
  });

  it('renders addedOn as two ordinary adjacent cells (date + time), no pair wrapper', async () => {
    await render(
      <TorrentCard
        torrent={baseTorrent}
        onPress={jest.fn()}
        compact={false}
        expandedCardFields={fieldsOn('addedOn')}
      />,
    );

    const dateLabel = screen.getByText('screens.settings.expandedCardFieldsList.addedOn');
    const timeLabel = screen.getByText('screens.settings.expandedCardFieldsList.addedTime');

    const dateCell = dateLabel.parent;
    const timeCell = timeLabel.parent;
    expect(dateCell).not.toBe(timeCell);
    expect(StyleSheet.flatten(dateCell?.props.style)).toMatchObject({ width: '25%' });
    expect(StyleSheet.flatten(timeCell?.props.style)).toMatchObject({ width: '25%' });

    // Both cells sit directly in the wrapping detail grid (the old PairRow
    // wrapper is gone).
    expect(dateCell?.parent).toBe(timeCell?.parent);
    expect(StyleSheet.flatten(dateCell?.parent?.props.style)).toMatchObject({
      flexDirection: 'row',
      flexWrap: 'wrap',
    });
  });

  it('renders long fields as full-width truncated rows', async () => {
    await render(
      <TorrentCard
        torrent={{ ...baseTorrent, save_path: '/downloads/very/long/path/to/files' } as TorrentInfo}
        onPress={jest.fn()}
        compact={false}
        expandedCardFields={fieldsOn('savePath')}
      />,
    );

    const label = screen.getByText('screens.settings.expandedCardFieldsList.savePath');
    const row = label.parent;
    expect(StyleSheet.flatten(row?.props.style)).toMatchObject({
      flexDirection: 'row',
      width: '100%',
    });

    const value = screen.getByText('/downloads/very/long/path/to/files');
    expect(value.props.numberOfLines).toBe(1);
    expect(value.props.ellipsizeMode).toBe('middle');
  });
});

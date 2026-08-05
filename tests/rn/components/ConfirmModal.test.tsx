import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { ConfirmModal } from '@/components/ConfirmModal';

// Deliberately a DARK palette: `surface` is near-black here, which is what
// exposed the bug where filled-button labels were colored with `surface` and
// became unreadable in dark mode.
jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      surface: '#111111',
      text: '#fff',
      textSecondary: '#666',
      surfaceOutline: '#ccc',
      primary: '#00f',
      error: '#f00',
      onAccent: '#ffffff',
    },
  }),
}));

describe('ConfirmModal', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders title and message', async () => {
    await render(
      <ConfirmModal
        visible
        title="Delete"
        message="Delete this torrent?"
        buttons={[{ label: 'Torrent Only', onPress: jest.fn() }]}
        cancelLabel="Cancel"
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText('Delete')).toBeTruthy();
    expect(screen.getByText('Delete this torrent?')).toBeTruthy();
  });

  it('does not render message when omitted', async () => {
    await render(
      <ConfirmModal
        visible
        title="Delete"
        buttons={[{ label: 'Torrent Only', onPress: jest.fn() }]}
        cancelLabel="Cancel"
        onCancel={jest.fn()}
      />,
    );
    expect(screen.queryByText('Delete this torrent?')).toBeNull();
  });

  it('calls button onPress handlers', async () => {
    const onTorrentOnly = jest.fn();
    const onWithFiles = jest.fn();
    await render(
      <ConfirmModal
        visible
        title="Delete"
        buttons={[
          { label: 'Torrent Only', onPress: onTorrentOnly },
          { label: 'With Files', onPress: onWithFiles, destructive: true },
        ]}
        cancelLabel="Cancel"
        onCancel={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByText('Torrent Only'));
    expect(onTorrentOnly).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByText('With Files'));
    expect(onWithFiles).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel is pressed', async () => {
    const onCancel = jest.fn();
    await render(
      <ConfirmModal
        visible
        title="Delete"
        buttons={[{ label: 'Torrent Only', onPress: jest.fn() }]}
        cancelLabel="Cancel"
        onCancel={onCancel}
      />,
    );
    await fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // Regression: the action-button labels sit on a filled primary/error
  // background, so they must use `onAccent` (always white) rather than
  // `surface`, which is near-black in dark mode and rendered them unreadable.
  it('colors action-button labels with onAccent, not surface', async () => {
    await render(
      <ConfirmModal
        visible
        title="Delete"
        buttons={[
          { label: 'Torrent Only', onPress: jest.fn() },
          { label: 'With Files', onPress: jest.fn(), destructive: true },
        ]}
        cancelLabel="Cancel"
        onCancel={jest.fn()}
      />,
    );

    for (const label of ['Torrent Only', 'With Files']) {
      const style = StyleSheet.flatten(screen.getByText(label).props.style);
      expect(style.color).toBe('#ffffff');
      expect(style.color).not.toBe('#111111');
    }

    // The cancel button sits on a neutral surfaceOutline fill, so it keeps
    // using the ordinary text color.
    const cancelStyle = StyleSheet.flatten(screen.getByText('Cancel').props.style);
    expect(cancelStyle.color).toBe('#fff');
  });
});

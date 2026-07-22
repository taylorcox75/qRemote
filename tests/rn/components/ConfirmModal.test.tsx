import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { ConfirmModal } from '@/components/ConfirmModal';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      surface: '#fff',
      text: '#000',
      textSecondary: '#666',
      surfaceOutline: '#ccc',
      primary: '#00f',
      error: '#f00',
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
});

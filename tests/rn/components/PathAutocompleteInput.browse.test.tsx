import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { PathAutocompleteInput } from '@/components/PathAutocompleteInput';
import { apiClient } from '@/services/api/client';
import { useServer } from '@/context/ServerContext';
import { useTorrents } from '@/context/TorrentContext';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      surface: '#fff',
      text: '#000',
      textSecondary: '#666',
      surfaceOutline: '#ccc',
      primary: '#007aff',
      background: '#fff',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/context/ServerContext', () => ({ useServer: jest.fn() }));
jest.mock('@/context/TorrentContext', () => ({ useTorrents: jest.fn() }));

jest.mock('@/services/api/application', () => ({
  applicationApi: { getDirectoryContent: jest.fn() },
}));

jest.mock('@/services/api/client', () => ({
  apiClient: { getApiFeatures: jest.fn() },
}));

describe('PathAutocompleteInput — browse known save paths (#180)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useServer).mockReturnValue({ isConnected: true } as any);
    jest.mocked(apiClient.getApiFeatures).mockReturnValue({
      supportsGetDirectoryContent: true,
    } as any);
  });

  it('opens the browse picker with paths known from torrents and categories', async () => {
    jest.mocked(useTorrents).mockReturnValue({
      torrents: [{ save_path: '/data/movies' }, { save_path: '/data/tv' }] as any,
      categories: { books: { name: 'books', savePath: '/data/books' } } as any,
      tags: [],
    } as any);

    const onChangeText = jest.fn();
    await render(
      <PathAutocompleteInput testID="path-input" value="" onChangeText={onChangeText} />,
    );

    await fireEvent.press(screen.getByLabelText('savePathPicker.browseButtonLabel'));

    expect(await screen.findByText('/data/movies')).toBeTruthy();
    expect(screen.getByText('/data/tv')).toBeTruthy();
    expect(screen.getByText('/data/books')).toBeTruthy();
  });

  it('selecting a path from the browse picker sets the exact value (no trailing slash)', async () => {
    jest.mocked(useTorrents).mockReturnValue({
      torrents: [{ save_path: '/data/movies' }] as any,
      categories: {},
      tags: [],
    } as any);

    const onChangeText = jest.fn();
    await render(
      <PathAutocompleteInput testID="path-input" value="" onChangeText={onChangeText} />,
    );

    await fireEvent.press(screen.getByLabelText('savePathPicker.browseButtonLabel'));
    await fireEvent.press(await screen.findByText('/data/movies'));

    expect(onChangeText).toHaveBeenCalledWith('/data/movies');
  });

  it('disables the browse button when the field is not editable', async () => {
    jest.mocked(useTorrents).mockReturnValue({
      torrents: [{ save_path: '/data/movies' }] as any,
      categories: {},
      tags: [],
    } as any);

    await render(
      <PathAutocompleteInput
        testID="path-input"
        value=""
        onChangeText={jest.fn()}
        editable={false}
      />,
    );

    fireEvent.press(screen.getByLabelText('savePathPicker.browseButtonLabel'));
    expect(screen.queryByText('/data/movies')).toBeNull();
  });
});

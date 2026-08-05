import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { PathAutocompleteInput } from '@/components/PathAutocompleteInput';
import { applicationApi } from '@/services/api/application';
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

describe('PathAutocompleteInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(useServer)
      .mockReturnValue({ isConnected: true } as unknown as ReturnType<typeof useServer>);
    jest
      .mocked(useTorrents)
      .mockReturnValue({ torrents: [], categories: {}, tags: [] } as unknown as ReturnType<
        typeof useTorrents
      >);
    jest.mocked(apiClient.getApiFeatures).mockReturnValue({
      supportsGetDirectoryContent: true,
    } as unknown as ReturnType<typeof apiClient.getApiFeatures>);
  });

  it('renders no suggestions when disconnected', async () => {
    jest
      .mocked(useServer)
      .mockReturnValue({ isConnected: false } as unknown as ReturnType<typeof useServer>);
    jest.mocked(applicationApi.getDirectoryContent).mockResolvedValue(['/data']);

    const onChangeText = jest.fn();
    await render(
      <PathAutocompleteInput testID="path-input" value="/da" onChangeText={onChangeText} />,
    );
    fireEvent.changeText(screen.getByTestId('path-input'), '/da');

    // Give the (non-existent) debounced fetch a chance to have fired.
    await new Promise((r) => setTimeout(r, 400));

    expect(applicationApi.getDirectoryContent).not.toHaveBeenCalled();
  });

  it('shows full paths (not bare basenames) as suggestions', async () => {
    jest.mocked(applicationApi.getDirectoryContent).mockResolvedValue(['/data', '/downloads']);

    const onChangeText = jest.fn();
    await render(
      <PathAutocompleteInput testID="path-input" value="/da" onChangeText={onChangeText} />,
    );

    fireEvent.changeText(screen.getByTestId('path-input'), '/da');

    expect(await screen.findByText('/data')).toBeTruthy();
    expect(screen.queryByText('data')).toBeNull();
  });

  it('fetches suggestions for a Windows drive-letter path other than the current drive', async () => {
    jest.mocked(applicationApi.getDirectoryContent).mockResolvedValue(['D:/Downloads']);

    const onChangeText = jest.fn();
    await render(
      <PathAutocompleteInput testID="path-input" value="D:/Do" onChangeText={onChangeText} />,
    );

    fireEvent.changeText(screen.getByTestId('path-input'), 'D:/Do');

    expect(await screen.findByText('D:/Downloads')).toBeTruthy();
    expect(applicationApi.getDirectoryContent).toHaveBeenCalledWith('D:/', 'dirs');
  });

  it('normalizes backslash-separated Windows entries to forward-slash suggestions', async () => {
    jest.mocked(applicationApi.getDirectoryContent).mockResolvedValue(['F:\\test folder']);

    const onChangeText = jest.fn();
    await render(
      <PathAutocompleteInput testID="path-input" value="F:/" onChangeText={onChangeText} />,
    );

    fireEvent.changeText(screen.getByTestId('path-input'), 'F:/');

    expect(await screen.findByText('F:/test folder')).toBeTruthy();
    expect(screen.queryByText('F:/F:\\test folder')).toBeNull();
  });

  it('fetches suggestions for a Windows drive-letter path typed with backslashes', async () => {
    jest.mocked(applicationApi.getDirectoryContent).mockResolvedValue(['D:\\Downloads']);

    const onChangeText = jest.fn();
    await render(
      <PathAutocompleteInput testID="path-input" value="D:\\Do" onChangeText={onChangeText} />,
    );

    fireEvent.changeText(screen.getByTestId('path-input'), 'D:\\Do');

    expect(await screen.findByText('D:\\Downloads')).toBeTruthy();
    expect(applicationApi.getDirectoryContent).toHaveBeenCalledWith('D:\\', 'dirs');
  });

  it('fetches suggestions for a UNC share path', async () => {
    jest
      .mocked(applicationApi.getDirectoryContent)
      .mockResolvedValue(['\\\\nas\\share\\Downloads']);

    const onChangeText = jest.fn();
    await render(
      <PathAutocompleteInput
        testID="path-input"
        value="\\\\nas\\share\\Do"
        onChangeText={onChangeText}
      />,
    );

    fireEvent.changeText(screen.getByTestId('path-input'), '\\\\nas\\share\\Do');

    expect(await screen.findByText('\\\\nas\\share\\Downloads')).toBeTruthy();
    expect(applicationApi.getDirectoryContent).toHaveBeenCalledWith('\\\\nas\\share\\', 'dirs');
  });

  it('appends a backslash (not a forward slash) when a Windows-style suggestion is tapped', async () => {
    jest.mocked(applicationApi.getDirectoryContent).mockResolvedValue(['D:\\Downloads']);

    const onChangeText = jest.fn();
    await render(
      <PathAutocompleteInput testID="path-input" value="D:\\Do" onChangeText={onChangeText} />,
    );

    fireEvent.changeText(screen.getByTestId('path-input'), 'D:\\Do');
    const suggestion = await screen.findByText('D:\\Downloads');

    fireEvent(suggestion.parent!, 'press');

    expect(onChangeText).toHaveBeenCalledWith('D:\\Downloads\\');
  });

  it('never treats a literal backslash in a Linux path as a separator', async () => {
    jest.mocked(applicationApi.getDirectoryContent).mockResolvedValue(['/data/weird']);

    const onChangeText = jest.fn();
    await render(
      <PathAutocompleteInput
        testID="path-input"
        value="/data/weird\\name"
        onChangeText={onChangeText}
      />,
    );

    fireEvent.changeText(screen.getByTestId('path-input'), '/data/weird\\name');

    // Give the debounced fetch a chance to have fired.
    await new Promise((r) => setTimeout(r, 400));

    expect(applicationApi.getDirectoryContent).toHaveBeenCalledWith('/data/', 'dirs');
  });

  it('immediately fetches the next directory level after a suggestion is tapped', async () => {
    jest
      .mocked(applicationApi.getDirectoryContent)
      .mockResolvedValueOnce(['/data'])
      .mockResolvedValueOnce(['/data/downloads', '/data/movies']);

    const onChangeText = jest.fn();
    const { rerender } = await render(
      <PathAutocompleteInput testID="path-input" value="/da" onChangeText={onChangeText} />,
    );

    fireEvent.changeText(screen.getByTestId('path-input'), '/da');
    const suggestion = await screen.findByText('/data');

    fireEvent(suggestion.parent!, 'press');

    // applySuggestion calls onChangeText synchronously with the new value —
    // simulate the parent re-rendering with that value, as a real screen would.
    expect(onChangeText).toHaveBeenCalledWith('/data/');
    rerender(
      <PathAutocompleteInput testID="path-input" value="/data/" onChangeText={onChangeText} />,
    );

    expect(await screen.findByText('/data/downloads')).toBeTruthy();
    expect(await screen.findByText('/data/movies')).toBeTruthy();
    expect(applicationApi.getDirectoryContent).toHaveBeenCalledWith('/data/', 'dirs');
  });
});

import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { PathAutocompleteInput } from '@/components/PathAutocompleteInput';
import { applicationApi } from '@/services/api/application';
import { apiClient } from '@/services/api/client';
import { useServer } from '@/context/ServerContext';
import { useTorrents } from '@/context/TorrentContext';

jest.mock('@/context/ThemeContext', () => require('@/tests/rn/components/cov/mocks').themeModule);
jest.mock('react-i18next', () => require('@/tests/rn/components/cov/mocks').i18nModule);
jest.mock('@/context/ServerContext', () => ({ useServer: jest.fn() }));
jest.mock('@/context/TorrentContext', () => ({ useTorrents: jest.fn() }));
jest.mock('@/services/api/application', () => ({
  applicationApi: { getDirectoryContent: jest.fn() },
}));
jest.mock('@/services/api/client', () => ({ apiClient: { getApiFeatures: jest.fn() } }));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function setConnected(isConnected: boolean, supported = true) {
  jest
    .mocked(useServer)
    .mockReturnValue({ isConnected } as unknown as ReturnType<typeof useServer>);
  jest.mocked(apiClient.getApiFeatures).mockReturnValue({
    supportsGetDirectoryContent: supported,
  } as unknown as ReturnType<typeof apiClient.getApiFeatures>);
}

describe('PathAutocompleteInput (edge paths)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setConnected(true);
    jest.mocked(useTorrents).mockReturnValue({
      torrents: [],
      categories: {},
      tags: [],
    } as unknown as ReturnType<typeof useTorrents>);
  });

  it('does not query the server while disconnected', async () => {
    setConnected(false);
    const onChangeText = jest.fn();
    await render(<PathAutocompleteInput testID="p" value="" onChangeText={onChangeText} />);
    await fireEvent.changeText(screen.getByTestId('p'), '/da');
    expect(onChangeText).toHaveBeenCalledWith('/da');
    await sleep(350);
    expect(applicationApi.getDirectoryContent).not.toHaveBeenCalled();
  });

  it('does not query when the server lacks getDirectoryContent', async () => {
    setConnected(true, false);
    await render(<PathAutocompleteInput testID="p" value="" onChangeText={jest.fn()} />);
    await fireEvent.changeText(screen.getByTestId('p'), '/da');
    await sleep(350);
    expect(applicationApi.getDirectoryContent).not.toHaveBeenCalled();
  });

  it('ignores relative text with no separator', async () => {
    await render(<PathAutocompleteInput testID="p" value="" onChangeText={jest.fn()} />);
    await fireEvent.changeText(screen.getByTestId('p'), 'downloads');
    await sleep(350);
    expect(applicationApi.getDirectoryContent).not.toHaveBeenCalled();
  });

  it('lists the parent directory and filters by the partial name', async () => {
    jest
      .mocked(applicationApi.getDirectoryContent)
      .mockResolvedValue(['/data/movies', '/data/music', '/data/tv']);
    await render(<PathAutocompleteInput testID="p" value="/data/m" onChangeText={jest.fn()} />);
    await fireEvent.changeText(screen.getByTestId('p'), '/data/m');
    await waitFor(() => expect(screen.getByText('/data/movies')).toBeTruthy());
    expect(applicationApi.getDirectoryContent).toHaveBeenCalledWith('/data/', 'dirs');
    expect(screen.getByText('/data/music')).toBeTruthy();
    expect(screen.queryByText('/data/tv')).toBeNull();
  });

  it('clears suggestions when the request fails', async () => {
    jest.mocked(applicationApi.getDirectoryContent).mockRejectedValue(new Error('boom'));
    await render(<PathAutocompleteInput testID="p" value="/x/" onChangeText={jest.fn()} />);
    await fireEvent.changeText(screen.getByTestId('p'), '/x/');
    await waitFor(() => expect(applicationApi.getDirectoryContent).toHaveBeenCalled());
    await sleep(20);
    expect(screen.queryByText(/^\/x\//)).toBeNull();
  });

  it('drops a stale reply superseded by newer typing', async () => {
    let resolveFirst: (v: string[]) => void = () => {};
    jest
      .mocked(applicationApi.getDirectoryContent)
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce(['/b/new']);
    await render(<PathAutocompleteInput testID="p" value="" onChangeText={jest.fn()} />);
    await fireEvent.changeText(screen.getByTestId('p'), '/a/');
    await waitFor(() => expect(applicationApi.getDirectoryContent).toHaveBeenCalledTimes(1));
    await fireEvent.changeText(screen.getByTestId('p'), '/b/');
    await waitFor(() => expect(screen.getByText('/b/new')).toBeTruthy());
    resolveFirst(['/a/old']);
    await sleep(20);
    expect(screen.queryByText('/a/old')).toBeNull();
  });

  it('clears suggestions shortly after blur and forwards onBlur', async () => {
    jest.mocked(applicationApi.getDirectoryContent).mockResolvedValue(['/data/movies']);
    const onBlur = jest.fn();
    await render(
      <PathAutocompleteInput testID="p" value="" onChangeText={jest.fn()} onBlur={onBlur} />,
    );
    await fireEvent.changeText(screen.getByTestId('p'), '/data/');
    await waitFor(() => expect(screen.getByText('/data/movies')).toBeTruthy());
    await fireEvent(screen.getByTestId('p'), 'blur', { nativeEvent: {} });
    expect(onBlur).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('/data/movies')).toBeNull());
  });

  it('applying a Windows-style suggestion appends a backslash', async () => {
    jest
      .mocked(applicationApi.getDirectoryContent)
      .mockResolvedValueOnce(['C:\\Downloads'])
      .mockResolvedValue([]);
    const onChangeText = jest.fn();
    await render(<PathAutocompleteInput testID="p" value="" onChangeText={onChangeText} />);
    await fireEvent.changeText(screen.getByTestId('p'), 'C:\\D');
    await waitFor(() => expect(screen.getByText('C:\\Downloads')).toBeTruthy());
    await fireEvent.press(screen.getByText('C:\\Downloads'));
    expect(onChangeText).toHaveBeenLastCalledWith('C:\\Downloads\\');
  });

  it('cancels pending work on unmount', async () => {
    jest.mocked(applicationApi.getDirectoryContent).mockResolvedValue(['/data/movies']);
    const view = await render(
      <PathAutocompleteInput testID="p" value="" onChangeText={jest.fn()} />,
    );
    await fireEvent.changeText(screen.getByTestId('p'), '/data/');
    await fireEvent(screen.getByTestId('p'), 'blur', { nativeEvent: {} });
    await view.unmount();
    await sleep(350);
    expect(applicationApi.getDirectoryContent).not.toHaveBeenCalled();
  });
});

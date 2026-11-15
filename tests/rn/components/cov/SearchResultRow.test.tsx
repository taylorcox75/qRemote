import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { SearchResultRow } from '@/components/SearchResultRow';
import { SearchResult } from '@/types/api';

jest.mock('@/context/ThemeContext', () => require('@/tests/rn/components/cov/mocks').themeModule);
jest.mock('react-i18next', () => require('@/tests/rn/components/cov/mocks').i18nModule);

const result: SearchResult = {
  fileName: 'Big.Buck.Bunny.1080p',
  fileUrl: 'https://tracker.example/dl/1.torrent',
  fileSize: 1024 * 1024 * 700,
  nbSeeders: 42,
  nbLeechers: 3,
  siteUrl: 'https://tracker.example',
  descrLink: 'https://tracker.example/t/1',
  engineName: 'example',
  pubDate: 1700000000,
} as SearchResult;

describe('SearchResultRow (expanded actions)', () => {
  it('expands on tap and exposes open/copy actions with the right URLs', async () => {
    const onOpenLink = jest.fn();
    const onCopyUrl = jest.fn();
    await render(
      <SearchResultRow
        result={result}
        onAdd={jest.fn()}
        onOpenLink={onOpenLink}
        onCopyUrl={onCopyUrl}
      />,
    );
    expect(screen.queryByText('screens.search.openDescription')).toBeNull();
    await fireEvent.press(screen.getByText('Big.Buck.Bunny.1080p'));
    await fireEvent.press(screen.getByText('screens.search.openDescription'));
    expect(onOpenLink).toHaveBeenLastCalledWith('https://tracker.example/t/1');
    await fireEvent.press(screen.getByText('screens.search.openSite'));
    expect(onOpenLink).toHaveBeenLastCalledWith('https://tracker.example');
    await fireEvent.press(screen.getByText('screens.search.copyLink'));
    expect(onCopyUrl).toHaveBeenCalledWith('https://tracker.example/dl/1.torrent');
  });

  it('collapses again on a second tap', async () => {
    await render(<SearchResultRow result={result} onAdd={jest.fn()} onOpenLink={jest.fn()} />);
    await fireEvent.press(screen.getByText('Big.Buck.Bunny.1080p'));
    expect(screen.getByText('screens.search.openSite')).toBeTruthy();
    await fireEvent.press(screen.getByText('Big.Buck.Bunny.1080p'));
    expect(screen.queryByText('screens.search.openSite')).toBeNull();
  });

  it('omits actions whose handler or URL is missing', async () => {
    await render(
      <SearchResultRow
        result={{ ...result, descrLink: '', fileName: '' }}
        onAdd={jest.fn()}
        onCopyUrl={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByText('—'));
    expect(screen.queryByText('screens.search.openDescription')).toBeNull();
    expect(screen.queryByText('screens.search.openSite')).toBeNull();
    expect(screen.getByText('screens.search.copyLink')).toBeTruthy();
  });

  it('forwards long-press with the result', async () => {
    const onLongPress = jest.fn();
    await render(<SearchResultRow result={result} onAdd={jest.fn()} onLongPress={onLongPress} />);
    await fireEvent(screen.getByText('Big.Buck.Bunny.1080p'), 'longPress');
    expect(onLongPress).toHaveBeenCalledWith(result);
  });

  it('renders a footer', async () => {
    const { Text } = jest.requireActual('react-native');
    await render(
      <SearchResultRow result={result} onAdd={jest.fn()} footer={<Text>3 sources</Text>} />,
    );
    expect(screen.getByText('3 sources')).toBeTruthy();
  });
});

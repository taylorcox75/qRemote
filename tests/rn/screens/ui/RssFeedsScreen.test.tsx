import React from 'react';
import * as Clipboard from 'expo-clipboard';
import { act, render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import RssFeedsScreen from '@/app/(tabs)/rss/index';
import RssLayout from '@/app/(tabs)/rss/_layout';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { View } = jest.requireActual('react-native');
  const React = jest.requireActual('react');
  return {
    useRouter: () => ({ push: mockPush }),
    Stack: (props: { screenOptions: { contentStyle: object } }) =>
      React.createElement(View, { testID: 'stack', style: props.screenOptions.contentStyle }),
  };
});
jest.mock('@/context/ThemeContext', () => require('@/tests/rn/components/cov/mocks').themeModule);
jest.mock('react-i18next', () => require('@/tests/rn/components/cov/mocks').i18nModule);
jest.mock('@/components/FocusAwareStatusBar', () =>
  require('@/tests/rn/components/cov/mocks').focusAwareStatusBarModule,
);
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
const mockShowToast = jest.fn();
jest.mock('@/context/ToastContext', () => ({ useToast: () => ({ showToast: mockShowToast }) }));
const mockServer = jest.fn(() => ({ isConnected: true }));
jest.mock('@/context/ServerContext', () => ({ useServer: () => mockServer() }));
const mockFeeds = jest.fn();
jest.mock('@/hooks/useRssFeeds', () => ({ useRssFeeds: () => mockFeeds() }));
const mockGlassInset = jest.fn<number | undefined, []>(() => undefined);
jest.mock('@/context/LiquidGlassContext', () => ({
  ...jest.requireActual('@/context/LiquidGlassContext'),
  useGlassStackTopInset: () => mockGlassInset(),
}));

const ubuntu = { url: 'https://ubuntu.com/rss', title: 'Ubuntu Releases', isLoading: false, hasError: false };
const news = { url: 'https://news.example/feed', title: 'News', isLoading: false, hasError: false };
const broken = { url: 'not a url', title: '', isLoading: false, hasError: true };
const loading = { url: 'https://x.org/a', title: 'Loading', isLoading: true, hasError: false };

const tree = {
  Linux: { Ubuntu: ubuntu, Sub: {} },
  'https://news.example/feed': news,
  Broken: broken,
  Loading: loading,
};

let api: Record<string, jest.Mock> & { tree: object; folders: string[]; feeds: object[] };

function setup(overrides: Partial<typeof api> = {}) {
  api = {
    tree,
    folders: ['Linux', 'Linux\\Sub'],
    feeds: [
      { path: 'Linux\\Ubuntu', feed: ubuntu },
      { path: 'https://news.example/feed', feed: news },
      { path: 'Broken', feed: broken },
    ],
    isLoading: false as never,
    refresh: jest.fn().mockResolvedValue(undefined),
    addFolder: jest.fn().mockResolvedValue(undefined),
    addFeed: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    moveItem: jest.fn().mockResolvedValue(undefined),
    refreshItem: jest.fn().mockResolvedValue(undefined),
    markAsRead: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as typeof api;
  mockFeeds.mockImplementation(() => api);
  return render(<RssFeedsScreen />);
}

const longPress = (text: string) =>
  fireEvent(screen.getByText(text), 'longPress', { nativeEvent: { pageX: 10, pageY: 20 } });

// ActionMenu runs an item's handler 150ms after the tap, once its close animation starts.
const menuDelay = () => act(() => new Promise<void>((r) => setTimeout(r, 200)));

async function menu(rowText: string, item: string) {
  await longPress(rowText);
  await fireEvent.press(screen.getByText(item));
  await menuDelay();
}

async function submitInput(value: string) {
  const input = screen.getByDisplayValue(/.*/);
  await fireEvent.changeText(input, value);
  await fireEvent.press(screen.getByText('common.confirm'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockServer.mockImplementation(() => ({ isConnected: true }));
});

describe('RssLayout', () => {
  it('pads the stack under the glass tab bar only when an inset is provided', async () => {
    await render(<RssLayout />);
    expect(screen.getByTestId('stack').props.style).not.toHaveProperty('paddingTop');
    mockGlassInset.mockReturnValue(44);
    await render(<RssLayout />);
    expect(screen.getByTestId('stack').props.style).toMatchObject({ paddingTop: 44 });
  });
});

describe('RssFeedsScreen — states', () => {
  it('shows a spinner while loading', async () => {
    await setup({ isLoading: true as never });
    expect(screen.queryByText('Linux')).toBeNull();
    expect(screen.queryByText('screens.rss.noFeedsTitle')).toBeNull();
  });

  it('shows a not-connected state', async () => {
    mockServer.mockImplementation(() => ({ isConnected: false }));
    await setup();
    expect(screen.getByText('toast.notConnected')).toBeTruthy();
  });

  it('shows an empty state with no feeds', async () => {
    await setup({ tree: {}, feeds: [], folders: [] });
    expect(screen.getByText('screens.rss.noFeedsTitle')).toBeTruthy();
  });
});

describe('RssFeedsScreen — tree', () => {
  it('lists root rows with display names and subtitles; folders start collapsed', async () => {
    await setup();
    expect(screen.getByText('Linux')).toBeTruthy();
    expect(screen.getByText('News')).toBeTruthy();
    expect(screen.getByText('news.example')).toBeTruthy();
    expect(screen.getByText('Broken')).toBeTruthy();
    expect(screen.getByText('not a url')).toBeTruthy();
    expect(screen.getByText('x.org')).toBeTruthy();
    expect(screen.queryByText('Ubuntu')).toBeNull();
  });

  it('expands and collapses a folder', async () => {
    await setup();
    await fireEvent.press(screen.getByText('Linux'));
    expect(screen.getByText('Ubuntu')).toBeTruthy();
    expect(screen.getByText('Ubuntu Releases')).toBeTruthy();
    expect(screen.getByText('Sub')).toBeTruthy();
    await fireEvent.press(screen.getByText('Linux'));
    expect(screen.queryByText('Ubuntu')).toBeNull();
  });

  it('opens a feed with its encoded path', async () => {
    await setup();
    await fireEvent.press(screen.getByText('Linux'));
    await fireEvent.press(screen.getByText('Ubuntu'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/rss/feed',
      params: { path: encodeURIComponent('Linux\\Ubuntu') },
    });
  });

  it('pull-to-refresh calls refresh', async () => {
    await setup();
    const [control] = screen.container.queryAll((n) => typeof n.props.onRefresh === 'function');
    await act(async () => {
      control.props.onRefresh();
    });
    await waitFor(() => expect(api.refresh).toHaveBeenCalled());
  });
});

describe('RssFeedsScreen — header actions', () => {
  it('adds a root feed', async () => {
    await setup();
    await fireEvent.press(screen.getByText('screens.rss.addFeed'));
    expect(screen.getByText('screens.rss.addFeedPrompt')).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText('screens.rss.addFeedPlaceholder'), 'https://a/b');
    await fireEvent.press(screen.getByText('common.confirm'));
    await waitFor(() => expect(api.addFeed).toHaveBeenCalledWith('https://a/b', ''));
    expect(mockShowToast).toHaveBeenCalledWith('screens.rss.feedAddedToast', 'success');
  });

  it('adds a root folder and toasts a failure', async () => {
    await setup({ addFolder: jest.fn().mockRejectedValue(new Error('exists')) });
    await fireEvent.press(screen.getByText('screens.rss.addFolder'));
    await fireEvent.changeText(screen.getByPlaceholderText('screens.rss.addFolderPlaceholder'), 'TV');
    await fireEvent.press(screen.getByText('common.confirm'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('exists', 'error'));
    expect(api.addFolder).toHaveBeenCalledWith('TV');
  });

  it('adds a root folder successfully, and cancels the prompt', async () => {
    await setup();
    await fireEvent.press(screen.getByText('screens.rss.addFolder'));
    await fireEvent.press(screen.getByText('common.cancel'));
    expect(screen.queryByText('screens.rss.addFolderPrompt')).toBeNull();
    await fireEvent.press(screen.getByText('screens.rss.addFolder'));
    await fireEvent.changeText(screen.getByPlaceholderText('screens.rss.addFolderPlaceholder'), 'TV');
    await fireEvent.press(screen.getByText('common.confirm'));
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('screens.rss.folderAddedToast', 'success'),
    );
  });

  it('refreshes every feed and reports success', async () => {
    await setup();
    await fireEvent.press(screen.getByText('screens.rss.refreshAll'));
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('screens.rss.allFeedsRefreshedToast', 'success'),
    );
    expect(api.refreshItem.mock.calls.map((c) => c[0])).toEqual([
      'Linux\\Ubuntu',
      'https://news.example/feed',
      'Broken',
    ]);
    expect(api.refresh).toHaveBeenCalled();
  });

  it('reports the first failure when refreshing all', async () => {
    await setup({
      refreshItem: jest.fn().mockResolvedValueOnce(undefined).mockRejectedValue(new Error('timeout')),
    });
    await fireEvent.press(screen.getByText('screens.rss.refreshAll'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('timeout', 'error'));
  });

  it('does nothing when refreshing all with no feeds', async () => {
    await setup({ feeds: [] });
    await fireEvent.press(screen.getByText('screens.rss.refreshAll'));
    expect(api.refresh).not.toHaveBeenCalled();
  });
});

describe('RssFeedsScreen — folder menu', () => {
  it('creates a subfolder and expands the parent', async () => {
    await setup();
    await menu('Linux', 'screens.rss.newSubfolder');
    await fireEvent.changeText(screen.getByPlaceholderText('screens.rss.addFolderPlaceholder'), 'Arch');
    await fireEvent.press(screen.getByText('common.confirm'));
    await waitFor(() => expect(api.addFolder).toHaveBeenCalledWith('Linux\\Arch'));
    expect(screen.getByText('Ubuntu')).toBeTruthy();
  });

  it('adds a feed inside a folder', async () => {
    await setup();
    await fireEvent(screen.getAllByText('Linux')[0], 'longPress', {
      nativeEvent: { pageX: 0, pageY: 0 },
    });
    await fireEvent.press(screen.getByText('screens.rss.addFeedHere'));
    await menuDelay();
    await fireEvent.changeText(screen.getByPlaceholderText('screens.rss.addFeedPlaceholder'), 'u');
    await fireEvent.press(screen.getByText('common.confirm'));
    await waitFor(() => expect(api.addFeed).toHaveBeenCalledWith('u', 'Linux'));
  });

  it('renames a nested folder under its parent', async () => {
    await setup();
    await fireEvent.press(screen.getByText('Linux'));
    await menu('Sub', 'screens.rss.rename');
    expect(screen.getByDisplayValue('Sub')).toBeTruthy();
    await submitInput('Distros');
    await waitFor(() => expect(api.moveItem).toHaveBeenCalledWith('Linux\\Sub', 'Linux\\Distros'));
    expect(mockShowToast).toHaveBeenCalledWith('screens.rss.itemRenamedToast', 'success');
  });

  it('moves a folder, excluding itself and its descendants from the targets', async () => {
    await setup({ folders: ['Linux', 'Linux\\Sub', 'Other'] });
    await menu('Linux', 'screens.rss.move');
    expect(screen.getByText('screens.rss.moveTitle')).toBeTruthy();
    expect(screen.queryByLabelText('Linux\\Sub')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Other'));
    await waitFor(() => expect(api.moveItem).toHaveBeenCalledWith('Linux', 'Other\\Linux'));
    expect(mockShowToast).toHaveBeenCalledWith('screens.rss.itemMovedToast', 'success');
  });

  it('deletes a folder after confirmation', async () => {
    await setup();
    await menu('Linux', 'common.delete');
    expect(screen.getByText('alerts.deleteFolder')).toBeTruthy();
    await fireEvent.press(screen.getAllByText('common.delete').slice(-1)[0]);
    await waitFor(() => expect(api.removeItem).toHaveBeenCalledWith('Linux'));
    expect(mockShowToast).toHaveBeenCalledWith('screens.rss.itemRemovedToast', 'success');
  });

  it('cancels a delete', async () => {
    await setup();
    await menu('Linux', 'common.delete');
    await fireEvent.press(screen.getByText('common.cancel'));
    expect(api.removeItem).not.toHaveBeenCalled();
  });
});

describe('RssFeedsScreen — feed menu', () => {
  it('refreshes one feed', async () => {
    await setup();
    await menu('News', 'screens.rss.refresh');
    await waitFor(() => expect(api.refreshItem).toHaveBeenCalledWith('https://news.example/feed'));
    expect(mockShowToast).toHaveBeenCalledWith('screens.rss.feedRefreshedToast', 'success');
  });

  it('toasts a failed refresh', async () => {
    await setup({ refreshItem: jest.fn().mockRejectedValue(new Error('down')) });
    await menu('News', 'screens.rss.refresh');
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('down', 'error'));
  });

  it('copies the feed URL', async () => {
    await setup();
    await menu('Broken', 'screens.rss.copyLink');
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith('not a url'));
    expect(mockShowToast).toHaveBeenCalledWith('screens.rss.linkCopiedToast', 'success');
  });

  it('ignores copy for a feed missing from the feed list, and a clipboard failure', async () => {
    await setup();
    await menu('Loading', 'screens.rss.copyLink');
    await new Promise((r) => setTimeout(r, 200));
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
    jest.mocked(Clipboard.setStringAsync).mockRejectedValueOnce(new Error('x'));
    await menu('News', 'screens.rss.copyLink');
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalled());
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it('marks a feed read, and toasts a failure', async () => {
    await setup();
    await menu('News', 'screens.rss.markAllRead');
    await waitFor(() => expect(api.markAsRead).toHaveBeenCalledWith('https://news.example/feed'));
    api.markAsRead.mockRejectedValueOnce(new Error('nope'));
    await menu('News', 'screens.rss.markAllRead');
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('nope', 'error'));
  });

  it('renames a root feed and toasts a failed rename', async () => {
    await setup({ moveItem: jest.fn().mockRejectedValue(new Error('taken')) });
    await menu('Broken', 'screens.rss.rename');
    await submitInput('Fixed');
    await waitFor(() => expect(api.moveItem).toHaveBeenCalledWith('Broken', 'Fixed'));
    expect(mockShowToast).toHaveBeenCalledWith('taken', 'error');
  });

  it('moves a feed into a folder and expands it; moving to its own folder is a no-op', async () => {
    await setup();
    await menu('Broken', 'screens.rss.move');
    await fireEvent.press(screen.getByLabelText('screens.rss.moveToRoot'));
    expect(api.moveItem).not.toHaveBeenCalled();
    await menu('Broken', 'screens.rss.move');
    await fireEvent.press(screen.getByLabelText('Linux'));
    await waitFor(() => expect(api.moveItem).toHaveBeenCalledWith('Broken', 'Linux\\Broken'));
    expect(screen.getByText('Ubuntu')).toBeTruthy();
  });

  it('toasts a failed move and a failed delete', async () => {
    await setup({
      moveItem: jest.fn().mockRejectedValue(new Error('move failed')),
      removeItem: jest.fn().mockRejectedValue(new Error('remove failed')),
    });
    await menu('News', 'screens.rss.move');
    await fireEvent.press(screen.getByLabelText('Linux'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('move failed', 'error'));
    await menu('News', 'common.delete');
    expect(screen.getByText('alerts.deleteFeed')).toBeTruthy();
    await fireEvent.press(screen.getAllByText('common.delete').slice(-1)[0]);
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('remove failed', 'error'));
  });

  it('closes the move picker without moving', async () => {
    await setup();
    await menu('News', 'screens.rss.move');
    await fireEvent.press(screen.getByLabelText('common.close'));
    expect(screen.queryByText('screens.rss.moveTitle')).toBeNull();
  });
});

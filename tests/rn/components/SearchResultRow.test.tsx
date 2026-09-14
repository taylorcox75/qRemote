import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { SearchResultRow } from '@/components/SearchResultRow';
import { SearchResult } from '@/types/api';
import { useShell } from '@/context/ShellContext';
import { formatSize } from '@/utils/format';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('@/context/ShellContext', () => ({ useShell: jest.fn() }));

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

const result: SearchResult = {
  fileName: 'Ubuntu 24.04 ISO',
  fileSize: 1024 * 1024 * 1024,
  fileUrl: 'https://example.com/ubuntu.torrent',
  nbLeechers: 3,
  nbSeeders: 42,
  siteUrl: 'https://example.com',
  descrLink: 'https://example.com/desc',
};

function mockShell(idiom: 'compact' | 'regular' | 'mac') {
  jest.mocked(useShell).mockReturnValue({
    idiom,
    selectedHash: null,
    setSelectedHash: jest.fn(),
    listFilter: { status: 'all', category: null, tags: [], tracker: null },
    setListFilter: jest.fn(),
    sidebarCollapsed: false,
    toggleSidebar: jest.fn(),
  } as unknown as ReturnType<typeof useShell>);
}

describe('SearchResultRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShell('compact');
  });

  it('renders the filename and size on compact', async () => {
    await render(<SearchResultRow result={result} onAdd={jest.fn()} />);
    expect(screen.getByText('Ubuntu 24.04 ISO')).toBeTruthy();
    expect(screen.getByText(new RegExp(formatSize(result.fileSize)))).toBeTruthy();
  });

  it('calls onAdd when the add button is pressed', async () => {
    const onAdd = jest.fn();
    await render(<SearchResultRow result={result} onAdd={onAdd} />);
    fireEvent.press(screen.getByLabelText('screens.search.addToQueue'));
    expect(onAdd).toHaveBeenCalledWith(result);
  });

  it('calls onToggleCart when the cart button is pressed', async () => {
    const onToggleCart = jest.fn();
    await render(<SearchResultRow result={result} onAdd={jest.fn()} onToggleCart={onToggleCart} />);
    fireEvent.press(screen.getByLabelText('screens.search.addToCart'));
    expect(onToggleCart).toHaveBeenCalledWith(result);
  });

  it('uses a surface card on compact', async () => {
    const { toJSON } = await render(<SearchResultRow result={result} onAdd={jest.fn()} />);
    expect(JSON.stringify(toJSON())).toContain('marginHorizontal');
  });

  it('uses a hairline row on mac', async () => {
    mockShell('mac');
    const { toJSON } = await render(<SearchResultRow result={result} onAdd={jest.fn()} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('borderBottomWidth');
    expect(tree).not.toContain('marginHorizontal');
  });
});

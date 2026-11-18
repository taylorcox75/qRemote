// AppearanceSettingsScreen.test.tsx — Settings → Appearance
// (app/(tabs)/settings/appearance.tsx): language, card view, solid header,
// Liquid Glass, recent-search limit, default Search sort and refresh interval,
// each read from and written to the app's stored preferences.
import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react-native';
import AppearanceSettingsScreen from '@/app/(tabs)/settings/appearance';
import { routerMock, resetSharedMocks } from './helpers';

jest.mock('expo-router', () => require('./helpers').expoRouterMock);
jest.mock('@/context/ThemeContext', () => require('./helpers').themeContextMock);
jest.mock('@/components/FocusAwareStatusBar', () => require('./helpers').statusBarMock);
jest.mock('@/components/OptionPicker', () => require('./helpers').optionPickerMock);

const mockI18n = { language: 'en', changeLanguage: jest.fn() };
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: require('./helpers').mockT, i18n: mockI18n }),
}));
const mockSetStoredLanguage = jest.fn();
jest.mock('@/i18n', () => ({ setStoredLanguage: (l: string) => mockSetStoredLanguage(l) }));

const mockGlass = { available: true, preference: false, setPreference: jest.fn() };
jest.mock('@/context/LiquidGlassContext', () => ({
  useLiquidGlass: () => ({ ...mockGlass, enabled: false }),
  useGlassStackTopInset: () => undefined,
}));

let mockLocalPrefs: Record<string, unknown> = {};
const mockGetPreferences = jest.fn();
const mockSavePreferences = jest.fn();
const mockUpdatePreferences = jest.fn();
jest.mock('@/services/storage', () => ({
  storageService: {
    getPreferences: () => mockGetPreferences(),
    savePreferences: (p: Record<string, unknown>) => mockSavePreferences(p),
    updatePreferences: (p: Record<string, unknown>) => mockUpdatePreferences(p),
  },
}));

const S = (k: string) => `screens.settings.${k}`;

function switchFor(label: string) {
  let node = screen.getByText(label).parent;
  while (node) {
    const found = within(node).queryAllByRole('switch');
    if (found.length === 1) return found[0];
    if (found.length > 1) break;
    node = node.parent;
  }
  throw new Error(`No single switch found for ${label}`);
}

async function renderScreen() {
  await render(<AppearanceSettingsScreen />);
  await waitFor(() => expect(mockGetPreferences).toHaveBeenCalled());
}

beforeEach(() => {
  resetSharedMocks();
  mockI18n.language = 'en';
  mockI18n.changeLanguage.mockReset().mockResolvedValue(undefined);
  mockSetStoredLanguage.mockReset().mockResolvedValue(undefined);
  mockGlass.available = true;
  mockGlass.preference = false;
  mockGlass.setPreference.mockReset().mockResolvedValue(undefined);
  mockLocalPrefs = {};
  mockGetPreferences.mockReset().mockImplementation(async () => ({ ...mockLocalPrefs }));
  mockSavePreferences.mockReset().mockImplementation(async (p: Record<string, unknown>) => {
    mockLocalPrefs = { ...p };
  });
  mockUpdatePreferences.mockReset().mockResolvedValue(undefined);
});

describe('AppearanceSettingsScreen', () => {
  it('loads defaults for a fresh install', async () => {
    await renderScreen();
    expect(await screen.findByDisplayValue('1000')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('screens.search.sortSeeders')).toBeTruthy();
    expect(switchFor(S('detailedCardView')).props.value).toBe(false);
    expect(switchFor(S('solidPinnedHeader')).props.value).toBe(false);
  });

  it('loads stored values', async () => {
    mockLocalPrefs = {
      autoRefreshInterval: 3000,
      cardViewMode: 'expanded',
      solidPinnedHeader: true,
      torrentSearchHistoryLimit: 0,
      searchDefaultSort: 'quality',
    };
    mockI18n.language = 'zh-Hans';
    await renderScreen();
    expect(await screen.findByDisplayValue('3000')).toBeTruthy();
    expect(screen.getByText('中文')).toBeTruthy();
    expect(screen.getByText('screens.torrents.recentSearchesOff')).toBeTruthy();
    expect(screen.getByText('screens.search.sortQuality')).toBeTruthy();
    expect(switchFor(S('detailedCardView')).props.value).toBe(true);
    expect(switchFor(S('solidPinnedHeader')).props.value).toBe(true);
  });

  it('falls back to seeders for a sort key the picker does not offer', async () => {
    mockLocalPrefs = { searchDefaultSort: 'date' };
    await renderScreen();
    expect(await screen.findByText('screens.search.sortSeeders')).toBeTruthy();
  });

  it('falls back to defaults when preferences cannot be read', async () => {
    mockGetPreferences.mockRejectedValue(new Error('x'));
    await renderScreen();
    expect(screen.getByDisplayValue('1000')).toBeTruthy();
  });

  it('falls back to English when no language is set', async () => {
    mockI18n.language = '';
    await renderScreen();
    expect(screen.getByText('English')).toBeTruthy();
  });

  it('changes and stores the language', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('English'));
    expect(screen.getByText('picker-selected:en')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('option-de'));
    await waitFor(() => expect(mockI18n.changeLanguage).toHaveBeenCalledWith('de'));
    expect(mockSetStoredLanguage).toHaveBeenCalledWith('de');
    expect(screen.queryByTestId('option-de')).toBeNull();

    await fireEvent.press(screen.getByText('English'));
    await fireEvent.press(screen.getByTestId('picker-close'));
    expect(screen.queryByTestId('picker-close')).toBeNull();
  });

  it('opens the theme, add dialogue and card fields screens', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('common.back'));
    expect(routerMock.back).toHaveBeenCalled();
    await fireEvent.press(screen.getByText(S('themeAndColors')));
    await fireEvent.press(screen.getByText(S('addTorrentDialogue')));
    await fireEvent.press(screen.getByText(S('detailedCardFields')));
    expect(routerMock.push.mock.calls.map((c) => c[0])).toEqual([
      '/settings/theme',
      '/settings/add-torrent-dialogue',
      '/settings/detailed-card-fields',
    ]);
  });

  it('saves the card view mode', async () => {
    await renderScreen();
    await fireEvent(switchFor(S('detailedCardView')), 'valueChange', true);
    await waitFor(() =>
      expect(mockSavePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ cardViewMode: 'expanded' }),
      ),
    );
    expect(switchFor(S('detailedCardView')).props.value).toBe(true);
    await fireEvent(switchFor(S('detailedCardView')), 'valueChange', false);
    await waitFor(() =>
      expect(mockSavePreferences).toHaveBeenLastCalledWith(
        expect.objectContaining({ cardViewMode: 'compact' }),
      ),
    );
  });

  it('leaves the card view unchanged when saving fails', async () => {
    await renderScreen();
    mockSavePreferences.mockRejectedValue(new Error('x'));
    await fireEvent(switchFor(S('detailedCardView')), 'valueChange', true);
    await waitFor(() => expect(mockSavePreferences).toHaveBeenCalled());
    expect(switchFor(S('detailedCardView')).props.value).toBe(false);
  });

  it('saves the solid pinned header through updatePreferences', async () => {
    await renderScreen();
    await fireEvent(switchFor(S('solidPinnedHeader')), 'valueChange', true);
    await waitFor(() =>
      expect(mockUpdatePreferences).toHaveBeenCalledWith({ solidPinnedHeader: true }),
    );
    expect(switchFor(S('solidPinnedHeader')).props.value).toBe(true);

    mockUpdatePreferences.mockRejectedValueOnce(new Error('x'));
    await fireEvent(switchFor(S('solidPinnedHeader')), 'valueChange', false);
    await waitFor(() => expect(mockUpdatePreferences).toHaveBeenCalledTimes(2));
    expect(switchFor(S('solidPinnedHeader')).props.value).toBe(true);
  });

  it('turns Liquid Glass on when the device supports it', async () => {
    await renderScreen();
    expect(screen.getByText(S('liquidGlassDescription'))).toBeTruthy();
    await fireEvent(screen.getByTestId('liquid-glass-switch'), 'valueChange', true);
    expect(mockGlass.setPreference).toHaveBeenCalledWith(true);
    mockGlass.setPreference.mockRejectedValueOnce(new Error('x'));
    await fireEvent(screen.getByTestId('liquid-glass-switch'), 'valueChange', false);
    expect(mockGlass.setPreference).toHaveBeenCalledWith(false);
  });

  it('shows Liquid Glass as unavailable and disabled on older systems', async () => {
    mockGlass.available = false;
    mockGlass.preference = true;
    await renderScreen();
    expect(screen.getByText(S('liquidGlassUnavailable'))).toBeTruthy();
    const sw = screen.getByTestId('liquid-glass-switch');
    expect(sw.props.value).toBe(false);
    expect(sw.props.disabled).toBe(true);
  });

  it('lowering the recent-search limit trims stored history', async () => {
    mockLocalPrefs = { torrentSearchHistory: ['a', 'b', 'c', 'd', 'e'] };
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('screens.torrents.recentSearches'));
    await fireEvent.press(screen.getByTestId('option-3'));
    await waitFor(() =>
      expect(mockSavePreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          torrentSearchHistoryLimit: 3,
          torrentSearchHistory: ['a', 'b', 'c'],
        }),
      ),
    );
    expect(await screen.findByText('3')).toBeTruthy();
    expect(screen.queryByTestId('option-3')).toBeNull();
  });

  it('saves the limit even with no stored history, and tolerates a failed save', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('screens.torrents.recentSearches'));
    await fireEvent.press(screen.getByTestId('option-0'));
    await waitFor(() =>
      expect(mockSavePreferences).toHaveBeenCalledWith({ torrentSearchHistoryLimit: 0 }),
    );

    mockSavePreferences.mockRejectedValueOnce(new Error('x'));
    await fireEvent.press(screen.getByLabelText('screens.torrents.recentSearches'));
    await fireEvent.press(screen.getByTestId('option-15'));
    await waitFor(() => expect(mockSavePreferences).toHaveBeenCalledTimes(2));
    expect(screen.getByText('screens.torrents.recentSearchesOff')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('screens.torrents.recentSearches'));
    await fireEvent.press(screen.getByTestId('picker-close'));
    expect(screen.queryByTestId('picker-close')).toBeNull();
  });

  it('saves the default search sort', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('screens.search.defaultSort'));
    expect(screen.queryByTestId('option-date')).toBeNull();
    await fireEvent.press(screen.getByTestId('option-relevance'));
    await waitFor(() =>
      expect(mockUpdatePreferences).toHaveBeenCalledWith({ searchDefaultSort: 'relevance' }),
    );
    expect(await screen.findByText('screens.search.sortRelevance')).toBeTruthy();

    mockUpdatePreferences.mockRejectedValueOnce(new Error('x'));
    await fireEvent.press(screen.getByLabelText('screens.search.defaultSort'));
    await fireEvent.press(screen.getByTestId('option-size'));
    await waitFor(() => expect(mockUpdatePreferences).toHaveBeenCalledTimes(2));
    expect(screen.getByText('screens.search.sortRelevance')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('screens.search.defaultSort'));
    await fireEvent.press(screen.getByTestId('picker-close'));
    expect(screen.queryByTestId('picker-close')).toBeNull();
  });

  it('saves the refresh interval on blur, ignoring a failed write', async () => {
    await renderScreen();
    const input = await screen.findByDisplayValue('1000');
    await fireEvent.changeText(input, '2500');
    await fireEvent(input, 'blur');
    await waitFor(() =>
      expect(mockSavePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ autoRefreshInterval: 2500 }),
      ),
    );
    mockSavePreferences.mockRejectedValueOnce(new Error('x'));
    await fireEvent(input, 'blur');
    await waitFor(() => expect(mockSavePreferences).toHaveBeenCalledTimes(2));
  });
});

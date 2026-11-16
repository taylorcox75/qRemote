// RssRuleEditorScreen.test.tsx — Settings → RSS → Rules → rule editor
// (app/(tabs)/settings/rss-rule.tsx): creating a rule, editing and renaming
// an existing one, and the rule definition handed to rss/setRule.
import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RssRuleEditorScreen from '@/app/(tabs)/settings/rss-rule';
import type { RssRule } from '@/types/api';
import { routerMock, toastMock, expoRouterMock, resetSharedMocks } from './helpers';

jest.mock('expo-router', () => require('./helpers').expoRouterMock);
jest.mock('react-i18next', () => require('./helpers').i18nMock);
jest.mock('@/context/ThemeContext', () => require('./helpers').themeContextMock);
jest.mock('@/context/ToastContext', () => require('./helpers').toastContextMock);
jest.mock('@/components/FocusAwareStatusBar', () => require('./helpers').statusBarMock);
jest.mock('@/components/OptionPicker', () => require('./helpers').optionPickerMock);
jest.mock('@/components/MultiSelectPicker', () => require('./helpers').multiSelectPickerMock);
jest.mock('@/components/PathAutocompleteInput', () => require('./helpers').pathAutocompleteMock);

const mockServer = { isConnected: true };
jest.mock('@/context/ServerContext', () => ({ useServer: () => mockServer }));

const mockRules = {
  rules: {} as Record<string, RssRule>,
  setRule: jest.fn(),
  renameRule: jest.fn(),
};
jest.mock('@/hooks/useRssRules', () => ({ useRssRules: () => mockRules }));
const mockFeeds = {
  feeds: [
    { path: 'News', feed: { url: 'https://a.test/rss', title: 'A' } },
    { path: 'https://b.test/rss', feed: { url: 'https://b.test/rss', title: 'B Feed' } },
  ],
};
jest.mock('@/hooks/useRssFeeds', () => ({ useRssFeeds: () => mockFeeds }));
const mockGetAllCategories = jest.fn();
jest.mock('@/services/api/categories', () => ({
  categoriesApi: { getAllCategories: () => mockGetAllCategories() },
}));

const R = (k: string) => `screens.rss.${k}`;

const EXISTING: RssRule = {
  enabled: false,
  mustContain: 'linux',
  mustNotContain: 'beta',
  useRegex: true,
  episodeFilter: '1x01-;',
  smartFilter: true,
  previouslyMatchedEpisodes: ['S01E01'],
  affectedFeeds: ['https://a.test/rss'],
  ignoreDays: 3,
  lastMatch: '2026-01-01',
  addPaused: true,
  assignedCategory: 'Linux',
  savePath: '/iso',
  torrentContentLayout: 'Subfolder',
  priority: 2,
} as RssRule;

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

async function renderScreen(params: Record<string, unknown> = {}) {
  expoRouterMock.useLocalSearchParams.mockReturnValue(params);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <RssRuleEditorScreen />
    </QueryClientProvider>,
  );
}

const save = () => fireEvent.press(screen.getByLabelText('common.save'));

beforeEach(() => {
  resetSharedMocks();
  mockServer.isConnected = true;
  mockRules.rules = {};
  mockRules.setRule.mockReset().mockResolvedValue(undefined);
  mockRules.renameRule.mockReset().mockResolvedValue(undefined);
  mockGetAllCategories.mockReset().mockResolvedValue({ Movies: {}, Linux: {} });
});

describe('RssRuleEditorScreen — new rule', () => {
  it('starts empty with defaults', async () => {
    await renderScreen();
    expect(screen.getByText(R('addRule'))).toBeTruthy();
    expect(screen.getByPlaceholderText(R('ruleNamePlaceholder')).props.value).toBe('');
    expect(switchFor(R('enabled')).props.value).toBe(true);
    expect(screen.getAllByText('common.none').length).toBe(2);
    expect(screen.getByText(R('addPausedDefault'))).toBeTruthy();
    expect(screen.getByText(R('noCategoryOption'))).toBeTruthy();
  });

  it('requires a rule name', async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText(R('ruleNamePlaceholder')), '   ');
    await save();
    expect(toastMock.showToast).toHaveBeenCalledWith(R('ruleNameRequiredError'), 'error');
    expect(mockRules.setRule).not.toHaveBeenCalled();
  });

  it('saves every field the editor exposes', async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText(R('ruleNamePlaceholder')), ' Ubuntu ');
    await fireEvent(switchFor(R('enabled')), 'valueChange', false);
    await fireEvent(switchFor(R('useRegex')), 'valueChange', true);
    await fireEvent(switchFor(R('smartFilter')), 'valueChange', true);

    const inputs = screen.getAllByDisplayValue('');
    // must contain, must not contain, episode filter, save path (name is filled).
    await fireEvent.changeText(inputs[0], 'ubuntu');
    await fireEvent.changeText(inputs[1], 'server');
    await fireEvent.changeText(inputs[2], '1x01-;');
    await fireEvent.changeText(inputs[3], '/linux');
    await fireEvent.changeText(screen.getByDisplayValue('0'), '7');

    // Affected feeds: pick both, shown by display name.
    await fireEvent.press(screen.getAllByText('common.none')[0]);
    expect(screen.getByText('multi:News')).toBeTruthy();
    expect(screen.getByText('multi:B Feed')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('multi-https://a.test/rss'));
    await fireEvent.press(screen.getByTestId('multi-https://b.test/rss'));
    await fireEvent.press(screen.getByTestId('multi-close'));
    expect(screen.getByText('screens.addTorrent.selectedCount:2')).toBeTruthy();

    await fireEvent.press(screen.getByText(R('addPausedDefault')));
    await fireEvent.press(screen.getByTestId('option-no'));
    await fireEvent.press(screen.getByTestId('picker-close'));
    expect(screen.getByText(R('addPausedNo'))).toBeTruthy();

    await fireEvent.press(screen.getByText(R('noCategoryOption')));
    // Categories come sorted after the "no category" option.
    const labels = screen.getAllByText(/^option:/).map((n) => n.props.children);
    expect(labels).toEqual([`option:${R('noCategoryOption')}`, 'option:Linux', 'option:Movies']);
    await fireEvent.press(screen.getByTestId('option-Linux'));
    await fireEvent.press(screen.getByTestId('picker-close'));

    await fireEvent.press(screen.getByText('common.none'));
    await fireEvent.press(screen.getByTestId('option-NoSubfolder'));
    await fireEvent.press(screen.getByTestId('picker-close'));
    expect(screen.getByText(R('contentLayoutNoSubfolder'))).toBeTruthy();

    await save();
    await waitFor(() => expect(mockRules.setRule).toHaveBeenCalled());
    expect(mockRules.renameRule).not.toHaveBeenCalled();
    expect(mockRules.setRule).toHaveBeenCalledWith('Ubuntu', {
      enabled: false,
      mustContain: 'ubuntu',
      mustNotContain: 'server',
      useRegex: true,
      episodeFilter: '1x01-;',
      smartFilter: true,
      previouslyMatchedEpisodes: [],
      affectedFeeds: ['https://a.test/rss', 'https://b.test/rss'],
      ignoreDays: 7,
      lastMatch: '',
      addPaused: false,
      assignedCategory: 'Linux',
      savePath: '/linux',
      torrentContentLayout: 'NoSubfolder',
    });
    expect(toastMock.showToast).toHaveBeenCalledWith(R('ruleSavedToast'), 'success');
    expect(routerMock.back).toHaveBeenCalled();
  });

  it('sends 0 ignore-days for non-numeric input and null for default add-paused', async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText(R('ruleNamePlaceholder')), 'R');
    await fireEvent.changeText(screen.getByDisplayValue('0'), 'abc');
    await fireEvent.press(screen.getByText(R('addPausedDefault')));
    await fireEvent.press(screen.getByTestId('option-yes'));
    await fireEvent.press(screen.getByTestId('option-default'));
    await save();
    await waitFor(() => expect(mockRules.setRule).toHaveBeenCalled());
    expect(mockRules.setRule.mock.calls[0][1]).toEqual(
      expect.objectContaining({ ignoreDays: 0, addPaused: null, torrentContentLayout: null }),
    );
  });

  it('shows the save error and stays on the screen', async () => {
    mockRules.setRule.mockRejectedValue(new Error('Rule rejected'));
    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText(R('ruleNamePlaceholder')), 'R');
    await save();
    await waitFor(() => expect(toastMock.showToast).toHaveBeenCalledWith('Rule rejected', 'error'));
    expect(routerMock.back).not.toHaveBeenCalled();
    expect(screen.getByLabelText('common.save')).toBeTruthy();
  });

  it('does not fetch categories while offline', async () => {
    mockServer.isConnected = false;
    await renderScreen();
    await fireEvent.press(screen.getByText(R('noCategoryOption')));
    expect(screen.getAllByText(/^option:/)).toHaveLength(1);
    expect(mockGetAllCategories).not.toHaveBeenCalled();
  });

  it('goes back without saving', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('common.back'));
    expect(routerMock.back).toHaveBeenCalled();
    expect(mockRules.setRule).not.toHaveBeenCalled();
  });
});

describe('RssRuleEditorScreen — existing rule', () => {
  beforeEach(() => {
    mockRules.rules = { Distros: EXISTING };
  });

  it('fills the form from the stored rule', async () => {
    await renderScreen({ name: 'Distros' });
    expect(screen.getByText('Distros')).toBeTruthy();
    expect(screen.getByDisplayValue('linux')).toBeTruthy();
    expect(screen.getByDisplayValue('beta')).toBeTruthy();
    expect(screen.getByDisplayValue('3')).toBeTruthy();
    expect(screen.getByDisplayValue('/iso')).toBeTruthy();
    expect(switchFor(R('enabled')).props.value).toBe(false);
    expect(screen.getByText(R('addPausedYes'))).toBeTruthy();
    expect(screen.getByText('screens.addTorrent.selectedCount:1')).toBeTruthy();
    expect(screen.getByText(R('contentLayoutSubfolder'))).toBeTruthy();
    expect(await screen.findByText('Linux')).toBeTruthy();
  });

  it('saves in place, keeping fields the editor does not show', async () => {
    await renderScreen({ name: 'Distros' });
    await fireEvent.changeText(screen.getByDisplayValue('linux'), 'debian');
    await save();
    await waitFor(() => expect(mockRules.setRule).toHaveBeenCalled());
    expect(mockRules.renameRule).not.toHaveBeenCalled();
    expect(mockRules.setRule).toHaveBeenCalledWith(
      'Distros',
      expect.objectContaining({
        mustContain: 'debian',
        priority: 2,
        previouslyMatchedEpisodes: ['S01E01'],
        lastMatch: '2026-01-01',
        addPaused: true,
      }),
    );
  });

  it('renames before saving when the name changes', async () => {
    await renderScreen({ name: 'Distros' });
    await fireEvent.changeText(screen.getByDisplayValue('Distros'), 'Linux ISOs');
    await save();
    await waitFor(() => expect(mockRules.setRule).toHaveBeenCalled());
    expect(mockRules.renameRule).toHaveBeenCalledWith('Distros', 'Linux ISOs');
    expect(mockRules.renameRule.mock.invocationCallOrder[0]).toBeLessThan(
      mockRules.setRule.mock.invocationCallOrder[0],
    );
    expect(mockRules.setRule.mock.calls[0][0]).toBe('Linux ISOs');
  });

  it('reports a failed rename without saving the rule', async () => {
    mockRules.renameRule.mockRejectedValue(new Error('Rename failed'));
    await renderScreen({ name: 'Distros' });
    await fireEvent.changeText(screen.getByDisplayValue('Distros'), 'Other');
    await save();
    await waitFor(() => expect(toastMock.showToast).toHaveBeenCalledWith('Rename failed', 'error'));
    expect(mockRules.setRule).not.toHaveBeenCalled();
  });

  it('starts from defaults when the named rule is not loaded', async () => {
    mockRules.rules = {};
    await renderScreen({ name: 'Missing' });
    expect(screen.getByText('Missing')).toBeTruthy();
    expect(switchFor(R('enabled')).props.value).toBe(true);
  });
});

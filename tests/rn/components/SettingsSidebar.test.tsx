import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { SettingsSidebar } from '@/components/shell/SettingsSidebar';
import { useShell } from '@/context/ShellContext';
import { useRouter, usePathname } from 'expo-router';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock('@/context/ShellContext', () => ({ useShell: jest.fn() }));

describe('SettingsSidebar', () => {
  const navigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useRouter).mockReturnValue({ navigate } as unknown as ReturnType<typeof useRouter>);
    jest.mocked(usePathname).mockReturnValue('/settings');
    jest.mocked(useShell).mockReturnValue({
      idiom: 'mac',
      selectedHash: null,
      setSelectedHash: jest.fn(),
      listFilter: { status: 'all', category: null, tags: [], tracker: null },
      setListFilter: jest.fn(),
      sidebarCollapsed: false,
      toggleSidebar: jest.fn(),
    } as unknown as ReturnType<typeof useShell>);
  });

  it('renders settings categories', async () => {
    await render(<SettingsSidebar />);
    expect(screen.getByText('screens.settings.title')).toBeTruthy();
    expect(screen.getByText('screens.settings.appearance')).toBeTruthy();
    expect(screen.getByText('screens.settings.servers')).toBeTruthy();
  });

  it('navigates to appearance', async () => {
    await render(<SettingsSidebar />);
    fireEvent.press(screen.getByText('screens.settings.appearance'));
    expect(navigate).toHaveBeenCalledWith('/settings/appearance');
  });
});

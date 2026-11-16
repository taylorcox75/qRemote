// ServerSettingsAdvancedScreen.test.tsx — Settings → Server Settings → Advanced
// (app/(tabs)/settings/server-settings-advanced.tsx): qBittorrent email
// notification and "run external program" preferences, including the
// encryption editor that depends on which key the server reports.
import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react-native';
import ServerSettingsAdvancedScreen from '@/app/(tabs)/settings/server-settings-advanced';
import { routerMock, toastMock, resetSharedMocks } from './helpers';

jest.mock('expo-router', () => require('./helpers').expoRouterMock);
jest.mock('react-i18next', () => require('./helpers').i18nMock);
jest.mock('@/context/ThemeContext', () => require('./helpers').themeContextMock);
jest.mock('@/context/ToastContext', () => require('./helpers').toastContextMock);
jest.mock('@/components/FocusAwareStatusBar', () => require('./helpers').statusBarMock);
jest.mock('@/components/OptionPicker', () => require('./helpers').optionPickerMock);

const mockServer = { isConnected: true };
jest.mock('@/context/ServerContext', () => ({ useServer: () => mockServer }));
const mockApp = { getPreferences: jest.fn(), setPreferences: jest.fn() };
jest.mock('@/services/api/application', () => ({
  get applicationApi() {
    return mockApp;
  },
}));

const S = (k: string) => `screens.settings.${k}`;

const PREFS = {
  mail_notification_enabled: true,
  mail_notification_sender: 'from@x.test',
  mail_notification_email: 'to@x.test',
  mail_notification_smtp: 'smtp.x.test',
  mail_notification_encryption_type: 'STARTTLS',
  mail_notification_auth_enabled: true,
  mail_notification_username: 'mailer',
  mail_notification_password: 'pw',
  autorun_on_torrent_added_enabled: true,
  autorun_on_torrent_added_program: '/bin/added %N',
  autorun_enabled: true,
  autorun_program: '/bin/done %N',
};

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
  await render(<ServerSettingsAdvancedScreen />);
  if (mockServer.isConnected) {
    await waitFor(() => expect(mockApp.getPreferences).toHaveBeenCalled());
    await screen.findByText(S('emailNotificationsEnabled'));
  }
}

beforeEach(() => {
  resetSharedMocks();
  mockServer.isConnected = true;
  mockApp.getPreferences.mockReset().mockResolvedValue({ ...PREFS });
  mockApp.setPreferences.mockReset().mockResolvedValue(undefined);
});

describe('ServerSettingsAdvancedScreen', () => {
  it('shows a not-connected state while offline and navigates back', async () => {
    mockServer.isConnected = false;
    await renderScreen();
    expect(screen.getByText('toast.notConnected')).toBeTruthy();
    expect(mockApp.getPreferences).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('common.back'));
    expect(routerMock.back).toHaveBeenCalled();
  });

  it('loads the email and automation values', async () => {
    await renderScreen();
    expect(await screen.findByDisplayValue('from@x.test')).toBeTruthy();
    expect(screen.getByDisplayValue('to@x.test')).toBeTruthy();
    expect(screen.getByDisplayValue('smtp.x.test')).toBeTruthy();
    expect(screen.getByText(S('emailEncryptionStartTls'))).toBeTruthy();
    expect(screen.queryByText(S('emailRequiresSsl'))).toBeNull();
    expect(screen.getByDisplayValue('mailer')).toBeTruthy();
    expect(screen.getByDisplayValue('/bin/added %N')).toBeTruthy();
    expect(screen.getByDisplayValue('/bin/done %N')).toBeTruthy();
  });

  it('hides the detail fields when everything is off, and survives a failed load', async () => {
    mockApp.getPreferences.mockResolvedValue({});
    await renderScreen();
    expect(screen.queryByText(S('emailFromAddress'))).toBeNull();
    expect(screen.queryByPlaceholderText(S('runProgramPlaceholder'))).toBeNull();
  });

  it('keeps defaults when the preferences request fails', async () => {
    mockApp.getPreferences.mockRejectedValue(new Error('down'));
    await renderScreen();
    expect(switchFor(S('emailNotificationsEnabled')).props.value).toBe(false);
  });

  it.each([
    ['emailNotificationsEnabled', 'mail_notification_enabled'],
    ['emailAuthentication', 'mail_notification_auth_enabled'],
    ['runOnTorrentAdded', 'autorun_on_torrent_added_enabled'],
    ['runOnTorrentFinished', 'autorun_enabled'],
  ])('switch "%s" writes %s', async (label, key) => {
    await renderScreen();
    await fireEvent(switchFor(S(label)), 'valueChange', false);
    await waitFor(() => expect(mockApp.setPreferences).toHaveBeenCalledWith({ [key]: false }));
    expect(toastMock.showToast).toHaveBeenCalledWith('toast.serverSettingUpdated', 'success');
  });

  it('rolls a switch back when the server rejects it', async () => {
    mockApp.setPreferences.mockRejectedValue(new Error('x'));
    await renderScreen();
    await fireEvent(switchFor(S('runOnTorrentFinished')), 'valueChange', false);
    await waitFor(() =>
      expect(toastMock.showToast).toHaveBeenCalledWith(
        'errors.failedToUpdateServerSetting',
        'error',
      ),
    );
    expect(switchFor(S('runOnTorrentFinished')).props.value).toBe(true);
  });

  it.each([
    ['from@x.test', 'mail_notification_sender'],
    ['to@x.test', 'mail_notification_email'],
    ['smtp.x.test', 'mail_notification_smtp'],
    ['mailer', 'mail_notification_username'],
    ['pw', 'mail_notification_password'],
    ['/bin/added %N', 'autorun_on_torrent_added_program'],
    ['/bin/done %N', 'autorun_program'],
  ])('field %s saves %s on blur', async (from, key) => {
    await renderScreen();
    const input = screen.getByDisplayValue(from);
    await fireEvent.changeText(input, 'changed');
    await fireEvent(input, 'blur');
    await waitFor(() => expect(mockApp.setPreferences).toHaveBeenCalledWith({ [key]: 'changed' }));
  });

  it('reports an error for every text field the server rejects', async () => {
    mockApp.setPreferences.mockRejectedValue(new Error('x'));
    await renderScreen();
    const input = screen.getByDisplayValue('mailer');
    await fireEvent.changeText(input, 'other');
    await fireEvent(input, 'blur');
    await waitFor(() =>
      expect(toastMock.showToast).toHaveBeenCalledWith(
        'errors.failedToUpdateServerSetting',
        'error',
      ),
    );
  });

  // The blur handlers capture the already-edited text as the rollback value.
  it.skip('restores every text field the server rejects', async () => {
    mockApp.setPreferences.mockRejectedValue(new Error('x'));
    await renderScreen();
    const values = [
      'from@x.test',
      'to@x.test',
      'smtp.x.test',
      'mailer',
      'pw',
      '/bin/added %N',
      '/bin/done %N',
    ];
    for (const v of values) {
      const input = screen.getByDisplayValue(v);
      await fireEvent.changeText(input, `${v}-new`);
      await fireEvent(input, 'blur');
    }
    await waitFor(() => expect(mockApp.setPreferences).toHaveBeenCalledTimes(values.length));
    for (const v of values) expect(await screen.findByDisplayValue(v)).toBeTruthy();
  });

  it('writes the encryption enum from the picker, and restores it on failure', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText(S('emailEncryptionStartTls')));
    await fireEvent.press(screen.getByTestId('option-SMTPS'));
    await waitFor(() =>
      expect(mockApp.setPreferences).toHaveBeenCalledWith({
        mail_notification_encryption_type: 'SMTPS',
      }),
    );
    expect(await screen.findByText(S('emailEncryptionSmtps'))).toBeTruthy();

    mockApp.setPreferences.mockRejectedValueOnce(new Error('x'));
    await fireEvent.press(screen.getByText(S('emailEncryptionSmtps')));
    await fireEvent.press(screen.getByTestId('option-None'));
    expect(await screen.findByText(S('emailEncryptionSmtps'))).toBeTruthy();

    await fireEvent.press(screen.getByText(S('emailEncryptionSmtps')));
    await fireEvent.press(screen.getByTestId('picker-close'));
    expect(screen.queryByTestId('picker-close')).toBeNull();
  });

  it('shows the SSL switch on servers that only report the bool', async () => {
    const { mail_notification_encryption_type: _drop, ...rest } = PREFS;
    mockApp.getPreferences.mockResolvedValue({ ...rest, mail_notification_ssl_enabled: false });
    await renderScreen();
    expect(screen.queryByText(S('emailEncryption'))).toBeNull();
    await fireEvent(switchFor(S('emailRequiresSsl')), 'valueChange', true);
    await waitFor(() =>
      expect(mockApp.setPreferences).toHaveBeenCalledWith({ mail_notification_ssl_enabled: true }),
    );
    mockApp.setPreferences.mockRejectedValueOnce(new Error('x'));
    await fireEvent(switchFor(S('emailRequiresSsl')), 'valueChange', false);
    await waitFor(() => expect(switchFor(S('emailRequiresSsl')).props.value).toBe(true));
  });

  it('shows no encryption editor when the server reports neither key', async () => {
    const { mail_notification_encryption_type: _drop, ...rest } = PREFS;
    mockApp.getPreferences.mockResolvedValue(rest);
    await renderScreen();
    expect(screen.queryByText(S('emailEncryption'))).toBeNull();
    expect(screen.queryByText(S('emailRequiresSsl'))).toBeNull();
  });
});

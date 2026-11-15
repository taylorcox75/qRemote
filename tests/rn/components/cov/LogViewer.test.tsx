import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { LogViewer } from '@/components/LogViewer';
import {
  getConnectivityLog,
  clearConnectivityLog,
  ConnectivityLogEntry,
} from '@/services/connectivity-log';

jest.mock('@/context/ThemeContext', () => require('@/tests/rn/components/cov/mocks').themeModule);
jest.mock('react-i18next', () => require('@/tests/rn/components/cov/mocks').i18nModule);
jest.mock('@/context/ToastContext', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('@/services/connectivity-log', () => ({
  getConnectivityLog: jest.fn(),
  clearConnectivityLog: jest.fn(),
  formatConnectivityLog: jest.fn(() => ''),
}));

const entries: ConnectivityLogEntry[] = [
  { id: 1, timestamp: 1700000000000, level: 'DEBUG', tag: 'A', message: 'debug msg' },
  { id: 2, timestamp: 1700000001000, level: 'WARN', tag: 'B', message: 'warn msg' },
  { id: 3, timestamp: 1700000002000, level: 'ERROR', tag: 'C', message: 'error msg' },
  { id: 4, timestamp: 1700000003000, level: 'INFO', tag: 'D', message: 'info msg' },
];

describe('LogViewer (levels and clear)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getConnectivityLog).mockReturnValue(entries);
  });

  it('labels each log level', async () => {
    await render(<LogViewer visible onClose={jest.fn()} />);
    expect(screen.getByText('screens.settings.logLevelDebug')).toBeTruthy();
    expect(screen.getByText('screens.settings.logLevelWarn')).toBeTruthy();
    expect(screen.getByText('screens.settings.logLevelError')).toBeTruthy();
    expect(screen.getByText('screens.settings.logLevelInfo')).toBeTruthy();
  });

  it('shows newest entries first', async () => {
    await render(<LogViewer visible onClose={jest.fn()} />);
    const messages = screen.getAllByText(/ msg$/).map((n) => n.props.children);
    expect(messages).toEqual(['info msg', 'error msg', 'warn msg', 'debug msg']);
  });

  it('clearing empties the log and notifies onClear', async () => {
    const onClear = jest.fn();
    await render(<LogViewer visible onClose={jest.fn()} onClear={onClear} />);
    await fireEvent.press(screen.getByText('screens.settings.clearLogs'));
    expect(clearConnectivityLog).toHaveBeenCalled();
    expect(onClear).toHaveBeenCalled();
    expect(screen.queryByText('info msg')).toBeNull();
  });
});

import {
  clog,
  clogDebug,
  clogInfo,
  clogWarn,
  clogError,
  getConnectivityLog,
  clearConnectivityLog,
  formatConnectivityLog,
  setDebugMode,
} from '@/services/connectivity-log';

describe('connectivity-log', () => {
  beforeEach(() => {
    clearConnectivityLog();
    setDebugMode(false);
  });

  it('formatConnectivityLog returns a placeholder message when empty', () => {
    expect(formatConnectivityLog()).toBe('(no connectivity log entries captured this session)');
  });

  it('clogInfo/Warn/Error add entries regardless of debug mode', () => {
    clogInfo('TAG', 'info msg');
    clogWarn('TAG', 'warn msg');
    clogError('TAG', 'error msg');
    const entries = getConnectivityLog();
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.level)).toEqual(['INFO', 'WARN', 'ERROR']);
  });

  it('clogDebug is dropped when debug mode disabled', () => {
    clogDebug('TAG', 'debug msg');
    expect(getConnectivityLog()).toHaveLength(0);
  });

  it('clogDebug is captured when debug mode enabled', () => {
    setDebugMode(true);
    clogDebug('TAG', 'debug msg');
    expect(getConnectivityLog()).toHaveLength(1);
  });

  it('assigns incrementing ids', () => {
    clogInfo('TAG', 'first');
    clogInfo('TAG', 'second');
    const entries = getConnectivityLog();
    expect(entries[1].id).toBe(entries[0].id + 1);
  });

  it('getConnectivityLog returns a copy, not a live reference', () => {
    clogInfo('TAG', 'msg');
    const entries = getConnectivityLog();
    entries.push({ id: 999, timestamp: 0, level: 'INFO', tag: 'X', message: 'injected' });
    expect(getConnectivityLog()).toHaveLength(1);
  });

  it('clearConnectivityLog resets entries and id counter', () => {
    clogInfo('TAG', 'msg');
    clearConnectivityLog();
    expect(getConnectivityLog()).toHaveLength(0);
    clogInfo('TAG', 'again');
    expect(getConnectivityLog()[0].id).toBe(1);
  });

  it('trims oldest entries beyond MAX_ENTRIES (500)', () => {
    for (let i = 0; i < 505; i++) {
      clog('INFO', 'TAG', `msg ${i}`);
    }
    const entries = getConnectivityLog();
    expect(entries).toHaveLength(500);
    expect(entries[0].message).toBe('msg 5');
    expect(entries[499].message).toBe('msg 504');
  });

  it('formatConnectivityLog formats entries with timestamp/level/tag/message', () => {
    clogInfo('AUTH', 'logged in');
    const formatted = formatConnectivityLog();
    expect(formatted).toMatch(/\[INFO\] \[AUTH\] logged in/);
  });

  it('formatConnectivityLog joins multiple entries with newlines', () => {
    clogInfo('A', 'one');
    clogWarn('B', 'two');
    const formatted = formatConnectivityLog();
    expect(formatted.split('\n')).toHaveLength(2);
  });
});

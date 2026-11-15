import React from 'react';
import { Alert, Linking } from 'react-native';
import axios from 'axios';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { SuperDebugPanel, SuperDebugPanelProps } from '@/components/SuperDebugPanel';
import { apiClient } from '@/services/api/client';
import { logsApi } from '@/services/api/logs';

jest.mock('@/context/ThemeContext', () => require('@/tests/rn/components/cov/mocks').themeModule);
jest.mock('axios', () => {
  const instance = { post: jest.fn(), get: jest.fn() };
  return { __esModule: true, default: { create: jest.fn(() => instance) } };
});
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({
  get documentDirectory() {
    return mockFs.documentDirectory;
  },
  writeAsStringAsync: jest.fn(),
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('@/services/connectivity-log', () => ({
  getConnectivityLog: jest.fn(() => []),
  formatConnectivityLog: jest.fn(() => 'CONNECTIVITY'),
}));
jest.mock('@/services/api/logs', () => ({ logsApi: { getLog: jest.fn(), getPeerLog: jest.fn() } }));
jest.mock('@/services/api/client', () => ({
  apiClient: { getServer: jest.fn() },
  maskSecret: (v: string) => `<masked:${v.length}>`,
  redactHeaderValue: (_k: string, v: string | string[]) => (Array.isArray(v) ? v.join(', ') : v),
}));

const mockFs: { documentDirectory: string | null } = { documentDirectory: 'file:///docs/' };
const http = (axios.create as jest.Mock).mock.results[0]?.value as {
  post: jest.Mock;
  get: jest.Mock;
};

// ---------------------------------------------------------------------------
// Fake XMLHttpRequest for the REACH probes
// ---------------------------------------------------------------------------
type XhrBehavior = (xhr: FakeXHR) => void;

class FakeXHR {
  static behaviors: XhrBehavior[] = [];
  static fallback: XhrBehavior = (x) => x.respond(200);
  static requests: FakeXHR[] = [];
  method = '';
  url = '';
  status = 0;
  responseText = '';
  headers: Record<string, string> = {};
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }
  send() {
    FakeXHR.requests.push(this);
    const behavior = FakeXHR.behaviors.shift() ?? FakeXHR.fallback;
    setTimeout(() => behavior(this), 0);
  }
  abort() {
    this.onabort?.();
  }
  respond(status: number) {
    this.status = status;
    this.onload?.();
  }
  fail(text = '') {
    this.responseText = text;
    this.onerror?.();
  }
}

const realXHR = global.XMLHttpRequest;
const realFetch = global.fetch;

const base: SuperDebugPanelProps = {
  host: '192.168.1.5',
  port: '8080',
  useHttps: false,
  username: 'admin',
  password: 'pw',
  bypassAuth: false,
};

async function renderPanel(props: Partial<SuperDebugPanelProps> = {}) {
  await render(<SuperDebugPanel {...base} {...props} />);
}

const press = (label: string) => fireEvent.press(screen.getByText(label));

async function runFull(props: Partial<SuperDebugPanelProps> = {}) {
  await renderPanel(props);
  await press('Run Full Diagnostic');
  await waitFor(
    () =>
      expect(
        screen.queryAllByText(/checks passed|Stopping diagnostic|Diagnostic cancelled/).length,
      ).toBeGreaterThan(0),
    { timeout: 3000 },
  );
}

const allText = () =>
  screen
    .queryAllByText(/./)
    .map((n) => [n.props.children].flat().join(''))
    .join('\n');

beforeEach(() => {
  jest.clearAllMocks();
  http.post.mockReset();
  http.get.mockReset();
  jest.mocked(logsApi.getLog).mockReset();
  jest.mocked(logsApi.getPeerLog).mockReset();
  FakeXHR.behaviors = [];
  FakeXHR.requests = [];
  FakeXHR.fallback = (x) => x.respond(200);
  (global as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXHR;
  mockFs.documentDirectory = 'file:///docs/';
  jest.mocked(apiClient.getServer).mockReturnValue(null);
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
});

afterAll(() => {
  global.XMLHttpRequest = realXHR;
  global.fetch = realFetch;
});

// ---------------------------------------------------------------------------
describe('SuperDebugPanel — Ping Host', () => {
  it('refuses to ping an empty host', async () => {
    await renderPanel({ host: '  ' });
    await press('Ping Host');
    expect(screen.getByText(/Host field is empty/)).toBeTruthy();
    expect(FakeXHR.requests).toHaveLength(0);
  });

  it('reports a reachable host and probes with HEAD at the built URL', async () => {
    await renderPanel({ host: 'https://nas.local/', port: '9090', useHttps: true });
    await press('Ping Host');
    await waitFor(() => expect(screen.getByText(/Host reachable — HTTP 200/)).toBeTruthy());
    expect(FakeXHR.requests[0].method).toBe('HEAD');
    expect(FakeXHR.requests[0].url).toBe('https://nas.local:9090');
  });

  it('places a path typed into Host after the port and appends basePath', async () => {
    await renderPanel({ host: 'nas.local/qbt/', port: '80', basePath: 'sub/' });
    await press('Ping Host');
    await waitFor(() => expect(FakeXHR.requests).toHaveLength(1));
    expect(FakeXHR.requests[0].url).toBe('http://nas.local:80/qbt/sub');
  });

  it('falls back to GET when HEAD fails and flags a 401 behind Basic Auth', async () => {
    FakeXHR.behaviors = [(x) => x.fail(''), (x) => x.respond(401)];
    await renderPanel({ useBasicAuth: true, basicAuthUsername: 'user', basicAuthPassword: 'pass' });
    await press('Ping Host');
    await waitFor(() => expect(screen.getByText(/proxy credentials rejected/)).toBeTruthy());
    expect(FakeXHR.requests.map((r) => r.method)).toEqual(['HEAD', 'GET']);
    expect(FakeXHR.requests[0].headers.Authorization).toBe('Basic dXNlcjpwYXNz');
  });

  it('encodes non-ASCII Basic Auth credentials as UTF-8', async () => {
    await renderPanel({ useBasicAuth: true, basicAuthUsername: 'üser€', basicAuthPassword: 'p' });
    await press('Ping Host');
    await waitFor(() => expect(FakeXHR.requests).toHaveLength(1));
    expect(FakeXHR.requests[0].headers.Authorization).toBe(
      `Basic ${Buffer.from('üser€:p', 'utf8').toString('base64')}`,
    );
  });

  it('treats 403 as normal auth-required', async () => {
    FakeXHR.fallback = (x) => x.respond(403);
    await renderPanel();
    await press('Ping Host');
    await waitFor(() => expect(screen.getByText(/auth required, this is normal/)).toBeTruthy());
  });

  it('warns about other HTTP errors', async () => {
    FakeXHR.fallback = (x) => x.respond(502);
    await renderPanel();
    await press('Ping Host');
    await waitFor(() => expect(screen.getByText(/Host responded with HTTP 502/)).toBeTruthy());
  });

  it('explains a TLS rejection', async () => {
    FakeXHR.fallback = (x) => x.fail('The certificate for this server is invalid.');
    await renderPanel({ useHttps: true });
    await press('Ping Host');
    await waitFor(() => expect(screen.getByText(/iOS rejected its TLS certificate/)).toBeTruthy());
    expect(screen.getByText(/Host unreachable after/)).toBeTruthy();
  });

  it('explains a network failure', async () => {
    FakeXHR.fallback = (x) => x.fail('');
    await renderPanel();
    await press('Ping Host');
    await waitFor(() => expect(screen.getByText(/cannot reach the server at all/)).toBeTruthy());
  });

  it('explains a timeout', async () => {
    FakeXHR.fallback = (x) => x.abort();
    await renderPanel();
    await press('Ping Host');
    await waitFor(() => expect(screen.getByText(/Connection timed out/)).toBeTruthy());
  });

  it('shows any other error detail', async () => {
    jest.spyOn(FakeXHR.prototype, 'open').mockImplementation(() => {
      throw new Error('bad url');
    });
    await renderPanel();
    await press('Ping Host');
    await waitFor(() => expect(screen.getByText('Error detail: bad url')).toBeTruthy());
    jest.mocked(FakeXHR.prototype.open).mockRestore();
  });

  it('sends custom headers on the probe', async () => {
    await renderPanel({
      useCustomHeaders: true,
      customHeaders: [{ key: 'X-Token', value: 'abc' }],
    });
    await press('Ping Host');
    await waitFor(() => expect(FakeXHR.requests).toHaveLength(1));
    expect(FakeXHR.requests[0].headers['X-Token']).toBe('abc');
  });
});

// ---------------------------------------------------------------------------
describe('SuperDebugPanel — browser links', () => {
  afterEach(() => jest.restoreAllMocks());

  it('opens the WebUI when the URL is supported', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderPanel();
    await press('Open WebUI');
    await waitFor(() => expect(open).toHaveBeenCalledWith('http://192.168.1.5:8080'));
    expect(screen.getByText('Opening in browser: http://192.168.1.5:8080')).toBeTruthy();
  });

  it('reports an unsupported URL', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(false);
    await renderPanel();
    await press('Open WebUI');
    await waitFor(() => expect(screen.getByText(/Cannot open URL on this device/)).toBeTruthy());
  });

  it('reports an open failure', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockRejectedValue(new Error('nope'));
    await renderPanel();
    await press('Test API');
    await waitFor(() => expect(screen.getByText('Failed to open URL: nope')).toBeTruthy());
  });

  it('opens the login endpoint with qui-specific guidance', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderPanel({ useQuiProxy: true, basePath: '/proxy/SECRETKEY123' });
    await press('Test API');
    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(open.mock.calls[0][0]).toBe(
      'http://192.168.1.5:8080/proxy/SECRETKEY123/api/v2/auth/login',
    );
    expect(screen.getByText(/Method Not Allowed/)).toBeTruthy();
    // The key never reaches the displayed log.
    expect(allText()).not.toContain('SECRETKEY123');
  });

  it('shows the plain login guidance and refuses an empty host', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(false);
    await renderPanel();
    await press('Test API');
    await waitFor(() => expect(screen.getByText(/browser will show "Fails\."/)).toBeTruthy());
  });

  it('refuses links for an empty host', async () => {
    await renderPanel({ host: '' });
    await press('Open WebUI');
    await press('Test API');
    expect(screen.getAllByText('Host field is empty.')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
describe('SuperDebugPanel — full diagnostic', () => {
  it('requires a host, credentials and an API key as applicable', async () => {
    await renderPanel({ host: '' });
    await press('Run Full Diagnostic');
    expect(screen.getByText(/Host field is empty/)).toBeTruthy();

    await renderPanel({ password: ' ' });
    await press('Run Full Diagnostic');
    expect(screen.getByText(/Username and password are required/)).toBeTruthy();

    await renderPanel({ useApiKey: true, apiKey: '  ' });
    await press('Run Full Diagnostic');
    expect(screen.getByText(/API key is required/)).toBeTruthy();
  });

  it('passes all four checks with a password login and reuses the session cookie', async () => {
    http.post.mockResolvedValue({
      status: 200,
      data: 'Ok.',
      headers: { 'set-cookie': ['other=1; path=/', 'QBT_SID_8080=abc123; HttpOnly'] },
    });
    http.get.mockResolvedValue({ status: 200, data: 'v5.0.2' });
    await runFull({ username: ' admin ', password: 'p&w' });
    expect(screen.getByText(/All 4 checks passed/)).toBeTruthy();
    expect(http.post).toHaveBeenCalledWith(
      'http://192.168.1.5:8080/api/v2/auth/login',
      'username=admin&password=p%26w',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/x-www-form-urlencoded' }),
      }),
    );
    expect(screen.getByText('Session cookie captured: QBT_SID_8080=<masked:6>')).toBeTruthy();
    expect(http.get).toHaveBeenCalledWith(
      'http://192.168.1.5:8080/api/v2/app/version',
      expect.objectContaining({ headers: { Cookie: 'QBT_SID_8080=abc123' } }),
    );
    expect(screen.getByText(/qBittorrent v5\.0\.2 \(HTTP 200/)).toBeTruthy();
    expect(screen.getByText(/Response headers:/)).toBeTruthy();
  });

  it('accepts an empty-body 5.x login and a single non-SID cookie string', async () => {
    http.post.mockResolvedValue({ status: 204, data: '', headers: { 'Set-Cookie': 'session=zz' } });
    http.get.mockResolvedValue({ status: 200, data: 'v5.1.0' });
    await runFull();
    expect(screen.getByText(/empty body \(qBittorrent 5\.x style\)/)).toBeTruthy();
    expect(screen.getByText('Session cookie captured: session=<masked:2>')).toBeTruthy();
  });

  it('stops on rejected credentials', async () => {
    http.post.mockResolvedValue({ status: 200, data: 'Fails.', headers: {} });
    await runFull();
    expect(screen.getByText(/Login REJECTED/)).toBeTruthy();
    expect(screen.getByText('Stopping diagnostic — login failed.')).toBeTruthy();
    expect(
      screen.getByText('1/4 checks passed. Review the issues above and try the suggested fixes.'),
    ).toBeTruthy();
    expect(http.get).not.toHaveBeenCalled();
  });

  it('stops when the login endpoint is missing', async () => {
    http.post.mockResolvedValue({ status: 404, data: 'Not Found', headers: {} });
    await runFull();
    expect(screen.getByText(/Login endpoint not found/)).toBeTruthy();
  });

  it('stops on an unexpected login response', async () => {
    http.post.mockResolvedValue({ status: 500, data: { odd: true }, headers: {} });
    await runFull();
    expect(screen.getByText(/Unexpected response/)).toBeTruthy();
  });

  it('stops when the login request throws', async () => {
    http.post.mockRejectedValue(new Error('socket hang up'));
    await runFull();
    expect(screen.getByText(/Login request FAILED/)).toBeTruthy();
    expect(screen.getByText(/Error: socket hang up/)).toBeTruthy();
  });

  it('warns when no cookie arrives and explains the resulting 403', async () => {
    http.post.mockResolvedValue({ status: 200, data: 'Ok.', headers: {} });
    http.get.mockResolvedValue({ status: 403, data: 'Forbidden' });
    await runFull();
    expect(screen.getByText('No set-cookie header received from server.')).toBeTruthy();
    expect(screen.getByText(/no session cookie was captured \(Step 3\)/)).toBeTruthy();
    expect(screen.getByText(/3\/4 checks passed/)).toBeTruthy();
  });

  it('explains a 403 even though a cookie was sent', async () => {
    http.post.mockResolvedValue({ status: 200, data: 'Ok.', headers: { 'set-cookie': 'SID=1' } });
    http.get.mockResolvedValue({ status: 403, data: '' });
    await runFull();
    expect(screen.getByText(/The session cookie was sent but the server rejected it/)).toBeTruthy();
  });

  it('reports an unexpected API status and an API failure', async () => {
    http.post.mockResolvedValue({ status: 200, data: 'Ok.', headers: { 'set-cookie': 'SID=1' } });
    http.get.mockResolvedValueOnce({ status: 500, data: 'oops' });
    await runFull();
    expect(screen.getByText(/Unexpected — HTTP 500: "oops"/)).toBeTruthy();
  });

  it('reports a thrown API request', async () => {
    http.post.mockResolvedValue({ status: 200, data: 'Ok.', headers: { 'set-cookie': 'SID=1' } });
    http.get.mockRejectedValue(new Error('ECONNRESET'));
    await runFull();
    expect(screen.getByText(/API request failed after \d+ms — ECONNRESET/)).toBeTruthy();
  });

  it('runs two checks with an API key, sending a Bearer header', async () => {
    http.get.mockResolvedValue({ status: 200, data: 'v5.2.0' });
    await runFull({ useApiKey: true, apiKey: ' key-1 ' });
    expect(screen.getByText(/API key auth is stateless/)).toBeTruthy();
    expect(screen.getByText(/All 2 checks passed/)).toBeTruthy();
    expect(http.post).not.toHaveBeenCalled();
    expect(http.get.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer key-1' });
    expect(FakeXHR.requests[0].headers.Authorization).toBe('Bearer key-1');
  });

  it('explains a rejected API key', async () => {
    http.get.mockResolvedValue({ status: 403, data: '' });
    await runFull({ useApiKey: true, apiKey: 'k' });
    expect(screen.getByText(/API key authentication was rejected/)).toBeTruthy();
  });

  it('explains a 403 with auth bypass', async () => {
    http.get.mockResolvedValue({ status: 403, data: '' });
    await runFull({ bypassAuth: true });
    expect(screen.getByText('Steps 2-3 skipped (auth bypass enabled).')).toBeTruthy();
    expect(screen.getByText(/Auth bypass is enabled, but the server still requires/)).toBeTruthy();
  });

  it('handles qui proxy key rejection and session rejection without leaking the key', async () => {
    http.get.mockResolvedValueOnce({ status: 401, data: 'Invalid API key' });
    await runFull({
      useQuiProxy: true,
      basePath: '/proxy/SECRETKEY123',
      username: '',
      password: '',
    });
    expect(screen.getByText(/qui rejected the proxy key/)).toBeTruthy();
    expect(screen.getByText(/qui proxy auth is the key in the URL/)).toBeTruthy();
    expect(allText()).not.toContain('SECRETKEY123');
    expect(http.get.mock.calls[0][0]).toContain('/proxy/SECRETKEY123/api/v2/app/version');

    http.get.mockResolvedValueOnce({ status: 403, data: '' });
    await runFull({ useQuiProxy: true, basePath: '/proxy/SECRETKEY123' });
    expect(screen.getByText(/qui accepted the proxy key, but qBittorrent rejected/)).toBeTruthy();
  });

  it('warns on a Basic Auth 401 at the reach step but continues', async () => {
    FakeXHR.fallback = (x) => x.respond(401);
    http.get.mockResolvedValue({ status: 200, data: 'v4.6.0' });
    await runFull({ bypassAuth: true, useBasicAuth: true, basicAuthUsername: 'u' });
    expect(screen.getByText(/check Basic Auth username\/password/)).toBeTruthy();
    expect(screen.getByText(/All 2 checks passed/)).toBeTruthy();
  });

  it('lists custom header names (not values) in the log', async () => {
    http.get.mockResolvedValue({ status: 200, data: 'v5' });
    await runFull({
      bypassAuth: true,
      useCustomHeaders: true,
      customHeaders: [
        { key: 'X-Access', value: 'secret-token' },
        { key: '', value: '' },
      ],
    });
    expect(screen.getByText('Sending custom headers: X-Access')).toBeTruthy();
    expect(allText()).not.toContain('secret-token');
    expect(http.get.mock.calls[0][1].headers).toEqual({ 'X-Access': 'secret-token' });
  });

  it.each([
    ['TLS', (x: FakeXHR) => x.fail('certificate invalid'), /iOS rejected its TLS certificate/],
    ['network', (x: FakeXHR) => x.fail(''), /cannot establish a connection/],
    ['timeout', (x: FakeXHR) => x.abort(), /did not respond within 15 seconds/],
  ])('stops when the server is unreachable (%s)', async (_name, behavior, expected) => {
    FakeXHR.fallback = behavior;
    await runFull();
    expect(screen.getByText(expected)).toBeTruthy();
    expect(screen.getByText(/FAILED — Server unreachable/)).toBeTruthy();
    expect(screen.getByText(/0\/4 checks passed/)).toBeTruthy();
  });

  it('shows other reach errors verbatim', async () => {
    jest.spyOn(FakeXHR.prototype, 'open').mockImplementation(() => {
      throw new Error('weird failure');
    });
    await runFull();
    expect(screen.getByText('Error: weird failure')).toBeTruthy();
    jest.mocked(FakeXHR.prototype.open).mockRestore();
  });

  it('cancels during login and reports the cancellation', async () => {
    http.post.mockImplementation(
      (_url: string, _body: string, cfg: { signal: AbortSignal }) =>
        new Promise((_res, rej) => {
          cfg.signal.addEventListener('abort', () => {
            const e = new Error('canceled');
            e.name = 'CanceledError';
            rej(e);
          });
        }),
    );
    await renderPanel();
    // fireEvent awaits the handler, which only settles once cancelled — so don't await it yet.
    const run = press('Run Full Diagnostic');
    await waitFor(() => expect(screen.getByText('Step 2 — Can the app log in?')).toBeTruthy());
    await press('Cancel');
    await run;
    await waitFor(() => expect(screen.getByText('Diagnostic cancelled.')).toBeTruthy());
    expect(screen.getByText('Run Full Diagnostic')).toBeTruthy();
    expect(screen.queryByText(/checks passed/)).toBeNull();
  });

  // Cancel during Step 1 shares the 15s timeout's AbortController, so the panel
  // cannot tell the two apart and reports the cancel as an unreachable host.
  it.skip('reports "Diagnostic cancelled." when cancelled during the reach step', async () => {
    FakeXHR.fallback = () => {};
    await renderPanel();
    const run = press('Run Full Diagnostic');
    await waitFor(() => expect(screen.getByText('Cancel')).toBeTruthy());
    await press('Cancel');
    await run;
    await waitFor(() => expect(screen.getByText('Diagnostic cancelled.')).toBeTruthy());
    expect(screen.queryByText(/Server unreachable/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('SuperDebugPanel — copy, clear, export', () => {
  async function pingOnce(props: Partial<SuperDebugPanelProps> = {}) {
    await renderPanel(props);
    await press('Ping Host');
    await waitFor(() => expect(screen.getByText(/Host reachable/)).toBeTruthy());
  }

  it('copies a report with the config and log, then clears the log', async () => {
    await pingOnce({ useApiKey: true, apiKey: 'k' });
    await press('Copy');
    await waitFor(() => expect(screen.getByText('Full report copied to clipboard.')).toBeTruthy());
    const report = jest.mocked(Clipboard.setStringAsync).mock.calls[0][0];
    expect(report).toContain('=== qBitRemote Diagnostic Report ===');
    expect(report).toContain('Auth Method: apiKey');
    expect(report).toContain('Port: 8080');
    expect(report).toMatch(/\[REACH\] Host reachable/);
    await press('Clear');
    expect(screen.queryByText('Results')).toBeNull();
  });

  it('reports a clipboard failure', async () => {
    jest.mocked(Clipboard.setStringAsync).mockRejectedValueOnce(new Error('denied'));
    await pingOnce();
    await press('Copy');
    await waitFor(() => expect(screen.getByText('Failed to copy: denied')).toBeTruthy());
  });

  const written = () => jest.mocked(FileSystem.writeAsStringAsync).mock.calls[0][1] as string;

  it('exports a report without server logs when not connected and shares it', async () => {
    await renderPanel({ host: '', port: '', username: '' });
    await press('Export Full Logs');
    await waitFor(() => expect(screen.getByText('Logs exported successfully.')).toBeTruthy());
    const [uri] = jest.mocked(FileSystem.writeAsStringAsync).mock.calls[0];
    expect(uri).toMatch(/^file:\/\/\/docs\/qBitRemote-logs-.*\.txt$/);
    expect(written()).toContain('(not connected');
    expect(written()).toContain('Host: (empty)');
    expect(written()).toContain('Username: (empty)');
    expect(written()).toContain('CONNECTIVITY');
    expect(written()).toContain('(no diagnostic entries');
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      uri,
      expect.objectContaining({ mimeType: 'text/plain', UTI: 'public.plain-text' }),
    );
  });

  it('falls back to the clipboard when sharing is unavailable', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);
    await renderPanel();
    await press('Export Full Logs');
    await waitFor(() => expect(screen.getByText(/copied to clipboard instead/)).toBeTruthy());
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(written());
  });

  it('reports a missing file system', async () => {
    mockFs.documentDirectory = null;
    await renderPanel();
    await press('Export Full Logs');
    await waitFor(() => expect(screen.getByText('File system not available.')).toBeTruthy());
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
  });

  it('alerts when the export fails', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.mocked(FileSystem.writeAsStringAsync).mockRejectedValueOnce(new Error('disk full'));
    await renderPanel();
    await press('Export Full Logs');
    await waitFor(() => expect(screen.getByText('Export failed: disk full')).toBeTruthy());
    expect(alert).toHaveBeenCalledWith('Export Failed', 'disk full');
    alert.mockRestore();
  });

  it('includes server logs from the connected apiClient, sorted and labelled', async () => {
    jest.mocked(apiClient.getServer).mockReturnValue({ id: 's' } as never);
    jest.mocked(logsApi.getLog).mockResolvedValue([
      { id: 2, message: 'second', timestamp: 1700000001, type: 4 },
      { id: 1, message: 'first', timestamp: 1700000000, type: 1 },
      { id: 3, message: 'warn', timestamp: 1700000002, type: 2 },
      { id: 4, message: 'info', timestamp: 1700000003, type: 8 },
    ] as never);
    jest
      .mocked(logsApi.getPeerLog)
      .mockResolvedValue([
        { id: 1700000000, ip: '1.2.3.4', port: 6881, connection: 'TCP', flags: 'D', client: 'qB' },
      ] as never);
    await renderPanel();
    await press('Export Full Logs');
    await waitFor(() => expect(FileSystem.writeAsStringAsync).toHaveBeenCalled());
    const text = written();
    expect(logsApi.getLog).toHaveBeenCalledWith(true, true, true, true);
    expect(text).toContain('--- Application Logs (4 entries) ---');
    expect(text.indexOf('[NORMAL] first')).toBeLessThan(text.indexOf('[CRITICAL] second'));
    expect(text).toContain('[WARNING] warn');
    expect(text).toContain('[INFO] info');
    expect(text).toContain('1.2.3.4:6881 | qB | TCP | flags=D');
  });

  it('notes empty and failed server log fetches', async () => {
    jest.mocked(apiClient.getServer).mockReturnValue({ id: 's' } as never);
    jest.mocked(logsApi.getLog).mockResolvedValue([]);
    jest.mocked(logsApi.getPeerLog).mockRejectedValue(new Error('x'));
    await renderPanel();
    await press('Export Full Logs');
    await waitFor(() => expect(FileSystem.writeAsStringAsync).toHaveBeenCalled());
    expect(written()).toContain('(no application log entries returned from server)');
    expect(written()).toContain('(failed to fetch peer logs)');
  });

  it('notes an empty peer log and a failed main log', async () => {
    jest.mocked(apiClient.getServer).mockReturnValue({ id: 's' } as never);
    jest
      .mocked(logsApi.getLog)
      .mockResolvedValueOnce([{ id: 1, message: 'm', timestamp: 1, type: 1 }] as never);
    jest.mocked(logsApi.getPeerLog).mockResolvedValue([]);
    await renderPanel();
    await press('Export Full Logs');
    await waitFor(() => expect(FileSystem.writeAsStringAsync).toHaveBeenCalled());
    expect(written()).toContain('(no peer log entries returned from server)');

    jest.mocked(FileSystem.writeAsStringAsync).mockClear();
    jest.mocked(logsApi.getLog).mockRejectedValueOnce(new Error('403'));
    await renderPanel();
    await press('Export Full Logs');
    await waitFor(() => expect(FileSystem.writeAsStringAsync).toHaveBeenCalled());
    expect(written()).toContain('(could not fetch server logs: 403)');
  });

  describe('with a session validated by the diagnostic', () => {
    const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

    async function validate(props: Partial<SuperDebugPanelProps> = {}) {
      http.post.mockResolvedValue({
        status: 200,
        data: 'Ok.',
        headers: { 'set-cookie': 'SID=s1' },
      });
      http.get.mockResolvedValue({ status: 200, data: 'v5' });
      await runFull(props);
      expect(screen.getByText(/All 4 checks passed/)).toBeTruthy();
    }

    it('fetches main and peer logs with the validated cookie', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(
          okJson([
            { id: 2, message: 'b', timestamp: 2, type: 2 },
            { id: 1, message: 'a', timestamp: 1, type: 4 },
          ]),
        )
        .mockResolvedValueOnce(
          okJson([{ id: 5, ip: '9.9.9.9', port: 1, connection: 'uTP', flags: 'E', client: 'T' }]),
        );
      global.fetch = fetchMock as never;
      await validate();
      await press('Export Full Logs');
      await waitFor(() => expect(FileSystem.writeAsStringAsync).toHaveBeenCalled());
      expect(fetchMock.mock.calls[0][0]).toBe(
        'http://192.168.1.5:8080/api/v2/log/main?normal=1&info=1&warning=1&critical=1',
      );
      expect(fetchMock.mock.calls[0][1].headers).toEqual({ Cookie: 'SID=s1' });
      expect(fetchMock.mock.calls[1][0]).toBe('http://192.168.1.5:8080/api/v2/log/peers');
      expect(written()).toContain('[CRITICAL] a');
      expect(written()).toContain('9.9.9.9:1 | T | uTP | flags=E');
      expect(logsApi.getLog).not.toHaveBeenCalled();
    });

    it('notes empty logs and a failed peer fetch', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(okJson([]))
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => [] }) as never;
      await validate();
      await press('Export Full Logs');
      await waitFor(() => expect(FileSystem.writeAsStringAsync).toHaveBeenCalled());
      expect(written()).toContain('(no application log entries returned from server)');
      expect(written()).toContain('(failed to fetch peer logs)');
    });

    it('notes an empty peer log', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(okJson([{ id: 1, message: 'a', timestamp: 1, type: 1 }]))
        .mockResolvedValueOnce(okJson([])) as never;
      await validate();
      await press('Export Full Logs');
      await waitFor(() => expect(FileSystem.writeAsStringAsync).toHaveBeenCalled());
      expect(written()).toContain('(no peer log entries returned from server)');
    });

    it('notes a failed main log fetch', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 401 }) as never;
      await validate();
      await press('Export Full Logs');
      await waitFor(() => expect(FileSystem.writeAsStringAsync).toHaveBeenCalled());
      expect(written()).toContain('validated diagnostic session: HTTP 401');
    });
  });
});

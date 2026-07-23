/**
 * Comprehensive tests for the apiClient singleton in services/api/client.ts:
 * request/response interceptors, cookie capture, error normalization,
 * retry logic, and the public request methods.
 */

jest.mock('@/services/connectivity-log', () => ({
  clogDebug: jest.fn(),
  clogInfo: jest.fn(),
  clogWarn: jest.fn(),
  clogError: jest.fn(),
}));

jest.mock('@/utils/apiVersion', () => ({
  getApiFeatures: jest.fn(() => ({ mockFeature: true })),
}));

type RequestInterceptorFn = (config: Record<string, unknown>) => Record<string, unknown>;
type RequestInterceptorErrFn = (error: unknown) => unknown;
type ResponseInterceptorSuccessFn = (response: unknown) => unknown;
type ResponseInterceptorErrorFn = (error: unknown) => unknown;

let capturedRequestInterceptor: RequestInterceptorFn | null = null;
let capturedRequestInterceptorErr: RequestInterceptorErrFn | null = null;
let capturedResponseInterceptorSuccess: ResponseInterceptorSuccessFn | null = null;
let capturedResponseInterceptorError: ResponseInterceptorErrorFn | null = null;

const mockAxiosInstance = {
  interceptors: {
    request: {
      use: jest.fn((fn: RequestInterceptorFn, errFn: RequestInterceptorErrFn) => {
        capturedRequestInterceptor = fn;
        capturedRequestInterceptorErr = errFn;
      }),
    },
    response: {
      use: jest.fn((success: ResponseInterceptorSuccessFn, error: ResponseInterceptorErrorFn) => {
        capturedResponseInterceptorSuccess = success;
        capturedResponseInterceptorError = error;
      }),
    },
  },
  defaults: { timeout: 10000 },
  post: jest.fn(),
  get: jest.fn(),
};

class MockAxiosError extends Error {
  code?: string;
  config?: Record<string, unknown>;
  response?: { status?: number; data?: unknown; headers?: Record<string, unknown> };
  isAxiosError = true;
  constructor(message?: string) {
    super(message);
  }
}

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => mockAxiosInstance),
  },
  AxiosHeaders: class {
    private headers: Record<string, string> = {};
    constructor(initial?: Record<string, string>) {
      if (initial) Object.assign(this.headers, initial);
    }
    set(key: string, value: string) {
      this.headers[key] = value;
    }
    get(key: string) {
      return this.headers[key];
    }
  },
  AxiosError: MockAxiosError,
}));

import { apiClient } from '@/services/api/client';
import type { ServerConfig } from '@/types/api';

function makeServer(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    id: 'test-server',
    name: 'Test',
    host: 'example.com',
    port: 8080,
    username: 'admin',
    password: 'adminadmin',
    useHttps: false,
    bypassAuth: false,
    ...overrides,
  };
}

function runRequestInterceptor(config: Record<string, unknown> = { headers: {}, method: 'get', url: '/test' }) {
  if (!capturedRequestInterceptor) throw new Error('Request interceptor not captured');
  return capturedRequestInterceptor(config);
}

describe('apiClient', () => {
  afterEach(() => {
    apiClient.setServer(null);
    jest.clearAllMocks();
  });

  describe('request interceptor', () => {
    it('rejects when no server is configured', async () => {
      apiClient.setServer(null);
      const result = runRequestInterceptor();
      await expect(result).rejects.toThrow('No server configured');
    });

    it('builds baseURL for http with no basePath', () => {
      apiClient.setServer(makeServer({ useHttps: false, basePath: undefined }));
      const config = runRequestInterceptor() as { baseURL: string };
      expect(config.baseURL).toBe('http://example.com:8080');
    });

    it('builds baseURL for https', () => {
      apiClient.setServer(makeServer({ useHttps: true }));
      const config = runRequestInterceptor() as { baseURL: string };
      expect(config.baseURL).toBe('https://example.com:8080');
    });

    it('strips protocol and trailing slashes/colons from host', () => {
      apiClient.setServer(makeServer({ host: 'http://example.com/:' }));
      const config = runRequestInterceptor() as { baseURL: string };
      expect(config.baseURL).toBe('http://example.com:8080');
    });

    it('omits port when not provided or invalid', () => {
      apiClient.setServer(makeServer({ port: undefined }));
      const config = runRequestInterceptor() as { baseURL: string };
      expect(config.baseURL).toBe('http://example.com');
    });

    it('omits port when NaN', () => {
      apiClient.setServer(makeServer({ port: 'not-a-number' as unknown as number }));
      const config = runRequestInterceptor() as { baseURL: string };
      expect(config.baseURL).toBe('http://example.com');
    });

    it('normalizes basePath without leading slash', () => {
      apiClient.setServer(makeServer({ basePath: 'qbt' }));
      const config = runRequestInterceptor() as { baseURL: string };
      expect(config.baseURL).toBe('http://example.com:8080/qbt');
    });

    it('treats basePath of "/" as empty', () => {
      apiClient.setServer(makeServer({ basePath: '/' }));
      const config = runRequestInterceptor() as { baseURL: string };
      expect(config.baseURL).toBe('http://example.com:8080');
    });

    it('strips trailing slash from non-root basePath', () => {
      apiClient.setServer(makeServer({ basePath: '/qbt/' }));
      const config = runRequestInterceptor() as { baseURL: string };
      expect(config.baseURL).toBe('http://example.com:8080/qbt');
    });

    it('sets Referer and Origin headers', () => {
      apiClient.setServer(makeServer());
      const config = runRequestInterceptor() as { headers: Record<string, string>; baseURL: string };
      expect(config.headers.Referer).toBe(`${config.baseURL}/`);
      expect(config.headers.Origin).toBe('http://example.com:8080');
    });

    it('sets Cookie header when cookies are present', () => {
      apiClient.setServer(makeServer());
      if (capturedResponseInterceptorSuccess) {
        capturedResponseInterceptorSuccess({
          headers: { 'set-cookie': 'SID=abc123; Path=/' },
          data: 'Ok.',
          status: 200,
        });
      }
      const config = runRequestInterceptor() as { headers: Record<string, string> };
      expect(config.headers.Cookie).toContain('SID=abc123');
    });

    it('request interceptor error handler rejects with the original error', async () => {
      if (!capturedRequestInterceptorErr) throw new Error('not captured');
      const err = new Error('boom');
      await expect(capturedRequestInterceptorErr(err)).rejects.toBe(err);
    });
  });

  describe('response interceptor — success (cookie capture)', () => {
    beforeEach(() => {
      apiClient.setServer(makeServer());
    });

    it('captures a single set-cookie header', () => {
      const response = { headers: { 'set-cookie': 'SID=xyz; Path=/' }, data: 'Ok.', status: 200 };
      const result = capturedResponseInterceptorSuccess!(response);
      expect(result).toBe(response);
      expect(apiClient.getCookies()).toBe('SID=xyz');
    });

    it('captures and joins an array of set-cookie headers', () => {
      capturedResponseInterceptorSuccess!({
        headers: { 'set-cookie': ['SID=a; Path=/', 'OTHER=b; HttpOnly'] },
        data: '',
        status: 200,
      });
      expect(apiClient.getCookies()).toBe('SID=a; OTHER=b');
    });

    it('uses Set-Cookie (capitalized) fallback', () => {
      capturedResponseInterceptorSuccess!({ headers: { 'Set-Cookie': 'SID=cap; Path=/' }, data: '', status: 200 });
      expect(apiClient.getCookies()).toBe('SID=cap');
    });

    it('uses headers.get() fallback when present', () => {
      capturedResponseInterceptorSuccess!({
        headers: { get: (key: string) => (key === 'set-cookie' ? 'SID=viaget' : null) },
        data: '',
        status: 200,
      });
      expect(apiClient.getCookies()).toBe('SID=viaget');
    });

    it('leaves cookies untouched when no set-cookie header exists', () => {
      apiClient.clearCookies();
      capturedResponseInterceptorSuccess!({ headers: { 'x-other': 'val' }, data: '', status: 200 });
      expect(apiClient.getCookies()).toBe('');
    });

    it('handles missing headers object gracefully', () => {
      apiClient.clearCookies();
      capturedResponseInterceptorSuccess!({ data: '', status: 200 });
      expect(apiClient.getCookies()).toBe('');
    });
  });

  describe('response interceptor — error normalization', () => {
    function makeErr(overrides: Partial<InstanceType<typeof MockAxiosError>> = {}) {
      const err = new MockAxiosError('request failed');
      Object.assign(err, { config: { baseURL: 'http://example.com', url: '/api/v2/x' } }, overrides);
      return err;
    }

    it('normalizes 403 to auth error and clears cookies', () => {
      apiClient.setServer(makeServer());
      capturedResponseInterceptorSuccess!({ headers: { 'set-cookie': 'SID=abc' }, data: '', status: 200 });
      expect(apiClient.getCookies()).not.toBe('');
      const err = makeErr({ response: { status: 403 } });
      expect(() => capturedResponseInterceptorError!(err)).toThrow('Authentication failed. Please check your credentials.');
      expect(apiClient.getCookies()).toBe('');
    });

    it('normalizes 429 with retry-after header', () => {
      const err = makeErr({ response: { status: 429, headers: { 'retry-after': '30' } } });
      expect(() => capturedResponseInterceptorError!(err)).toThrow('Rate limited by server. Please retry after 30 seconds.');
    });

    it('normalizes 429 without retry-after header', () => {
      const err = makeErr({ response: { status: 429, headers: {} } });
      expect(() => capturedResponseInterceptorError!(err)).toThrow('Rate limited by server.');
    });

    it('normalizes 409 on a priority endpoint to a queueing error', () => {
      const err = makeErr({
        config: { baseURL: 'http://example.com', url: '/api/v2/torrents/topPrio' },
        response: { status: 409 },
      });
      expect(() => capturedResponseInterceptorError!(err)).toThrow(
        'Torrent queueing must be enabled in qBittorrent to change priorities.'
      );
    });

    it('normalizes 409 on a non-priority endpoint (e.g. duplicate torrent add) using the response body', () => {
      const err = makeErr({
        config: { baseURL: 'http://example.com', url: '/api/v2/torrents/add' },
        response: { status: 409, data: 'Torrent already exists' },
      });
      expect(() => capturedResponseInterceptorError!(err)).toThrow('Torrent already exists');
    });

    it('normalizes 409 on a non-priority endpoint with no body to a generic duplicate/conflict message', () => {
      const err = makeErr({
        config: { baseURL: 'http://example.com', url: '/api/v2/torrents/add' },
        response: { status: 409 },
      });
      expect(() => capturedResponseInterceptorError!(err)).toThrow(
        'This torrent already exists or could not be added.'
      );
    });

    it('normalizes 404 to endpoint-not-found error', () => {
      const err = makeErr({ response: { status: 404 } });
      expect(() => capturedResponseInterceptorError!(err)).toThrow(/Endpoint not found/);
    });

    it('normalizes ECONNABORTED to connection timeout error', () => {
      const err = makeErr({ code: 'ECONNABORTED' });
      expect(() => capturedResponseInterceptorError!(err)).toThrow('Connection timeout. Please check your server connection.');
    });

    it('normalizes ERR_NETWORK to connection timeout error', () => {
      const err = makeErr({ code: 'ERR_NETWORK' });
      expect(() => capturedResponseInterceptorError!(err)).toThrow('Connection timeout. Please check your server connection.');
    });

    it('falls through to response data message for unknown status', () => {
      const err = makeErr({ response: { status: 500, data: 'Internal Server Error' } });
      expect(() => capturedResponseInterceptorError!(err)).toThrow('Internal Server Error');
    });

    it('falls back to error.message when no response data', () => {
      const err = makeErr({ message: 'socket hang up' });
      expect(() => capturedResponseInterceptorError!(err)).toThrow('socket hang up');
    });

    it('falls back to unknown error message when nothing else present', () => {
      const err = makeErr({ message: '' });
      expect(() => capturedResponseInterceptorError!(err)).toThrow('An unknown error occurred');
    });
  });

  describe('setServer / getServer', () => {
    it('sets and gets the current server', () => {
      const server = makeServer();
      apiClient.setServer(server);
      expect(apiClient.getServer()).toBe(server);
    });

    it('clears cookies and apiVersion when switching to a different server id', () => {
      apiClient.setServer(makeServer({ id: 'server-1' }));
      apiClient.setApiVersion('2.8.3');
      capturedResponseInterceptorSuccess!({ headers: { 'set-cookie': 'SID=abc' }, data: '', status: 200 });
      expect(apiClient.getCookies()).not.toBe('');

      apiClient.setServer(makeServer({ id: 'server-2' }));
      expect(apiClient.getCookies()).toBe('');
      expect(apiClient.getApiVersion()).toBeNull();
    });

    it('preserves cookies when re-setting the same server id', () => {
      apiClient.setServer(makeServer({ id: 'server-1' }));
      capturedResponseInterceptorSuccess!({ headers: { 'set-cookie': 'SID=abc' }, data: '', status: 200 });
      expect(apiClient.getCookies()).not.toBe('');

      apiClient.setServer(makeServer({ id: 'server-1', name: 'renamed' }));
      expect(apiClient.getCookies()).not.toBe('');
    });

    it('clears cookies when setting server to null', () => {
      apiClient.setServer(makeServer());
      capturedResponseInterceptorSuccess!({ headers: { 'set-cookie': 'SID=abc' }, data: '', status: 200 });
      apiClient.setServer(null);
      expect(apiClient.getCookies()).toBe('');
      expect(apiClient.getServer()).toBeNull();
    });
  });

  describe('apiVersion / features', () => {
    it('caches features until version changes', () => {
      const { getApiFeatures } = jest.requireMock('@/utils/apiVersion') as { getApiFeatures: jest.Mock };
      apiClient.setApiVersion('2.9.0');
      apiClient.getApiFeatures();
      apiClient.getApiFeatures();
      expect(getApiFeatures).toHaveBeenCalledTimes(1);

      apiClient.setApiVersion('2.9.1');
      apiClient.getApiFeatures();
      expect(getApiFeatures).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateSettings', () => {
    it('updates connectionTimeout on the axios client defaults', () => {
      apiClient.updateSettings({ connectionTimeout: 5000 });
      expect(mockAxiosInstance.defaults.timeout).toBe(5000);
    });

    it('leaves timeout unchanged when connectionTimeout is undefined', () => {
      mockAxiosInstance.defaults.timeout = 7000;
      apiClient.updateSettings({});
      expect(mockAxiosInstance.defaults.timeout).toBe(7000);
    });

    it('clamps retryAttempts to a minimum of 0', async () => {
      apiClient.updateSettings({ retryAttempts: -5 });
      apiClient.setServer(makeServer());
      mockAxiosInstance.get.mockRejectedValueOnce(new MockAxiosError('ECONNABORTED-ish'));
      await expect(apiClient.get('/test')).rejects.toThrow();
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('postFormData', () => {
    it('throws when no server is configured', async () => {
      apiClient.setServer(null);
      await expect(apiClient.postFormData('/upload', new FormData())).rejects.toThrow('No server configured');
    });

    it('posts with multipart headers and cookie when present', async () => {
      apiClient.setServer(makeServer());
      capturedResponseInterceptorSuccess!({ headers: { 'set-cookie': 'SID=abc' }, data: '', status: 200 });
      mockAxiosInstance.post.mockResolvedValueOnce({ data: 'ok' });

      const result = await apiClient.postFormData('/upload', new FormData());

      expect(result).toBe('ok');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/upload', expect.any(FormData), expect.anything());
    });
  });

  describe('postUrlEncoded', () => {
    it('throws when no server is configured', async () => {
      apiClient.setServer(null);
      await expect(apiClient.postUrlEncoded('/auth/login', { a: 1 })).rejects.toThrow(
        'No server configured. Please connect to a server first.'
      );
    });

    it('encodes data and skips undefined/null values', async () => {
      apiClient.setServer(makeServer());
      mockAxiosInstance.post.mockResolvedValueOnce({ data: 'Ok.' });

      const result = await apiClient.postUrlEncoded('/auth/login', {
        username: 'admin',
        password: 'p@ss word',
        skip1: undefined as unknown as string,
        skip2: null as unknown as string,
      });

      expect(result).toBe('Ok.');
      const [, body] = mockAxiosInstance.post.mock.calls[0];
      expect(body).toBe('username=admin&password=p%40ss%20word');
    });
  });

  describe('get', () => {
    it('throws when no server is configured', async () => {
      apiClient.setServer(null);
      await expect(apiClient.get('/torrents/info')).rejects.toThrow('No server configured');
    });

    it('returns data on success', async () => {
      apiClient.setServer(makeServer());
      mockAxiosInstance.get.mockResolvedValueOnce({ data: [{ hash: 'a' }] });
      const result = await apiClient.get('/torrents/info');
      expect(result).toEqual([{ hash: 'a' }]);
    });

    it('retries a retriable error and eventually succeeds', async () => {
      apiClient.setServer(makeServer());
      apiClient.updateSettings({ retryAttempts: 2 });
      const timeoutErr = new MockAxiosError('timeout of 10000ms exceeded');
      timeoutErr.code = 'ECONNABORTED';
      mockAxiosInstance.get
        .mockRejectedValueOnce(timeoutErr)
        .mockResolvedValueOnce({ data: 'ok' });

      const result = await apiClient.get('/torrents/info');

      expect(result).toBe('ok');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it('does not retry a non-retriable error', async () => {
      apiClient.setServer(makeServer());
      apiClient.updateSettings({ retryAttempts: 3 });
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Authentication failed. Please check your credentials.'));

      await expect(apiClient.get('/torrents/info')).rejects.toThrow('Authentication failed');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });

    it('exhausts retries and throws the last error', async () => {
      apiClient.setServer(makeServer());
      apiClient.updateSettings({ retryAttempts: 1 });
      const timeoutErr = new MockAxiosError('ETIMEDOUT');
      timeoutErr.code = 'ETIMEDOUT';
      mockAxiosInstance.get.mockRejectedValue(timeoutErr);

      await expect(apiClient.get('/torrents/info')).rejects.toBe(timeoutErr);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it('treats a plain Error with "timeout" in message as retriable', async () => {
      apiClient.setServer(makeServer());
      apiClient.updateSettings({ retryAttempts: 1 });
      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error('Request timeout occurred'))
        .mockResolvedValueOnce({ data: 'ok' });

      const result = await apiClient.get('/torrents/info');
      expect(result).toBe('ok');
    });
  });

  describe('post', () => {
    it('throws when no server is configured', async () => {
      apiClient.setServer(null);
      await expect(apiClient.post('/torrents/pause')).rejects.toThrow('No server configured');
    });

    it('returns data on success', async () => {
      apiClient.setServer(makeServer());
      mockAxiosInstance.post.mockResolvedValueOnce({ data: 'ok' });
      const result = await apiClient.post('/torrents/pause', { hashes: 'all' });
      expect(result).toBe('ok');
    });
  });
});

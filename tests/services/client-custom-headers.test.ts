/**
 * Tests that the apiClient request interceptor adds (or omits) custom HTTP
 * headers based on ServerConfig.useCustomHeaders / customHeaders (#228).
 */

jest.mock('@/services/connectivity-log', () => ({
  clogDebug: jest.fn(),
  clogInfo: jest.fn(),
  clogWarn: jest.fn(),
  clogError: jest.fn(),
}));

type RequestInterceptorFn = (config: Record<string, unknown>) => Record<string, unknown>;

let capturedRequestInterceptor: RequestInterceptorFn | null = null;

const mockAxiosInstance = {
  interceptors: {
    request: {
      use: jest.fn((fn: RequestInterceptorFn) => {
        capturedRequestInterceptor = fn;
      }),
    },
    response: {
      use: jest.fn(),
    },
  },
  defaults: { timeout: 10000 },
  post: jest.fn(),
  get: jest.fn(),
};

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
  AxiosError: class extends Error {},
}));

jest.mock('@/utils/apiVersion', () => ({
  getApiFeatures: jest.fn(() => ({})),
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

function runRequestInterceptor(server: ServerConfig): Record<string, unknown> {
  apiClient.setServer(server);
  if (!capturedRequestInterceptor) throw new Error('Request interceptor not captured');
  const config = { headers: {} as Record<string, string>, method: 'get', url: '/test' };
  return capturedRequestInterceptor(config) as Record<string, unknown>;
}

describe('apiClient request interceptor — custom headers', () => {
  afterEach(() => {
    apiClient.setServer(null);
  });

  it('does NOT add custom headers when useCustomHeaders is false', () => {
    const config = runRequestInterceptor(
      makeServer({
        useCustomHeaders: false,
        customHeaders: [{ key: 'X-Pangolin-Token', value: 'tok' }],
      }),
    );
    const headers = config.headers as Record<string, string>;
    expect(headers['X-Pangolin-Token']).toBeUndefined();
  });

  // Backwards compatibility (#228): a server saved before this feature has
  // neither field set, and must behave exactly as it did before.
  it('sends no extra headers for a legacy config with neither field set', () => {
    const config = runRequestInterceptor(makeServer());
    const headers = config.headers as Record<string, string>;
    expect(Object.keys(headers).sort()).toEqual(['Origin', 'Referer']);
  });

  it('does NOT add custom headers when useCustomHeaders is undefined but headers exist', () => {
    const config = runRequestInterceptor(
      makeServer({ customHeaders: [{ key: 'X-Pangolin-Token', value: 'tok' }] }),
    );
    const headers = config.headers as Record<string, string>;
    expect(headers['X-Pangolin-Token']).toBeUndefined();
  });

  it('does NOT add custom headers when the list is empty', () => {
    const config = runRequestInterceptor(makeServer({ useCustomHeaders: true, customHeaders: [] }));
    const headers = config.headers as Record<string, string>;
    expect(Object.keys(headers)).not.toContain('X-Pangolin-Token');
  });

  it('adds every configured header when useCustomHeaders is true', () => {
    const config = runRequestInterceptor(
      makeServer({
        useCustomHeaders: true,
        customHeaders: [
          { key: 'X-Pangolin-Token', value: 'tok-secret' },
          { key: 'X-Client-Id', value: 'client-123' },
        ],
      }),
    );
    const headers = config.headers as Record<string, string>;
    expect(headers['X-Pangolin-Token']).toBe('tok-secret');
    expect(headers['X-Client-Id']).toBe('client-123');
  });

  it('skips a header pair missing a key or value rather than crashing', () => {
    const config = runRequestInterceptor(
      makeServer({
        useCustomHeaders: true,
        customHeaders: [
          { key: '', value: 'orphaned' },
          { key: 'X-Ok', value: 'ok' },
        ],
      }),
    );
    const headers = config.headers as Record<string, string>;
    expect(headers['X-Ok']).toBe('ok');
    expect(Object.values(headers)).not.toContain('orphaned');
  });

  // Custom headers are applied last, so without an explicit guard a header
  // named Authorization/Cookie would clobber the real auth for the request.
  // Save-time validation is not the only way data reaches a ServerConfig.
  it('refuses to let a custom header override the real Authorization header', () => {
    const config = runRequestInterceptor(
      makeServer({
        useApiKey: true,
        apiKey: 'qbt_realkey1234567890123456789012',
        useCustomHeaders: true,
        customHeaders: [{ key: 'Authorization', value: 'Bearer attacker' }],
      }),
    );
    const headers = config.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer qbt_realkey1234567890123456789012');
  });

  it('refuses to let a custom header override Cookie, Referer, or Origin', () => {
    const config = runRequestInterceptor(
      makeServer({
        useCustomHeaders: true,
        customHeaders: [
          { key: 'Cookie', value: 'SID=attacker' },
          { key: 'referer', value: 'https://evil.example.com/' },
          { key: 'Origin', value: 'https://evil.example.com' },
        ],
      }),
    );
    const headers = config.headers as Record<string, string>;
    expect(headers['Cookie']).toBeUndefined();
    expect(headers['referer']).toBeUndefined();
    expect(headers['Referer']).toBe('http://example.com:8080/');
    expect(headers['Origin']).toBe('http://example.com:8080');
  });

  it('still sets Authorization alongside custom headers when both apply', () => {
    const config = runRequestInterceptor(
      makeServer({
        useApiKey: true,
        apiKey: 'qbt_abcdefghijklmnopqrstuvwx1234',
        useCustomHeaders: true,
        customHeaders: [{ key: 'X-Pangolin-Token', value: 'tok-secret' }],
      }),
    );
    const headers = config.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer qbt_abcdefghijklmnopqrstuvwx1234');
    expect(headers['X-Pangolin-Token']).toBe('tok-secret');
  });
});

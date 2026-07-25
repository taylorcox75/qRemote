/**
 * Tests that the apiClient request interceptor adds a Bearer Authorization
 * header for API-key auth, and that it takes precedence over proxy Basic Auth
 * since both use the same Authorization header.
 */

// --------------------------------------------------------------------------
// Mock connectivity-log (used by client.ts at import time)
// --------------------------------------------------------------------------
jest.mock('@/services/connectivity-log', () => ({
  clogDebug: jest.fn(),
  clogInfo: jest.fn(),
  clogWarn: jest.fn(),
  clogError: jest.fn(),
}));

// --------------------------------------------------------------------------
// Mock axios so the interceptor runs without a real network
// --------------------------------------------------------------------------
type RequestInterceptorFn = (config: Record<string, unknown>) => Record<string, unknown>;
type ResponseInterceptorSuccessFn = (response: unknown) => unknown;
type ResponseInterceptorErrorFn = (error: unknown) => unknown; // used in mock signature

let capturedRequestInterceptor: RequestInterceptorFn | null = null;
let capturedResponseInterceptorSuccess: ResponseInterceptorSuccessFn | null = null;

const mockAxiosInstance = {
  interceptors: {
    request: {
      use: jest.fn((fn: RequestInterceptorFn) => {
        capturedRequestInterceptor = fn;
      }),
    },
    response: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      use: jest.fn((success: ResponseInterceptorSuccessFn, _error: ResponseInterceptorErrorFn) => {
        capturedResponseInterceptorSuccess = success;
      }),
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

// --------------------------------------------------------------------------
// Mock apiVersion util
// --------------------------------------------------------------------------
jest.mock('@/utils/apiVersion', () => ({
  getApiFeatures: jest.fn(() => ({})),
}));

// --------------------------------------------------------------------------
// Import after mocks are established
// --------------------------------------------------------------------------
import { apiClient } from '@/services/api/client';
import type { ServerConfig } from '@/types/api';

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

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

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('apiClient request interceptor — API key auth', () => {
  afterEach(() => {
    apiClient.setServer(null);
  });

  it('does NOT add Authorization header when useApiKey is false', () => {
    const config = runRequestInterceptor(makeServer({ useApiKey: false, apiKey: 'qbt_abc' }));
    const headers = config.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('does NOT add Authorization header when useApiKey is true but apiKey is empty', () => {
    const config = runRequestInterceptor(makeServer({ useApiKey: true, apiKey: '' }));
    const headers = config.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('adds a Bearer Authorization header when useApiKey is true with a key', () => {
    const config = runRequestInterceptor(
      makeServer({ useApiKey: true, apiKey: 'qbt_abcdefghijklmnopqrstuvwx1234' }),
    );
    const headers = config.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer qbt_abcdefghijklmnopqrstuvwx1234');
  });

  it('API key (Bearer) takes precedence over proxy Basic Auth when both are configured', () => {
    const config = runRequestInterceptor(
      makeServer({
        useApiKey: true,
        apiKey: 'qbt_thekey',
        useBasicAuth: true,
        basicAuthUsername: 'proxyuser',
        basicAuthPassword: 'proxypass',
      }),
    );
    const headers = config.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer qbt_thekey');
  });

  it('falls back to Basic Auth when useApiKey is true but apiKey is empty', () => {
    const config = runRequestInterceptor(
      makeServer({
        useApiKey: true,
        apiKey: '',
        useBasicAuth: true,
        basicAuthUsername: 'proxyuser',
        basicAuthPassword: 'proxypass',
      }),
    );
    const headers = config.headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^Basic /);
  });

  it('still sets Cookie header alongside the Bearer Authorization header when both are present', () => {
    apiClient.setServer(makeServer({ useApiKey: true, apiKey: 'qbt_thekey' }));
    if (capturedResponseInterceptorSuccess) {
      capturedResponseInterceptorSuccess({
        headers: { 'set-cookie': 'SID=testcookie123; Path=/' },
        data: 'Ok.',
        status: 200,
      });
    }
    if (!capturedRequestInterceptor) throw new Error('Request interceptor not captured');
    const config = { headers: {} as Record<string, string>, method: 'get', url: '/test' };
    const result = capturedRequestInterceptor(config) as { headers: Record<string, string> };
    expect(result.headers['Authorization']).toBe('Bearer qbt_thekey');
    expect(result.headers['Cookie']).toContain('SID=testcookie123');
  });
});

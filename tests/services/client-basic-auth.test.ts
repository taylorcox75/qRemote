/**
 * Tests that the apiClient request interceptor adds (or omits) the
 * Authorization header based on the ServerConfig.useBasicAuth flag.
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
    set(key: string, value: string) { this.headers[key] = value; }
    get(key: string) { return this.headers[key]; }
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

describe('apiClient request interceptor — Basic Auth', () => {
  afterEach(() => {
    apiClient.setServer(null);
  });

  it('does NOT add Authorization header when useBasicAuth is false', () => {
    const config = runRequestInterceptor(makeServer({ useBasicAuth: false }));
    const headers = config.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('does NOT add Authorization header when useBasicAuth is undefined', () => {
    const config = runRequestInterceptor(makeServer());
    const headers = config.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('does NOT add Authorization header when useBasicAuth is true but username is empty', () => {
    const config = runRequestInterceptor(makeServer({ useBasicAuth: true, basicAuthUsername: '' }));
    const headers = config.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('adds a Basic Authorization header when useBasicAuth is true with credentials', () => {
    const config = runRequestInterceptor(
      makeServer({ useBasicAuth: true, basicAuthUsername: 'proxyuser', basicAuthPassword: 'proxypass' })
    );
    const headers = config.headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^Basic /);
  });

  it('Authorization header encodes the correct credentials', () => {
    const config = runRequestInterceptor(
      makeServer({ useBasicAuth: true, basicAuthUsername: 'admin', basicAuthPassword: 'secret' })
    );
    const headers = config.headers as Record<string, string>;
    const encoded = (headers['Authorization'] as string).slice(6);
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    expect(decoded).toBe('admin:secret');
  });

  it('coalesces undefined basicAuthPassword to empty string (no crash)', () => {
    const server = makeServer({ useBasicAuth: true, basicAuthUsername: 'user', basicAuthPassword: undefined });
    expect(() => runRequestInterceptor(server)).not.toThrow();
    const config = runRequestInterceptor(server);
    const headers = config.headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^Basic /);
    const encoded = (headers['Authorization'] as string).slice(6);
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    expect(decoded).toBe('user:');
  });

  it('still sets Cookie header alongside Authorization when both are present', () => {
    apiClient.setServer(
      makeServer({ useBasicAuth: true, basicAuthUsername: 'u', basicAuthPassword: 'p' })
    );
    // Manually inject a cookie by simulating a captured response
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
    expect(result.headers['Authorization']).toMatch(/^Basic /);
    expect(result.headers['Cookie']).toContain('SID=testcookie123');
  });
});

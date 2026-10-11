/**
 * qui Client Proxy (#272, #278) over real HTTP — real axios, apiClient and
 * ServerManager against a local server routed the way qui routes: the key is
 * the single path segment after `/proxy/`, and any other value gets qui's 401
 * "Invalid API key". client-qui-proxy.test.ts mocks axios, so only this suite
 * proves the key reaches the server byte-for-byte.
 */
jest.mock('@/services/storage', () => ({
  storageService: {
    setCurrentServerId: jest.fn(),
    setManualDisconnect: jest.fn(),
  },
}));

jest.mock('@/modules/insecure-cert-allowlist', () => ({
  setInsecureCertAllowedHosts: jest.fn(),
  isInsecureCertAllowlistAvailable: jest.fn(() => true),
}));

jest.mock('@/services/connectivity-log', () => ({
  clogDebug: jest.fn(),
  clogInfo: jest.fn(),
  clogWarn: jest.fn(),
  clogError: jest.fn(),
}));

import http from 'http';
import { AddressInfo } from 'net';
import { ServerManager } from '@/services/server-manager';
import { apiClient } from '@/services/api/client';
import type { ServerConfig } from '@/types/api';
import { applyServerAuthMode } from '@/utils/authMode';
import { QUI_KEY_REJECTED_MESSAGE, parseQuiProxyUrl } from '@/utils/quiProxy';

const KEY = 'a3f1c2e4b5d6a7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f70';

let server: http.Server;
let port = 0;
const requests: string[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const path = (req.url || '').split('?')[0];
    requests.push(`${req.method} ${path}`);
    const match = /^\/qui\/proxy\/([^/]*)(\/.*)?$/.exec(path);
    if (!match) {
      res.writeHead(404).end('404 page not found');
      return;
    }
    if (match[1] !== KEY) {
      res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Invalid API key\n');
      return;
    }
    const replies: Record<string, string> = {
      '/api/v2/app/version': 'v5.2.2',
      '/api/v2/app/webapiVersion': '2.14.1',
    };
    const body = replies[match[2] ?? ''];
    if (body) res.writeHead(200).end(body);
    else res.writeHead(404).end('Not Found');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  requests.length = 0;
  apiClient.setServer(null);
});

/** A qui server exactly as app/server/add.tsx builds it from a pasted URL. */
function quiServer(url: string, id = '1'): ServerConfig {
  const parsed = parseQuiProxyUrl(url);
  if (!parsed.ok) throw new Error(`unparseable test URL: ${parsed.error}`);
  return {
    id,
    name: 'qui',
    host: parsed.host,
    port: parsed.port,
    basePath: parsed.basePath,
    useHttps: parsed.useHttps,
    ...applyServerAuthMode('quiProxy', {
      username: '',
      password: '',
      apiKey: '',
      quiProxyKey: parsed.key,
    }),
  };
}

it('connects with the key intact in every request path and no login call', async () => {
  await expect(
    ServerManager.connectToServer(quiServer(`http://127.0.0.1:${port}/qui/proxy/${KEY}`)),
  ).resolves.toBe(true);
  expect(requests.sort()).toEqual([
    `GET /qui/proxy/${KEY}/api/v2/app/version`,
    `GET /qui/proxy/${KEY}/api/v2/app/webapiVersion`,
  ]);
});

it('passes Test Connection', async () => {
  const result = await ServerManager.testConnection(
    quiServer(`http://127.0.0.1:${port}/qui/proxy/${KEY}/`, 'test-1'),
  );
  expect(result).toEqual({ success: true });
});

it("maps qui's plain-text 401 for a wrong key to the key-rejected message", async () => {
  await expect(
    ServerManager.connectToServer(
      quiServer(`http://127.0.0.1:${port}/qui/proxy/${'0'.repeat(64)}`),
    ),
  ).rejects.toThrow(QUI_KEY_REJECTED_MESSAGE);
});

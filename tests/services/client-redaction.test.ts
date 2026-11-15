jest.mock('@/services/connectivity-log', () => ({
  clogDebug: jest.fn(),
  clogInfo: jest.fn(),
  clogWarn: jest.fn(),
  clogError: jest.fn(),
}));

import { apiClient, describeCookieJar, maskSecret, redactHeaderValue } from '@/services/api/client';
import type { ServerConfig } from '@/types/api';

const SID = 'abcdefghijklmnopqrstuvwxyz012345';

describe('maskSecret', () => {
  it('reveals only the length', () => {
    expect(maskSecret(SID)).toBe('•••• (32 chars)');
    expect(maskSecret(SID)).not.toContain('abcd');
  });
  it('hides short values the same way', () => {
    expect(maskSecret('abc')).toBe('•••• (3 chars)');
    expect(maskSecret('')).toBe('');
  });
});

describe('describeCookieJar', () => {
  it('keeps cookie names and masks values', () => {
    const out = describeCookieJar(`SID=${SID}; __cf_bm=zzzzzzzzzz`);
    expect(out).toBe('SID=•••• (32 chars); __cf_bm=•••• (10 chars)');
    expect(out).not.toContain(SID);
  });
});

describe('redactHeaderValue', () => {
  it('masks set-cookie values and drops attributes, keeping names', () => {
    const out = redactHeaderValue('set-cookie', [
      `SID=${SID}; HttpOnly; path=/`,
      'QBT_SID_8080=secretsecret; SameSite=Strict',
    ]);
    expect(out).toBe('SID=•••• (32 chars); QBT_SID_8080=•••• (12 chars)');
    expect(out).not.toContain(SID);
  });

  it('keeps the Authorization scheme but not the credential', () => {
    expect(redactHeaderValue('Authorization', 'Basic dXNlcjpwYXNzd29yZA==')).toBe(
      'Basic •••• (20 chars)',
    );
    expect(redactHeaderValue('authorization', 'Bearer qbt_0123456789')).toBe(
      'Bearer •••• (14 chars)',
    );
  });

  it('passes other headers through', () => {
    expect(redactHeaderValue('content-type', 'text/plain')).toBe('text/plain');
    expect(redactHeaderValue('vary', ['a', 'b'])).toBe('a; b');
  });
});

describe('createIsolatedClient', () => {
  it('returns a separate client that leaves the shared one untouched', () => {
    const live = { id: 'live', host: 'live.example' } as ServerConfig;
    const test = { id: 'test', host: 'test.example' } as ServerConfig;
    apiClient.setServer(live);
    const isolated = apiClient.createIsolatedClient(test);
    expect(isolated).not.toBe(apiClient);
    expect(isolated.getServer()).toBe(test);
    expect(apiClient.getServer()).toBe(live);
    isolated.clearCookies();
    expect(apiClient.getServer()).toBe(live);
    apiClient.setServer(null);
  });
});

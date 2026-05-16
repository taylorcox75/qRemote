/**
 * Tests for the authApi.login flow.
 *
 * Specifically covers compatibility with both qBittorrent 4.x (200 + body)
 * and 5.x (204 + Set-Cookie) login response shapes, as well as failure paths.
 */
import { AxiosError } from 'axios';

const postUrlEncoded = jest.fn();
const clearCookies = jest.fn();
const getCookies = jest.fn();

jest.mock('@/services/api/client', () => ({
  apiClient: {
    postUrlEncoded: (...args: unknown[]) => postUrlEncoded(...args),
    clearCookies: (...args: unknown[]) => clearCookies(...args),
    getCookies: (...args: unknown[]) => getCookies(...args),
  },
}));

jest.mock('@/services/connectivity-log', () => ({
  clogInfo: jest.fn(),
  clogWarn: jest.fn(),
  clogError: jest.fn(),
  clogDebug: jest.fn(),
}));

import { authApi } from '@/services/api/auth';

describe('authApi.login', () => {
  beforeEach(() => {
    postUrlEncoded.mockReset();
    clearCookies.mockReset();
    getCookies.mockReset();
  });

  it('returns Ok for qBittorrent 4.x style response ("Ok." body with cookie)', async () => {
    postUrlEncoded.mockResolvedValue('Ok.');
    getCookies.mockReturnValue('SID=abc123');

    const result = await authApi.login('admin', 'adminadmin');

    expect(result).toEqual({ status: 'Ok' });
    expect(clearCookies).toHaveBeenCalledTimes(1);
    expect(postUrlEncoded).toHaveBeenCalledWith(
      '/api/v2/auth/login',
      { username: 'admin', password: 'adminadmin' },
      undefined,
    );
  });

  it('returns Ok for qBittorrent 5.x style response (empty body + Set-Cookie -> 204)', async () => {
    // qBittorrent 5.x returns 204 No Content; axios resolves with empty data
    postUrlEncoded.mockResolvedValue('');
    getCookies.mockReturnValue('QBT_SID_8085=j5+9VCL3vcRVIwrKJtFN4gp+3IIcINj5');

    const result = await authApi.login('admin', 'workspace');

    expect(result).toEqual({ status: 'Ok' });
  });

  it('returns Ok for "Ok" body without trailing period', async () => {
    postUrlEncoded.mockResolvedValue('Ok');
    getCookies.mockReturnValue('SID=abc123');

    const result = await authApi.login('admin', 'pw');

    expect(result).toEqual({ status: 'Ok' });
  });

  it('trims whitespace around response body before comparing', async () => {
    postUrlEncoded.mockResolvedValue('  Ok.\n');
    getCookies.mockReturnValue('SID=abc123');

    const result = await authApi.login('admin', 'pw');

    expect(result).toEqual({ status: 'Ok' });
  });

  it('returns Fails for qBittorrent 4.x failure ("Fails." body)', async () => {
    postUrlEncoded.mockResolvedValue('Fails.');
    getCookies.mockReturnValue('');

    const result = await authApi.login('admin', 'wrong');

    expect(result).toEqual({ status: 'Fails' });
  });

  it('returns Fails when body is "Fails." even if a cookie is somehow set', async () => {
    // Defensive: an explicit "Fails." body always wins over a stray cookie.
    postUrlEncoded.mockResolvedValue('Fails.');
    getCookies.mockReturnValue('SID=stale');

    const result = await authApi.login('admin', 'wrong');

    expect(result).toEqual({ status: 'Fails' });
  });

  it('returns Fails when body is empty and no cookie was set', async () => {
    postUrlEncoded.mockResolvedValue('');
    getCookies.mockReturnValue('');

    const result = await authApi.login('admin', 'wrong');

    expect(result).toEqual({ status: 'Fails' });
  });

  it('returns Fails when the request throws a non-network error', async () => {
    postUrlEncoded.mockRejectedValue(new Error('Unauthorized'));
    getCookies.mockReturnValue('');

    const result = await authApi.login('admin', 'wrong');

    expect(result).toEqual({ status: 'Fails' });
  });

  it('re-throws cancellation errors instead of returning Fails', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    postUrlEncoded.mockRejectedValue(abortErr);
    getCookies.mockReturnValue('');

    await expect(authApi.login('admin', 'pw')).rejects.toBe(abortErr);
  });

  it('re-throws network/timeout errors instead of returning Fails', async () => {
    postUrlEncoded.mockRejectedValue(new Error('Connection timeout'));
    getCookies.mockReturnValue('');

    await expect(authApi.login('admin', 'pw')).rejects.toThrow('Connection timeout');
  });

  it('translates HTTP 403 into a user-facing authentication error', async () => {
    const axiosErr = new AxiosError('Forbidden');
    axiosErr.response = { status: 403 } as AxiosError['response'];
    postUrlEncoded.mockRejectedValue(axiosErr);
    getCookies.mockReturnValue('');

    await expect(authApi.login('admin', 'pw')).rejects.toThrow(
      'Authentication failed. Please check your username and password.',
    );
  });

  it('clears existing cookies before attempting login', async () => {
    postUrlEncoded.mockResolvedValue('Ok.');
    getCookies.mockReturnValue('SID=abc');

    await authApi.login('admin', 'pw');

    // clearCookies must be called before postUrlEncoded.
    const clearOrder = clearCookies.mock.invocationCallOrder[0];
    const postOrder = postUrlEncoded.mock.invocationCallOrder[0];
    expect(clearOrder).toBeLessThan(postOrder);
  });
});

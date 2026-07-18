import {
  AVATAR_PALETTE,
  avatarColor,
  serverAddress,
  hasFallback,
  resolveServerEndpoint,
  getServerEndpointLabel,
  getActiveEndpoint,
} from '@/utils/server';
import { ServerConfig } from '@/types/api';

const baseServer: ServerConfig = {
  id: 'srv1',
  name: 'My Server',
  host: 'example.com',
  port: 8080,
  username: 'user',
  password: 'pass',
  useHttps: false,
};

describe('avatarColor', () => {
  it('returns a color from the palette', () => {
    expect(AVATAR_PALETTE).toContain(avatarColor('Home Server'));
  });

  it('is deterministic for the same name', () => {
    expect(avatarColor('Home Server')).toBe(avatarColor('Home Server'));
  });

  it('handles empty string', () => {
    expect(AVATAR_PALETTE).toContain(avatarColor(''));
  });
});

describe('serverAddress', () => {
  it('includes the port when set and positive', () => {
    expect(serverAddress(baseServer)).toBe('example.com:8080');
  });

  it('omits the port when 0', () => {
    expect(serverAddress({ ...baseServer, port: 0 })).toBe('example.com');
  });

  it('omits the port when undefined', () => {
    expect(serverAddress({ ...baseServer, port: undefined })).toBe('example.com');
  });
});

describe('hasFallback', () => {
  it('returns false when useFallback is not set', () => {
    expect(hasFallback(baseServer)).toBe(false);
  });

  it('returns false when useFallback is true but fallbackHost is empty', () => {
    expect(hasFallback({ ...baseServer, useFallback: true, fallbackHost: '   ' })).toBe(false);
  });

  it('returns false when useFallback is true but fallbackHost is undefined', () => {
    expect(hasFallback({ ...baseServer, useFallback: true })).toBe(false);
  });

  it('returns true when useFallback is true and fallbackHost is set', () => {
    expect(hasFallback({ ...baseServer, useFallback: true, fallbackHost: 'fallback.com' })).toBe(
      true,
    );
  });
});

describe('resolveServerEndpoint', () => {
  it('returns the trimmed primary host/basePath for "primary"', () => {
    const server = { ...baseServer, host: '  example.com  ', basePath: undefined };
    const resolved = resolveServerEndpoint(server, 'primary');
    expect(resolved.host).toBe('example.com');
    expect(resolved.basePath).toBe('/');
  });

  it('keeps an explicit basePath for primary', () => {
    const resolved = resolveServerEndpoint({ ...baseServer, basePath: '/qbt' }, 'primary');
    expect(resolved.basePath).toBe('/qbt');
  });

  it('falls back to primary resolution when endpoint is "fallback" but no fallback is configured', () => {
    const resolved = resolveServerEndpoint(baseServer, 'fallback');
    expect(resolved.host).toBe('example.com');
  });

  it('resolves the fallback host/port/https/basePath when configured', () => {
    const server: ServerConfig = {
      ...baseServer,
      useFallback: true,
      fallbackHost: ' fallback.com ',
      fallbackPort: 9090,
      fallbackUseHttps: true,
      fallbackBasePath: '/alt',
    };
    const resolved = resolveServerEndpoint(server, 'fallback');
    expect(resolved.host).toBe('fallback.com');
    expect(resolved.port).toBe(9090);
    expect(resolved.useHttps).toBe(true);
    expect(resolved.basePath).toBe('/alt');
  });

  it('falls back to primary useHttps/basePath when fallback overrides are unset', () => {
    const server: ServerConfig = {
      ...baseServer,
      useHttps: true,
      basePath: '/primary-path',
      useFallback: true,
      fallbackHost: 'fallback.com',
    };
    const resolved = resolveServerEndpoint(server, 'fallback');
    expect(resolved.useHttps).toBe(true);
    expect(resolved.basePath).toBe('/primary-path');
  });

  it('defaults fallback basePath to "/" when neither fallback nor primary basePath is set', () => {
    const server: ServerConfig = {
      ...baseServer,
      basePath: undefined,
      useFallback: true,
      fallbackHost: 'fallback.com',
    };
    const resolved = resolveServerEndpoint(server, 'fallback');
    expect(resolved.basePath).toBe('/');
  });
});

describe('getServerEndpointLabel', () => {
  it('returns the address string for the primary endpoint', () => {
    expect(getServerEndpointLabel(baseServer, 'primary')).toBe('example.com:8080');
  });

  it('returns the address string for the fallback endpoint', () => {
    const server: ServerConfig = {
      ...baseServer,
      useFallback: true,
      fallbackHost: 'fallback.com',
      fallbackPort: 443,
    };
    expect(getServerEndpointLabel(server, 'fallback')).toBe('fallback.com:443');
  });
});

describe('getActiveEndpoint', () => {
  it('returns null when activeServer is null', () => {
    expect(getActiveEndpoint(baseServer, null)).toBeNull();
  });

  it('returns null when activeServer has a different id', () => {
    expect(getActiveEndpoint(baseServer, { ...baseServer, id: 'other' })).toBeNull();
  });

  it('returns "primary" when activeServer matches the primary endpoint', () => {
    expect(getActiveEndpoint(baseServer, { ...baseServer })).toBe('primary');
  });

  it('returns null when active matches neither primary nor a configured fallback', () => {
    const activeServer: ServerConfig = { ...baseServer, host: 'other.com' };
    expect(getActiveEndpoint(baseServer, activeServer)).toBeNull();
  });

  it('returns "fallback" when activeServer matches the fallback endpoint', () => {
    const server: ServerConfig = {
      ...baseServer,
      useFallback: true,
      fallbackHost: 'fallback.com',
      fallbackPort: 9090,
      fallbackUseHttps: true,
    };
    const activeServer: ServerConfig = {
      ...server,
      host: 'fallback.com',
      port: 9090,
      useHttps: true,
    };
    expect(getActiveEndpoint(server, activeServer)).toBe('fallback');
  });

  it('returns null when active matches neither primary nor fallback and fallback is not configured', () => {
    const activeServer: ServerConfig = { ...baseServer, host: 'unrelated.com' };
    expect(getActiveEndpoint(baseServer, activeServer)).toBeNull();
  });

  it('treats port 0/undefined as equivalent when comparing to primary', () => {
    const server = { ...baseServer, port: undefined };
    const activeServer: ServerConfig = { ...baseServer, port: 0 };
    expect(getActiveEndpoint(server, activeServer)).toBe('primary');
  });
});

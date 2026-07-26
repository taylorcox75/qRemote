import {
  buildServerExport,
  parseServerImport,
  toExportedServer,
  SERVER_EXPORT_KIND,
  SERVER_EXPORT_VERSION,
} from '@/utils/server-export';
import type { ServerConfig } from '@/types/api';

function makeServer(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    id: 's1',
    name: 'Home',
    host: 'nas.local',
    port: 8080,
    basePath: '/qbt',
    username: 'admin',
    password: 'super-secret',
    useHttps: true,
    bypassAuth: false,
    useFallback: true,
    fallbackHost: 'example.ddns.net',
    fallbackPort: 443,
    fallbackUseHttps: true,
    fallbackBasePath: '/qbt',
    useBasicAuth: true,
    basicAuthUsername: 'proxyuser',
    basicAuthPassword: 'proxy-secret',
    useApiKey: false,
    apiKey: 'key-secret',
    ...overrides,
  };
}

describe('toExportedServer', () => {
  it('strips every secret', () => {
    const exported = toExportedServer(makeServer());
    expect(exported.password).toBe('');
    expect(exported.basicAuthPassword).toBe('');
    expect(exported.apiKey).toBe('');
  });

  it('keeps connection settings, auth flags, and usernames', () => {
    const exported = toExportedServer(makeServer());
    expect(exported).toMatchObject({
      id: 's1',
      name: 'Home',
      host: 'nas.local',
      port: 8080,
      basePath: '/qbt',
      username: 'admin',
      useHttps: true,
      useFallback: true,
      fallbackHost: 'example.ddns.net',
      fallbackPort: 443,
      fallbackUseHttps: true,
      fallbackBasePath: '/qbt',
      useBasicAuth: true,
      basicAuthUsername: 'proxyuser',
      useApiKey: false,
    });
  });

  it('drops invalid ports instead of exporting garbage', () => {
    const exported = toExportedServer(makeServer({ port: 0, fallbackPort: 70000 }));
    expect(exported.port).toBeUndefined();
    expect(exported.fallbackPort).toBeUndefined();
  });
});

describe('buildServerExport', () => {
  it('wraps servers in a recognizable envelope', () => {
    const now = new Date('2026-07-26T00:00:00.000Z');
    const file = buildServerExport([makeServer()], now);
    expect(file.kind).toBe(SERVER_EXPORT_KIND);
    expect(file.version).toBe(SERVER_EXPORT_VERSION);
    expect(file.exportedAt).toBe('2026-07-26T00:00:00.000Z');
    expect(file.servers).toHaveLength(1);
  });

  it('never serializes a secret', () => {
    const json = JSON.stringify(buildServerExport([makeServer()]));
    expect(json).not.toContain('super-secret');
    expect(json).not.toContain('proxy-secret');
    expect(json).not.toContain('key-secret');
  });
});

describe('parseServerImport', () => {
  it('round-trips an export', () => {
    const json = JSON.stringify(
      buildServerExport([
        makeServer(),
        makeServer({ id: 's2', name: 'Remote', host: 'remote.example.com' }),
      ]),
    );
    const servers = parseServerImport(json);
    expect(servers).toHaveLength(2);
    expect(servers[0]).toMatchObject({ id: 's1', name: 'Home', host: 'nas.local' });
    expect(servers[1]).toMatchObject({ id: 's2', name: 'Remote' });
  });

  it('rejects non-JSON text', () => {
    expect(() => parseServerImport('not json at all')).toThrow('Not a valid JSON file.');
  });

  it('rejects JSON that is not a qRemote server export', () => {
    expect(() => parseServerImport('{"preferences":{},"servers":[]}')).toThrow(
      'Not a qRemote server export file.',
    );
    expect(() => parseServerImport('[1,2,3]')).toThrow('Not a qRemote server export file.');
  });

  it('rejects an export with no usable entries', () => {
    const json = JSON.stringify({
      kind: SERVER_EXPORT_KIND,
      version: SERVER_EXPORT_VERSION,
      exportedAt: '2026-07-26T00:00:00.000Z',
      servers: [{ name: '', host: '' }, null, 'junk'],
    });
    expect(() => parseServerImport(json)).toThrow('The file contains no usable server entries.');
  });

  it('skips invalid entries but keeps valid ones', () => {
    const json = JSON.stringify({
      kind: SERVER_EXPORT_KIND,
      version: SERVER_EXPORT_VERSION,
      exportedAt: '2026-07-26T00:00:00.000Z',
      servers: [{ name: 'Valid', host: 'ok.example.com' }, { host: 'no-name.example.com' }],
    });
    const servers = parseServerImport(json);
    expect(servers).toHaveLength(1);
    expect(servers[0].name).toBe('Valid');
    // Entries without an id get one generated so they can still be saved.
    expect(servers[0].id.length).toBeGreaterThan(0);
  });

  it('forces secrets empty even when a crafted file contains them', () => {
    const json = JSON.stringify({
      kind: SERVER_EXPORT_KIND,
      version: SERVER_EXPORT_VERSION,
      exportedAt: '2026-07-26T00:00:00.000Z',
      servers: [
        {
          id: 'crafted',
          name: 'Crafted',
          host: 'evil.example.com',
          password: 'injected',
          basicAuthPassword: 'injected',
          apiKey: 'injected',
        },
      ],
    });
    const [server] = parseServerImport(json);
    expect(server.password).toBe('');
    expect(server.basicAuthPassword).toBe('');
    expect(server.apiKey).toBe('');
  });
});

import {
  QUI_KEY_MASK,
  QUI_KEY_REJECTED_MESSAGE,
  buildQuiProxyUrl,
  detectQuiProxyUrlInHost,
  isQuiKeyRejection,
  parseQuiProxyUrl,
  redactQuiProxyKey,
  withQuiProxyPath,
} from '@/utils/quiProxy';

describe('parseQuiProxyUrl', () => {
  it('parses a plain https URL with no port or base path', () => {
    expect(parseQuiProxyUrl('https://qui.example.com/proxy/abc123')).toEqual({
      ok: true,
      useHttps: true,
      host: 'qui.example.com',
      port: undefined,
      basePath: '/',
      key: 'abc123',
    });
  });

  it('parses http with an explicit port', () => {
    expect(parseQuiProxyUrl('http://192.168.1.10:7476/proxy/abc123')).toEqual({
      ok: true,
      useHttps: false,
      host: '192.168.1.10',
      port: 7476,
      basePath: '/',
      key: 'abc123',
    });
  });

  it('keeps a qui base path (qui served from a sub-path)', () => {
    expect(parseQuiProxyUrl('https://example.com:8443/qui/proxy/abc123')).toEqual({
      ok: true,
      useHttps: true,
      host: 'example.com',
      port: 8443,
      basePath: '/qui',
      key: 'abc123',
    });
  });

  it('keeps a multi-segment base path', () => {
    const result = parseQuiProxyUrl('https://example.com/apps/qui/proxy/abc123');
    expect(result).toMatchObject({ ok: true, basePath: '/apps/qui', key: 'abc123' });
  });

  it('accepts a trailing slash after the key', () => {
    const result = parseQuiProxyUrl('https://qui.example.com/qui/proxy/abc123/');
    expect(result).toMatchObject({ ok: true, basePath: '/qui', key: 'abc123' });
  });

  it('trims surrounding whitespace and newlines (pasted text)', () => {
    const result = parseQuiProxyUrl('  \nhttps://qui.example.com/proxy/abc123\t\n');
    expect(result).toMatchObject({ ok: true, host: 'qui.example.com', key: 'abc123' });
  });

  it('matches the scheme case-insensitively and lowercases it', () => {
    expect(parseQuiProxyUrl('HTTPS://qui.example.com/proxy/abc123')).toMatchObject({
      ok: true,
      useHttps: true,
    });
  });

  it('collapses empty path segments', () => {
    const result = parseQuiProxyUrl('https://qui.example.com//qui//proxy//abc123');
    expect(result).toMatchObject({ ok: true, basePath: '/qui', key: 'abc123' });
  });

  it('accepts an IPv6 literal with a port', () => {
    expect(parseQuiProxyUrl('http://[fd00::1]:7476/proxy/abc123')).toMatchObject({
      ok: true,
      host: '[fd00::1]',
      port: 7476,
    });
  });

  it('treats a base path that itself contains "proxy" correctly', () => {
    const result = parseQuiProxyUrl('https://example.com/proxy/proxy/abc123');
    expect(result).toMatchObject({ ok: true, basePath: '/proxy', key: 'abc123' });
  });

  it('keeps long hex keys intact', () => {
    const key = 'a'.repeat(64);
    expect(parseQuiProxyUrl(`https://q.example.com/proxy/${key}`)).toMatchObject({ ok: true, key });
  });

  describe('rejects bad input', () => {
    it.each(['', '   ', '\n'])('empty input %j', (input) => {
      expect(parseQuiProxyUrl(input)).toEqual({ ok: false, error: 'empty' });
    });

    it('rejects undefined/null defensively', () => {
      expect(parseQuiProxyUrl(undefined as unknown as string)).toEqual({
        ok: false,
        error: 'empty',
      });
    });

    it.each([
      'qui.example.com/proxy/abc123',
      '//qui.example.com/proxy/abc123',
      'ftp://qui.example.com/proxy/abc123',
      'example.com:7476/proxy/abc123',
    ])('requires an explicit http(s) scheme: %s', (input) => {
      expect(parseQuiProxyUrl(input)).toEqual({ ok: false, error: 'scheme' });
    });

    it.each([
      'https://qui.example.com',
      'https://qui.example.com/',
      'https://qui.example.com/proxy',
      'https://qui.example.com/proxy/',
      'https://qui.example.com/qui/proxy',
      'https://qui.example.com/abc123',
      'https://qui.example.com/qui/abc123',
    ])('requires /proxy/<key> at the end: %s', (input) => {
      expect(parseQuiProxyUrl(input)).toEqual({ ok: false, error: 'proxyPath' });
    });

    it('rejects path segments after the key (pasted API path)', () => {
      expect(parseQuiProxyUrl('https://q.example.com/proxy/abc123/api/v2/app/version')).toEqual({
        ok: false,
        error: 'proxyPath',
      });
    });

    it.each([
      'https:///proxy/abc123',
      'https://user:pass@q.example.com/proxy/abc123',
      'https://q.example.com/proxy/abc123?foo=bar',
      'https://q.example.com/proxy/abc123#frag',
      'https://q.example.com/proxy/abc 123',
      'https://[::1/proxy/abc123',
    ])('rejects an unusable host or stray URL parts: %s', (input) => {
      expect(parseQuiProxyUrl(input)).toEqual({ ok: false, error: 'host' });
    });

    it.each([
      'https://q.example.com:/proxy/abc123',
      'https://q.example.com:abc/proxy/abc123',
      'https://q.example.com:0/proxy/abc123',
      'https://q.example.com:65536/proxy/abc123',
      'https://q.example.com:1:2/proxy/abc123',
    ])('rejects an invalid port: %s', (input) => {
      expect(parseQuiProxyUrl(input)).toEqual({ ok: false, error: 'port' });
    });

    it('accepts the port range edges', () => {
      expect(parseQuiProxyUrl('http://h:1/proxy/k')).toMatchObject({ ok: true, port: 1 });
      expect(parseQuiProxyUrl('http://h:65535/proxy/k')).toMatchObject({ ok: true, port: 65535 });
    });
  });
});

describe('detectQuiProxyUrlInHost (#278)', () => {
  // qui keys are 32 random bytes in hex.
  const KEY = 'a3f1c2e4b5d6a7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f70';

  it('returns a pasted proxy URL unchanged', () => {
    expect(detectQuiProxyUrlInHost(`http://192.168.1.10:7476/proxy/${KEY}`, false)).toBe(
      `http://192.168.1.10:7476/proxy/${KEY}`,
    );
    expect(detectQuiProxyUrlInHost(`  https://qui.example.com/qui/proxy/${KEY}/ `, false)).toBe(
      `https://qui.example.com/qui/proxy/${KEY}/`,
    );
  });

  it('adds a scheme from the HTTPS toggle when the paste has none', () => {
    expect(detectQuiProxyUrlInHost(`qui.example.com/proxy/${KEY}`, true)).toBe(
      `https://qui.example.com/proxy/${KEY}`,
    );
    expect(detectQuiProxyUrlInHost(`10.0.0.2:7476/proxy/${KEY}`, false)).toBe(
      `http://10.0.0.2:7476/proxy/${KEY}`,
    );
  });

  it.each(['192.168.1.10', 'qbit.example.com', 'http://qbit.example.com:8080', ''])(
    'ignores an ordinary host (%j)',
    (host) => {
      expect(detectQuiProxyUrlInHost(host, false)).toBeNull();
    },
  );

  it('ignores a /proxy/ path that is not a qui-generated key', () => {
    // A real qBittorrent behind a reverse proxy at /proxy/<name> must stay as typed.
    expect(detectQuiProxyUrlInHost('https://example.com/proxy/qbittorrent', false)).toBeNull();
    expect(detectQuiProxyUrlInHost('https://example.com/proxy/abc123', false)).toBeNull();
  });

  it('ignores an unfinished paste or anything after the key', () => {
    expect(detectQuiProxyUrlInHost('https://qui.example.com/proxy/', false)).toBeNull();
    expect(detectQuiProxyUrlInHost(`https://qui.example.com/proxy/${KEY}/api`, false)).toBeNull();
  });
});

describe('withQuiProxyPath', () => {
  it('joins the base path, /proxy/ and the key', () => {
    expect(withQuiProxyPath('/qui', 'abc')).toBe('/qui/proxy/abc');
  });

  it.each([undefined, '', '/', '//'])('uses /proxy/<key> for an empty base (%j)', (base) => {
    expect(withQuiProxyPath(base, 'abc')).toBe('/proxy/abc');
  });

  it('normalizes missing leading and extra trailing slashes', () => {
    expect(withQuiProxyPath('qui/', 'abc')).toBe('/qui/proxy/abc');
    expect(withQuiProxyPath('/a//b/', 'abc')).toBe('/a/b/proxy/abc');
  });
});

describe('buildQuiProxyUrl', () => {
  it('rebuilds the URL a user would paste', () => {
    expect(
      buildQuiProxyUrl({
        host: 'qui.example.com',
        port: 8443,
        useHttps: true,
        basePath: '/qui',
        quiProxyKey: 'abc123',
      }),
    ).toBe('https://qui.example.com:8443/qui/proxy/abc123');
  });

  it('omits the port and base path when absent', () => {
    expect(buildQuiProxyUrl({ host: 'q.example.com', quiProxyKey: 'k' })).toBe(
      'http://q.example.com/proxy/k',
    );
  });

  it('ends at /proxy/ when the key is unknown (imported server) so only the key is missing', () => {
    expect(buildQuiProxyUrl({ host: 'q.example.com', useHttps: true, basePath: '/qui' })).toBe(
      'https://q.example.com/qui/proxy/',
    );
  });

  it('returns an empty string without a host', () => {
    expect(buildQuiProxyUrl({ host: '', quiProxyKey: 'k' })).toBe('');
  });

  it('round-trips through parseQuiProxyUrl', () => {
    const input = 'https://qui.example.com:8443/apps/qui/proxy/abcDEF123';
    const parsed = parseQuiProxyUrl(input);
    if (!parsed.ok) throw new Error('expected a valid URL');
    expect(
      buildQuiProxyUrl({
        host: parsed.host,
        port: parsed.port,
        useHttps: parsed.useHttps,
        basePath: parsed.basePath,
        quiProxyKey: parsed.key,
      }),
    ).toBe(input);
  });
});

describe('redactQuiProxyKey', () => {
  it('masks the key in a URL', () => {
    expect(redactQuiProxyKey('https://q.example.com/proxy/secretkey/api/v2/app/version')).toBe(
      `https://q.example.com/proxy/${QUI_KEY_MASK}/api/v2/app/version`,
    );
  });

  it('masks a key at the end of the string', () => {
    expect(redactQuiProxyKey('https://q.example.com/qui/proxy/secretkey')).toBe(
      `https://q.example.com/qui/proxy/${QUI_KEY_MASK}`,
    );
  });

  it('masks every occurrence in a multi-line message', () => {
    const text = [
      'GET http://h/proxy/key1/api/v2/torrents/info',
      'Endpoint not found: https://h:8443/qui/proxy/key2/api/v2/sync/maindata. Check version.',
      'Retrying (https://h/proxy/key1)',
    ].join('\n');
    const redacted = redactQuiProxyKey(text);
    expect(redacted).not.toContain('key1');
    expect(redacted).not.toContain('key2');
    expect(redacted.match(new RegExp(QUI_KEY_MASK, 'g'))).toHaveLength(3);
    // Surrounding text and punctuation survive.
    expect(redacted).toContain('Check version.');
    expect(redacted).toContain(`(https://h/proxy/${QUI_KEY_MASK})`);
  });

  it('is idempotent', () => {
    const once = redactQuiProxyKey('https://h/proxy/secretkey/api');
    expect(redactQuiProxyKey(once)).toBe(once);
  });

  it('leaves text without a proxy path untouched', () => {
    const text = 'GET https://h/api/v2/app/version';
    expect(redactQuiProxyKey(text)).toBe(text);
    expect(redactQuiProxyKey('')).toBe('');
  });

  it('does not touch the word "proxy" outside a /proxy/<key> path', () => {
    expect(redactQuiProxyKey('Proxy Basic Auth failed; proxy server unreachable')).toBe(
      'Proxy Basic Auth failed; proxy server unreachable',
    );
  });
});

describe('isQuiKeyRejection', () => {
  it("recognizes the client's key-rejection error", () => {
    expect(isQuiKeyRejection(new Error(QUI_KEY_REJECTED_MESSAGE))).toBe(true);
    expect(isQuiKeyRejection(QUI_KEY_REJECTED_MESSAGE)).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isQuiKeyRejection(new Error('Authentication failed.'))).toBe(false);
    expect(isQuiKeyRejection(null)).toBe(false);
    expect(isQuiKeyRejection(undefined)).toBe(false);
  });
});

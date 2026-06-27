import { basicAuthHeader } from '@/utils/basicAuth';

describe('basicAuthHeader', () => {
  it('encodes ASCII credentials to a valid Basic header', () => {
    // RFC 7617: "user:pass" → "dXNlcjpwYXNz"
    expect(basicAuthHeader('user', 'pass')).toBe('Basic dXNlcjpwYXNz');
  });

  it('encodes the classic admin:adminadmin pair correctly', () => {
    // "admin:adminadmin" → "YWRtaW46YWRtaW5hZG1pbg=="
    expect(basicAuthHeader('admin', 'adminadmin')).toBe('Basic YWRtaW46YWRtaW5hZG1pbg==');
  });

  it('handles an empty password', () => {
    // "user:" → "dXNlcjo="
    expect(basicAuthHeader('user', '')).toBe('Basic dXNlcjo=');
  });

  it('handles an empty username', () => {
    // ":pass" → "OnBhc3M="
    expect(basicAuthHeader('', 'pass')).toBe('Basic OnBhc3M=');
  });

  it('handles both empty username and password', () => {
    // ":" → "Og=="
    expect(basicAuthHeader('', '')).toBe('Basic Og==');
  });

  it('encodes non-ASCII (UTF-8) characters without throwing', () => {
    const header = basicAuthHeader('usér', 'pässwörd');
    expect(header).toMatch(/^Basic [A-Za-z0-9+/]+=*$/);
    // Verify it decodes correctly via Buffer (Node.js test env has Buffer)
    const encoded = header.slice(6); // strip "Basic "
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    expect(decoded).toBe('usér:pässwörd');
  });

  it('encodes emoji in credentials without throwing', () => {
    const header = basicAuthHeader('user🔑', 'p@ss');
    expect(header).toMatch(/^Basic [A-Za-z0-9+/]+=*$/);
    const encoded = header.slice(6);
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    expect(decoded).toBe('user🔑:p@ss');
  });

  it('produces valid base64 (no illegal characters)', () => {
    const header = basicAuthHeader('hello', 'world');
    expect(header).toMatch(/^Basic [A-Za-z0-9+/]+=*$/);
  });
});

import { getServerAuthMode, applyServerAuthMode } from '@/utils/authMode';

describe('getServerAuthMode', () => {
  it('returns "password" when neither useApiKey nor bypassAuth is set', () => {
    expect(getServerAuthMode({})).toBe('password');
  });

  it('returns "password" for a legacy record with bypassAuth explicitly false', () => {
    expect(getServerAuthMode({ bypassAuth: false })).toBe('password');
  });

  it('returns "none" when bypassAuth is true', () => {
    expect(getServerAuthMode({ bypassAuth: true })).toBe('none');
  });

  it('returns "apiKey" when useApiKey is true', () => {
    expect(getServerAuthMode({ useApiKey: true })).toBe('apiKey');
  });

  it('prefers "apiKey" when both useApiKey and bypassAuth are true (hand-edited/imported record)', () => {
    expect(getServerAuthMode({ useApiKey: true, bypassAuth: true })).toBe('apiKey');
  });
});

describe('applyServerAuthMode', () => {
  const creds = { username: '  admin  ', password: '  hunter2  ', apiKey: '  qbt_abc  ' };

  it('password mode: keeps trimmed username/password, blanks apiKey, bypassAuth false', () => {
    const result = applyServerAuthMode('password', creds);
    expect(result).toEqual({
      username: 'admin',
      password: 'hunter2',
      bypassAuth: false,
      useApiKey: false,
      apiKey: '',
    });
  });

  it('apiKey mode: blanks username/password, keeps trimmed apiKey, useApiKey true', () => {
    const result = applyServerAuthMode('apiKey', creds);
    expect(result).toEqual({
      username: '',
      password: '',
      bypassAuth: false,
      useApiKey: true,
      apiKey: 'qbt_abc',
    });
  });

  it('none mode: blanks everything, bypassAuth true', () => {
    const result = applyServerAuthMode('none', creds);
    expect(result).toEqual({
      username: '',
      password: '',
      bypassAuth: true,
      useApiKey: false,
      apiKey: '',
    });
  });
});

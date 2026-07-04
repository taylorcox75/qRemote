import { isLoginBodyOk, isLoginBodyFail, isLoginSuccess } from '@/utils/login-response';

describe('isLoginBodyOk', () => {
  it('matches "Ok." and "Ok"', () => {
    expect(isLoginBodyOk('Ok.')).toBe(true);
    expect(isLoginBodyOk('Ok')).toBe(true);
    expect(isLoginBodyOk('  Ok.  ')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isLoginBodyOk('')).toBe(false);
    expect(isLoginBodyOk('Fails.')).toBe(false);
  });
});

describe('isLoginBodyFail', () => {
  it('matches "Fails." and "Fails"', () => {
    expect(isLoginBodyFail('Fails.')).toBe(true);
    expect(isLoginBodyFail('Fails')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isLoginBodyFail('')).toBe(false);
    expect(isLoginBodyFail('Ok.')).toBe(false);
  });
});

describe('isLoginSuccess (qBittorrent 4.x/5.x response matrix)', () => {
  it('200 + "Ok." body succeeds', () => {
    expect(isLoginSuccess({ status: 200, body: 'Ok.', hasSessionCookie: true })).toBe(true);
  });

  it('200 + "Fails." body fails, even with a stray cookie', () => {
    expect(isLoginSuccess({ status: 200, body: 'Fails.', hasSessionCookie: true })).toBe(false);
  });

  it('204 + empty body + cookie succeeds (qBittorrent 5.x)', () => {
    expect(isLoginSuccess({ status: 204, body: '', hasSessionCookie: true })).toBe(true);
  });

  it('bare 204 + empty body with NO visible cookie still succeeds (RN may hide Set-Cookie)', () => {
    expect(isLoginSuccess({ status: 204, body: '', hasSessionCookie: false })).toBe(true);
  });

  it('403 with no recognizable body and no cookie fails', () => {
    expect(isLoginSuccess({ status: 403, body: '', hasSessionCookie: false })).toBe(false);
  });

  it('405 Method Not Allowed fails', () => {
    expect(isLoginSuccess({ status: 405, body: 'Method Not Allowed', hasSessionCookie: false })).toBe(false);
  });

  it('200 with an inconclusive body and no cookie fails (proxy stripped everything)', () => {
    expect(isLoginSuccess({ status: 200, body: '', hasSessionCookie: false })).toBe(false);
  });

  it('200 with an inconclusive body but a session cookie succeeds', () => {
    expect(isLoginSuccess({ status: 200, body: '', hasSessionCookie: true })).toBe(true);
  });

  it('status omitted (axios path) falls back to body/cookie only', () => {
    expect(isLoginSuccess({ body: 'Ok.' })).toBe(true);
    expect(isLoginSuccess({ body: '', hasSessionCookie: true })).toBe(true);
    expect(isLoginSuccess({ body: '', hasSessionCookie: false })).toBe(false);
  });
});

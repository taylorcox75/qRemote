import { isQbitAppVersion, isQbitWebApiVersion } from '@/utils/qbit-response';

describe('qbit-response', () => {
  it.each(['v5.3.0', 'v4.1.9.1', '5.0.0beta1', ' v4.6.7\n'])('accepts app/version %p', (v) => {
    expect(isQbitAppVersion(v)).toBe(true);
  });

  it.each(['<!DOCTYPE html><html>…', '', 'Forbidden', 'Ok.', undefined, null, 5, { v: 1 }])(
    'rejects app/version %p (proxy page, error text, non-string)',
    (v) => {
      expect(isQbitAppVersion(v)).toBe(false);
    },
  );

  it.each(['2.16.2', '2.6', '2.11.0'])('accepts webapiVersion %p', (v) => {
    expect(isQbitWebApiVersion(v)).toBe(true);
  });

  it.each(['<html>', '', 'v2.6', '2', undefined, 2.6])('rejects webapiVersion %p', (v) => {
    expect(isQbitWebApiVersion(v)).toBe(false);
  });
});

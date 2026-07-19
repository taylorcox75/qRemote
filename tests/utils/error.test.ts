import { AxiosError } from 'axios';
import { getErrorMessage, isAxiosError } from '@/utils/error';

describe('getErrorMessage', () => {
  it('returns the message of an Error instance', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('stringifies non-Error values', () => {
    expect(getErrorMessage('plain string')).toBe('plain string');
    expect(getErrorMessage(42)).toBe('42');
    expect(getErrorMessage(null)).toBe('null');
    expect(getErrorMessage(undefined)).toBe('undefined');
    expect(getErrorMessage({ foo: 'bar' })).toBe('[object Object]');
  });
});

describe('isAxiosError', () => {
  it('returns true for a real AxiosError instance', () => {
    const err = new AxiosError('network fail');
    expect(isAxiosError(err)).toBe(true);
  });

  it('returns true for an Error with isAxiosError property set', () => {
    const err = new Error('fake axios error') as Error & { isAxiosError: boolean };
    err.isAxiosError = true;
    expect(isAxiosError(err)).toBe(true);
  });

  it('returns false for a plain Error', () => {
    expect(isAxiosError(new Error('plain'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isAxiosError('string')).toBe(false);
    expect(isAxiosError(null)).toBe(false);
    expect(isAxiosError(undefined)).toBe(false);
    expect(isAxiosError({ isAxiosError: true })).toBe(false);
  });
});

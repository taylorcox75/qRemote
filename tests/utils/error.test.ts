import { AxiosError } from 'axios';
import {
  CONNECT_SUPERSEDED_MESSAGE,
  getErrorMessage,
  isAxiosError,
  isSupersededConnectError,
  isTlsRejection,
} from '@/utils/error';

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

describe('isTlsRejection', () => {
  it('recognizes an English TLS-rejection description on error.request.response', () => {
    const err = {
      message: 'Network Error',
      request: {
        response:
          'The certificate for this server is invalid. You might be connecting to a server that is pretending to be "example.com" which could put your confidential information at risk.',
      },
    };
    expect(isTlsRejection(err)).toBe(true);
  });

  it('reads error.request.responseText when .response is blank — the shape RN actually produces on error (#256)', () => {
    // RN's XMLHttpRequest returns '' from `.response` once `_hasError` is set,
    // but `.responseText` still returns the stashed native description. The
    // shipped detector only read `.response`, so a real on-device rejection
    // fell through to the generic "Connection timeout" message.
    const err = {
      message: 'Network Error',
      request: {
        response: '',
        responseText:
          'The certificate for this server is invalid. You might be connecting to a server that is pretending to be "192.168.1.106" which could put your confidential information at risk.',
      },
    };
    expect(isTlsRejection(err)).toBe(true);
  });

  it('falls back to .response when the .responseText getter throws (non-text responseType)', () => {
    const err = {
      message: 'Network Error',
      request: {
        get responseText(): string {
          throw new Error(
            "The 'responseText' property is only available if 'responseType' is set to '' or 'text'",
          );
        },
        response: 'The certificate for this server is invalid.',
      },
    };
    expect(isTlsRejection(err)).toBe(true);
  });

  it('recognizes a non-English (Spanish) description, since the text is localized (#256)', () => {
    const err = {
      message: 'Network Error',
      request: {
        response: 'El certificado de este servidor no es válido.',
      },
    };
    expect(isTlsRejection(err)).toBe(true);
  });

  it('recognizes a language-neutral SSL/TLS keyword even without the word "certificate"', () => {
    const err = { message: 'An SSL error occurred while establishing a connection.' };
    expect(isTlsRejection(err)).toBe(true);
  });

  it('falls back to error.message when error.request.response is absent', () => {
    const err = new Error('The certificate for this server is invalid.');
    expect(isTlsRejection(err)).toBe(true);
  });

  it('is case-insensitive', () => {
    const err = { message: 'TLS handshake failed' };
    expect(isTlsRejection(err)).toBe(true);
  });

  it('returns false for a generic network error with no cert wording', () => {
    const err = { message: 'Network Error', request: { response: '' } };
    expect(isTlsRejection(err)).toBe(false);
  });

  it('returns false for a plain timeout', () => {
    expect(
      isTlsRejection(new Error('Connection timeout. Please check your server connection.')),
    ).toBe(false);
  });

  it('returns false for non-object values', () => {
    expect(isTlsRejection('string')).toBe(false);
    expect(isTlsRejection(null)).toBe(false);
    expect(isTlsRejection(undefined)).toBe(false);
  });

  it('ignores a non-string error.request.response', () => {
    const err = { message: 'Network Error', request: { response: { some: 'object' } } };
    expect(isTlsRejection(err)).toBe(false);
  });
});

describe('isSupersededConnectError', () => {
  it('matches only the superseded-connect error', () => {
    expect(isSupersededConnectError(new Error(CONNECT_SUPERSEDED_MESSAGE))).toBe(true);
    expect(isSupersededConnectError(new Error('Request canceled.'))).toBe(false);
    expect(isSupersededConnectError(CONNECT_SUPERSEDED_MESSAGE)).toBe(false);
  });
});

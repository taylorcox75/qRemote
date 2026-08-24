import {
  isReservedHeaderName,
  parseStoredCustomHeaders,
  sanitizeCustomHeaders,
  validateCustomHeaders,
} from '@/utils/customHeaders';

describe('isReservedHeaderName', () => {
  it.each(['Authorization', 'cookie', 'REFERER', 'Origin', 'content-type', 'Host'])(
    'flags %s as reserved (case-insensitive)',
    (name) => {
      expect(isReservedHeaderName(name)).toBe(true);
    },
  );

  it('does not flag an unrelated header name', () => {
    expect(isReservedHeaderName('X-Pangolin-Token')).toBe(false);
  });

  it('trims surrounding whitespace before comparing', () => {
    expect(isReservedHeaderName('  authorization  ')).toBe(true);
  });
});

describe('sanitizeCustomHeaders', () => {
  it('returns [] for undefined input', () => {
    expect(sanitizeCustomHeaders(undefined)).toEqual([]);
  });

  it('trims whitespace from keys and values', () => {
    expect(sanitizeCustomHeaders([{ key: '  X-Token ', value: ' secret ' }])).toEqual([
      { key: 'X-Token', value: 'secret' },
    ]);
  });

  it('drops rows where either side is blank', () => {
    const result = sanitizeCustomHeaders([
      { key: 'X-Token', value: 'secret' },
      { key: '', value: 'orphaned-value' },
      { key: 'X-Empty', value: '' },
      { key: '   ', value: '   ' },
    ]);
    expect(result).toEqual([{ key: 'X-Token', value: 'secret' }]);
  });
});

describe('sanitizeCustomHeaders — hostile input', () => {
  // The settings-import path spreads unvalidated JSON into a ServerConfig, so
  // the declared type is not a runtime guarantee here.
  it('returns [] for a non-array masquerading as the right type', () => {
    expect(sanitizeCustomHeaders('nope' as never)).toEqual([]);
    expect(sanitizeCustomHeaders({ key: 'X', value: 'y' } as never)).toEqual([]);
  });

  it('drops entries whose key or value is not a string, without throwing', () => {
    expect(() => sanitizeCustomHeaders([{ key: 123, value: 'y' }] as never)).not.toThrow();
    expect(
      sanitizeCustomHeaders([
        { key: 123, value: 'y' },
        { key: 'X-Ok', value: 'ok' },
        null,
        'junk',
      ] as never),
    ).toEqual([{ key: 'X-Ok', value: 'ok' }]);
  });

  it('strips reserved names so an import cannot smuggle one in', () => {
    expect(
      sanitizeCustomHeaders([
        { key: 'Authorization', value: 'Bearer attacker' },
        { key: 'Cookie', value: 'SID=attacker' },
        { key: 'X-Ok', value: 'ok' },
      ]),
    ).toEqual([{ key: 'X-Ok', value: 'ok' }]);
  });
});

describe('parseStoredCustomHeaders', () => {
  it('returns [] for empty, null, or undefined input', () => {
    expect(parseStoredCustomHeaders('')).toEqual([]);
    expect(parseStoredCustomHeaders(null)).toEqual([]);
    expect(parseStoredCustomHeaders(undefined)).toEqual([]);
  });

  it('returns [] for corrupt JSON', () => {
    expect(parseStoredCustomHeaders('{not valid json')).toEqual([]);
  });

  it('returns [] for well-formed JSON that is not an array', () => {
    expect(parseStoredCustomHeaders('{"key":"X","value":"y"}')).toEqual([]);
    expect(parseStoredCustomHeaders('"a string"')).toEqual([]);
  });

  it('drops malformed entries that would crash callers on .trim()', () => {
    expect(parseStoredCustomHeaders('[{"key":123},{"key":"X-Ok","value":"ok"},null]')).toEqual([
      { key: 'X-Ok', value: 'ok' },
    ]);
  });

  it('round-trips a well-formed payload', () => {
    const headers = [{ key: 'X-Pangolin-Token', value: 'secret' }];
    expect(parseStoredCustomHeaders(JSON.stringify(headers))).toEqual(headers);
  });
});

describe('validateCustomHeaders', () => {
  it('rejects an all-blank list', () => {
    expect(validateCustomHeaders([{ key: '', value: '' }])).toEqual({
      valid: false,
      error: 'empty',
    });
  });

  it('rejects a row with only a key filled in', () => {
    expect(validateCustomHeaders([{ key: 'X-Token', value: '' }])).toEqual({
      valid: false,
      error: 'incomplete',
    });
  });

  it('rejects a row with only a value filled in', () => {
    expect(validateCustomHeaders([{ key: '', value: 'secret' }])).toEqual({
      valid: false,
      error: 'incomplete',
    });
  });

  it('rejects a reserved header name and reports it', () => {
    expect(validateCustomHeaders([{ key: 'Authorization', value: 'Bearer x' }])).toEqual({
      valid: false,
      error: 'reserved',
      reservedName: 'Authorization',
    });
  });

  it('accepts a fully filled, non-reserved header', () => {
    expect(validateCustomHeaders([{ key: 'X-Pangolin-Token', value: 'secret' }])).toEqual({
      valid: true,
    });
  });

  it('ignores fully blank rows mixed in with a valid one', () => {
    expect(
      validateCustomHeaders([
        { key: 'X-Pangolin-Token', value: 'secret' },
        { key: '', value: '' },
      ]),
    ).toEqual({ valid: true });
  });
});

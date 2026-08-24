import {
  isReservedHeaderName,
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

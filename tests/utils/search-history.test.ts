import {
  MAX_PINNED_SEARCHES,
  applyHistoryLimit,
  clearUnpinned,
  getHistoryEntries,
  recordQuery,
  removeQuery,
  togglePin,
} from '@/utils/search-history';

describe('recordQuery', () => {
  it('adds a new query to the front, trimmed', () => {
    expect(recordQuery(['ubuntu'], [], '  debian  ', 5)).toEqual(['debian', 'ubuntu']);
  });

  it('ignores queries shorter than 2 characters after trimming', () => {
    expect(recordQuery(['ubuntu'], [], 'a', 5)).toEqual(['ubuntu']);
    expect(recordQuery(['ubuntu'], [], '   ', 5)).toEqual(['ubuntu']);
    expect(recordQuery(['ubuntu'], [], ' x ', 5)).toEqual(['ubuntu']);
    expect(recordQuery([], [], '', 5)).toEqual([]);
  });

  it('records a query of exactly 2 characters', () => {
    expect(recordQuery([], [], 'ab', 5)).toEqual(['ab']);
  });

  it('dedupes case-insensitively, keeping the latest casing and moving it to the front', () => {
    expect(recordQuery(['debian', 'Ubuntu', 'arch'], [], 'UBUNTU', 5)).toEqual([
      'UBUNTU',
      'debian',
      'arch',
    ]);
  });

  it('trims the list to the limit, dropping the oldest', () => {
    expect(recordQuery(['c3', 'b2', 'a1'], [], 'd4', 3)).toEqual(['d4', 'c3', 'b2']);
  });

  it('shrinks an over-long list to the limit even when the query is ignored', () => {
    expect(recordQuery(['c3', 'b2', 'a1'], [], 'x', 2)).toEqual(['c3', 'b2']);
  });

  it('returns [] when the limit is 0 (history off)', () => {
    expect(recordQuery(['ubuntu'], [], 'debian', 0)).toEqual([]);
  });

  it('treats a negative or NaN limit as off', () => {
    expect(recordQuery(['ubuntu'], [], 'debian', -3)).toEqual([]);
    expect(recordQuery(['ubuntu'], [], 'debian', NaN)).toEqual([]);
  });

  it('does not duplicate a query that is already pinned', () => {
    expect(recordQuery(['debian'], ['Ubuntu'], 'ubuntu', 5)).toEqual(['debian']);
  });

  it('removes a stale unpinned copy of a pinned query', () => {
    expect(recordQuery(['ubuntu', 'debian'], ['Ubuntu'], 'ubuntu', 5)).toEqual(['debian']);
  });

  it('does not count pinned entries toward the limit', () => {
    const pinned = ['p1', 'p2', 'p3'];
    expect(recordQuery(['b2', 'a1'], pinned, 'c3', 3)).toEqual(['c3', 'b2', 'a1']);
  });

  it('does not mutate its inputs', () => {
    const history = ['a1', 'b2'];
    const pinned = ['p1'];
    recordQuery(history, pinned, 'c3', 5);
    expect(history).toEqual(['a1', 'b2']);
    expect(pinned).toEqual(['p1']);
  });
});

describe('applyHistoryLimit', () => {
  it('keeps the newest entries', () => {
    expect(applyHistoryLimit(['a1', 'b2', 'c3', 'd4'], 2)).toEqual(['a1', 'b2']);
  });

  it('returns everything when under the limit', () => {
    expect(applyHistoryLimit(['a1'], 5)).toEqual(['a1']);
  });

  it('empties the list for a limit of 0', () => {
    expect(applyHistoryLimit(['a1', 'b2'], 0)).toEqual([]);
  });

  it('floors a fractional limit', () => {
    expect(applyHistoryLimit(['a1', 'b2', 'c3'], 2.9)).toEqual(['a1', 'b2']);
  });
});

describe('togglePin', () => {
  it('moves a recent entry to the pinned list', () => {
    expect(togglePin(['a1', 'b2', 'c3'], ['p1'], 'b2')).toEqual({
      history: ['a1', 'c3'],
      pinned: ['p1', 'b2'],
    });
  });

  it('matches case-insensitively and keeps the stored casing', () => {
    expect(togglePin(['Ubuntu'], [], 'ubuntu')).toEqual({ history: [], pinned: ['Ubuntu'] });
  });

  it('moves a pinned entry back to the front of the recent list', () => {
    expect(togglePin(['a1', 'b2'], ['p1', 'p2'], 'p2')).toEqual({
      history: ['p2', 'a1', 'b2'],
      pinned: ['p1'],
    });
  });

  it('trims the recent list to the limit when unpinning', () => {
    expect(togglePin(['a1', 'b2'], ['p1'], 'p1', 2)).toEqual({
      history: ['p1', 'a1'],
      pinned: [],
    });
  });

  it('leaves the lists unchanged once MAX_PINNED_SEARCHES are pinned', () => {
    const pinned = Array.from({ length: MAX_PINNED_SEARCHES }, (_, i) => `pin ${i}`);
    const history = ['a1', 'b2'];
    const result = togglePin(history, pinned, 'a1');
    expect(result.history).toBe(history);
    expect(result.pinned).toBe(pinned);
  });

  it('still allows unpinning when at the cap', () => {
    const pinned = Array.from({ length: MAX_PINNED_SEARCHES }, (_, i) => `pin ${i}`);
    const result = togglePin([], pinned, 'pin 3');
    expect(result.pinned).toHaveLength(MAX_PINNED_SEARCHES - 1);
    expect(result.history).toEqual(['pin 3']);
  });

  it('ignores a query that is in neither list', () => {
    expect(togglePin(['a1'], ['p1'], 'zz')).toEqual({ history: ['a1'], pinned: ['p1'] });
  });

  it('lets pinned entries exceed the history limit without affecting recents', () => {
    const pinned = ['p1', 'p2', 'p3', 'p4'];
    expect(recordQuery(['a1'], pinned, 'b2', 2)).toEqual(['b2', 'a1']);
  });
});

describe('removeQuery', () => {
  it('removes from the recent list', () => {
    expect(removeQuery(['a1', 'b2'], ['p1'], 'A1')).toEqual({ history: ['b2'], pinned: ['p1'] });
  });

  it('removes from the pinned list', () => {
    expect(removeQuery(['a1'], ['p1', 'p2'], 'p1')).toEqual({ history: ['a1'], pinned: ['p2'] });
  });

  it('is a no-op for an unknown query', () => {
    expect(removeQuery(['a1'], ['p1'], 'zz')).toEqual({ history: ['a1'], pinned: ['p1'] });
  });
});

describe('clearUnpinned', () => {
  it('empties recents and keeps pinned entries', () => {
    expect(clearUnpinned(['p1', 'p2'])).toEqual({ history: [], pinned: ['p1', 'p2'] });
  });
});

describe('getHistoryEntries', () => {
  it('lists pinned entries first, then recent ones', () => {
    expect(getHistoryEntries(['a1', 'b2'], ['p1', 'p2'])).toEqual([
      { query: 'p1', pinned: true },
      { query: 'p2', pinned: true },
      { query: 'a1', pinned: false },
      { query: 'b2', pinned: false },
    ]);
  });

  it('never lists a query twice, pinned wins', () => {
    expect(getHistoryEntries(['Ubuntu', 'a1'], ['ubuntu'])).toEqual([
      { query: 'ubuntu', pinned: true },
      { query: 'a1', pinned: false },
    ]);
  });

  it('returns an empty list when there is nothing stored', () => {
    expect(getHistoryEntries([], [])).toEqual([]);
  });
});

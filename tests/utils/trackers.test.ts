import { isRealTracker, getPseudoTrackerStates } from '@/utils/trackers';
import { Tracker } from '@/types/api';

function tracker(overrides: Partial<Tracker>): Tracker {
  return {
    url: '',
    status: 0,
    tier: 0,
    num_peers: 0,
    num_seeds: 0,
    num_leeches: 0,
    num_downloaded: 0,
    msg: '',
    ...overrides,
  };
}

describe('isRealTracker', () => {
  it('returns true for a normal announce URL', () => {
    expect(isRealTracker('https://tracker.example.com/announce')).toBe(true);
  });

  it('returns false for the DHT pseudo-tracker', () => {
    expect(isRealTracker('** [DHT] **')).toBe(false);
  });

  it('returns false for the PeX pseudo-tracker regardless of casing', () => {
    expect(isRealTracker('** [PeX] **')).toBe(false);
    expect(isRealTracker('** [pex] **')).toBe(false);
    expect(isRealTracker('** [PEX] **')).toBe(false);
  });

  it('returns false for the LSD pseudo-tracker', () => {
    expect(isRealTracker('** [LSD] **')).toBe(false);
  });

  it('returns false for an empty url', () => {
    expect(isRealTracker('')).toBe(false);
  });
});

describe('getPseudoTrackerStates', () => {
  it('returns null for every channel when none are present', () => {
    const states = getPseudoTrackerStates([tracker({ url: 'https://real.tracker/a' })]);
    expect(states).toEqual({ dht: null, pex: null, lsd: null });
  });

  it('maps status 2 to working', () => {
    const states = getPseudoTrackerStates([tracker({ url: '** [DHT] **', status: 2 })]);
    expect(states.dht).toBe('working');
  });

  it('maps status 3 (updating) to working', () => {
    const states = getPseudoTrackerStates([tracker({ url: '** [PeX] **', status: 3 })]);
    expect(states.pex).toBe('working');
  });

  it('maps status 4 to notWorking', () => {
    const states = getPseudoTrackerStates([tracker({ url: '** [LSD] **', status: 4 })]);
    expect(states.lsd).toBe('notWorking');
  });

  it('maps status 0 to disabled', () => {
    const states = getPseudoTrackerStates([tracker({ url: '** [DHT] **', status: 0 })]);
    expect(states.dht).toBe('disabled');
  });

  it('maps status 1 (not contacted) to unknown', () => {
    const states = getPseudoTrackerStates([tracker({ url: '** [DHT] **', status: 1 })]);
    expect(states.dht).toBe('unknown');
  });

  it('reads all three channels independently, case-insensitively', () => {
    const states = getPseudoTrackerStates([
      tracker({ url: '** [dht] **', status: 2 }),
      tracker({ url: '** [PEX] **', status: 0 }),
      tracker({ url: '** [Lsd] **', status: 4 }),
      tracker({ url: 'https://real.tracker/a', status: 2 }),
    ]);
    expect(states).toEqual({ dht: 'working', pex: 'disabled', lsd: 'notWorking' });
  });
});

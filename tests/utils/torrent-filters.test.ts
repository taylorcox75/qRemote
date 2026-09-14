import {
  matchesStatusFilter,
  STATUS_FILTER_IDS,
  DESKTOP_STATUS_FILTER_IDS,
  trackerHost,
  trackerHosts,
} from '@/utils/torrent-filters';
import { TorrentInfo } from '@/types/api';

interface TorrentOverrides {
  state?: string;
  progress?: number;
  dlspeed?: number;
  upspeed?: number;
}

function torrent(overrides: TorrentOverrides): TorrentInfo {
  return {
    state: 'downloading',
    progress: 0,
    dlspeed: 0,
    upspeed: 0,
    ...overrides,
  } as unknown as TorrentInfo;
}

describe('STATUS_FILTER_IDS', () => {
  it('matches index.tsx filterOptions order', () => {
    expect(STATUS_FILTER_IDS).toEqual([
      'all',
      'active',
      'completed',
      'paused',
      'stuck',
      'downloading',
      'uploading',
    ]);
  });
});

describe('matchesStatusFilter', () => {
  it('matches everything for "all"', () => {
    expect(matchesStatusFilter(torrent({ state: 'error' }), 'all')).toBe(true);
    expect(matchesStatusFilter(torrent({ state: 'downloading' }), 'all')).toBe(true);
  });

  describe('downloading', () => {
    it('matches the Pogona/qB Downloading bucket (active, forced, metadata)', () => {
      expect(matchesStatusFilter(torrent({ state: 'downloading' }), 'downloading')).toBe(true);
      expect(matchesStatusFilter(torrent({ state: 'forcedDL' }), 'downloading')).toBe(true);
      expect(matchesStatusFilter(torrent({ state: 'metaDL' }), 'downloading')).toBe(true);
      expect(matchesStatusFilter(torrent({ state: 'stalledDL' }), 'downloading')).toBe(false);
    });
  });

  describe('uploading', () => {
    it('matches only state === uploading', () => {
      expect(matchesStatusFilter(torrent({ state: 'uploading' }), 'uploading')).toBe(true);
      expect(matchesStatusFilter(torrent({ state: 'stalledUP' }), 'uploading')).toBe(false);
    });
  });

  describe('completed', () => {
    it('delegates to isTorrentCompleted(state, progress)', () => {
      expect(matchesStatusFilter(torrent({ state: 'uploading', progress: 1 }), 'completed')).toBe(
        true,
      );
      expect(
        matchesStatusFilter(torrent({ state: 'downloading', progress: 0.5 }), 'completed'),
      ).toBe(false);
    });
  });

  describe('paused', () => {
    it.each(['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP'])('matches state %s', (state) => {
      expect(matchesStatusFilter(torrent({ state }), 'paused')).toBe(true);
    });

    it('does not match a non-paused state', () => {
      expect(matchesStatusFilter(torrent({ state: 'downloading' }), 'paused')).toBe(false);
    });
  });

  describe('active', () => {
    it('matches when dlspeed > 0', () => {
      expect(matchesStatusFilter(torrent({ dlspeed: 100, upspeed: 0 }), 'active')).toBe(true);
    });

    it('matches when upspeed > 0', () => {
      expect(matchesStatusFilter(torrent({ dlspeed: 0, upspeed: 100 }), 'active')).toBe(true);
    });

    it('does not match when both speeds are 0', () => {
      expect(matchesStatusFilter(torrent({ dlspeed: 0, upspeed: 0 }), 'active')).toBe(false);
    });
  });

  describe('stuck', () => {
    it.each(['stalledDL', 'metaDL'])('matches state %s', (state) => {
      expect(matchesStatusFilter(torrent({ state, progress: 0.5 }), 'stuck')).toBe(true);
    });

    it('matches stalledUP below 100%', () => {
      expect(matchesStatusFilter(torrent({ state: 'stalledUP', progress: 0.9 }), 'stuck')).toBe(
        true,
      );
    });

    it('excludes stalledUP at 100% (seeding, not stuck)', () => {
      expect(matchesStatusFilter(torrent({ state: 'stalledUP', progress: 1 }), 'stuck')).toBe(
        false,
      );
    });

    it('does not match an unrelated state', () => {
      expect(matchesStatusFilter(torrent({ state: 'downloading' }), 'stuck')).toBe(false);
    });
  });

  it('falls through to true for an unrecognised filter id', () => {
    expect(matchesStatusFilter(torrent({ state: 'downloading' }), 'not-a-real-filter')).toBe(true);
  });

  describe('seeding', () => {
    it('matches uploading and forcedUP, not stalledUP', () => {
      expect(matchesStatusFilter(torrent({ state: 'uploading' }), 'seeding')).toBe(true);
      expect(matchesStatusFilter(torrent({ state: 'forcedUP' }), 'seeding')).toBe(true);
      expect(matchesStatusFilter(torrent({ state: 'stalledUP' }), 'seeding')).toBe(false);
    });
  });

  describe('running', () => {
    it('matches everything that is not paused/stopped', () => {
      expect(matchesStatusFilter(torrent({ state: 'downloading' }), 'running')).toBe(true);
      expect(matchesStatusFilter(torrent({ state: 'pausedDL' }), 'running')).toBe(false);
      expect(matchesStatusFilter(torrent({ state: 'stoppedUP' }), 'running')).toBe(false);
    });
  });

  describe('inactive', () => {
    it('matches when both speeds are 0', () => {
      expect(matchesStatusFilter(torrent({ dlspeed: 0, upspeed: 0 }), 'inactive')).toBe(true);
      expect(matchesStatusFilter(torrent({ dlspeed: 10, upspeed: 0 }), 'inactive')).toBe(false);
    });
  });

  describe('stalled', () => {
    it.each(['stalledDL', 'stalledUP'])('matches state %s', (state) => {
      expect(matchesStatusFilter(torrent({ state }), 'stalled')).toBe(true);
    });
  });

  describe('checking', () => {
    it.each(['checkingDL', 'checkingUP', 'checkingResumeData', 'allocating'])(
      'matches state %s',
      (state) => {
        expect(matchesStatusFilter(torrent({ state }), 'checking')).toBe(true);
      },
    );
  });

  describe('error', () => {
    it.each(['error', 'missingFiles'])('matches state %s', (state) => {
      expect(matchesStatusFilter(torrent({ state }), 'error')).toBe(true);
    });
  });
});

describe('DESKTOP_STATUS_FILTER_IDS', () => {
  it('follows Pogona FilterSidebar État order', () => {
    expect(DESKTOP_STATUS_FILTER_IDS).toEqual([
      'all',
      'downloading',
      'seeding',
      'completed',
      'running',
      'paused',
      'active',
      'inactive',
      'stalled',
      'checking',
      'error',
    ]);
  });
});

describe('trackerHost', () => {
  it('returns the hostname of an announce URL', () => {
    expect(trackerHost('https://tr.example.org:443/announce')).toBe('tr.example.org');
    expect(trackerHost('udp://tr.example.org:6969/announce')).toBe('tr.example.org');
  });

  it('returns empty string for missing or unparseable values', () => {
    expect(trackerHost('')).toBe('');
    expect(trackerHost(null)).toBe('');
    expect(trackerHost('not a url')).toBe('');
  });
});

describe('trackerHosts', () => {
  it('groups torrents by tracker hostname', () => {
    const list = [
      { ...torrent({ state: 'downloading' }), tracker: 'https://a.example/announce' },
      { ...torrent({ state: 'uploading' }), tracker: 'https://a.example/other' },
      { ...torrent({ state: 'pausedDL' }), tracker: 'udp://b.example:80/announce' },
    ] as TorrentInfo[];
    expect(trackerHosts(list)).toEqual([
      { host: 'a.example', count: 2 },
      { host: 'b.example', count: 1 },
    ]);
  });
});

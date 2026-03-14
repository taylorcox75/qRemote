import { getStateColor, getStateLabel } from '@/utils/torrent-state';

const mockColors = {
  stateUploadAndDownload: '#upload-and-download',
  stateUploadOnly: '#upload-only',
  stateSeeding: '#seeding',
  stateDownloading: '#downloading',
  stateMetadata: '#metadata',
  statePaused: '#paused',
  stateError: '#error',
  stateChecking: '#checking',
  stateQueued: '#queued',
  stateStalled: '#stalled',
  stateOther: '#other',
};

describe('getStateColor', () => {
  describe('speed-based overrides', () => {
    it('returns stateUploadAndDownload when both dlspeed > 0 and upspeed > 0', () => {
      expect(getStateColor('downloading', 0.5, 1000, 500, mockColors)).toBe('#upload-and-download');
    });

    it('returns stateUploadOnly when only upspeed > 0', () => {
      expect(getStateColor('downloading', 0.5, 0, 500, mockColors)).toBe('#upload-only');
    });
  });

  describe('progress-based overrides', () => {
    it('returns stateSeeding for stalledUP with progress >= 1', () => {
      expect(getStateColor('stalledUP', 1, 0, 0, mockColors)).toBe('#seeding');
    });

    it('returns stateStalled for stalledUP with progress < 1', () => {
      expect(getStateColor('stalledUP', 0.5, 0, 0, mockColors)).toBe('#stalled');
    });
  });

  describe('state-based colors', () => {
    it('downloading → stateDownloading', () => {
      expect(getStateColor('downloading', 0.5, 0, 0, mockColors)).toBe('#downloading');
    });

    it('forcedDL → stateDownloading', () => {
      expect(getStateColor('forcedDL', 0.5, 0, 0, mockColors)).toBe('#downloading');
    });

    it('metaDL → stateMetadata', () => {
      expect(getStateColor('metaDL', 0, 0, 0, mockColors)).toBe('#metadata');
    });

    it('forcedMetaDL → stateMetadata', () => {
      expect(getStateColor('forcedMetaDL', 0, 0, 0, mockColors)).toBe('#metadata');
    });

    it('uploading → stateUploadOnly', () => {
      expect(getStateColor('uploading', 1, 0, 0, mockColors)).toBe('#upload-only');
    });

    it('forcedUP → stateUploadOnly', () => {
      expect(getStateColor('forcedUP', 1, 0, 0, mockColors)).toBe('#upload-only');
    });

    it('pausedDL → statePaused', () => {
      expect(getStateColor('pausedDL', 0.5, 0, 0, mockColors)).toBe('#paused');
    });

    it('pausedUP → statePaused', () => {
      expect(getStateColor('pausedUP', 1, 0, 0, mockColors)).toBe('#paused');
    });

    it('stoppedDL → statePaused', () => {
      expect(getStateColor('stoppedDL', 0.5, 0, 0, mockColors)).toBe('#paused');
    });

    it('stoppedUP → statePaused', () => {
      expect(getStateColor('stoppedUP', 1, 0, 0, mockColors)).toBe('#paused');
    });

    it('error → stateError', () => {
      expect(getStateColor('error', 0, 0, 0, mockColors)).toBe('#error');
    });

    it('missingFiles → stateError', () => {
      expect(getStateColor('missingFiles', 0, 0, 0, mockColors)).toBe('#error');
    });

    it('stalledDL → stateError', () => {
      expect(getStateColor('stalledDL', 0.5, 0, 0, mockColors)).toBe('#error');
    });

    it('checkingDL → stateChecking', () => {
      expect(getStateColor('checkingDL', 0.5, 0, 0, mockColors)).toBe('#checking');
    });

    it('checkingUP → stateChecking', () => {
      expect(getStateColor('checkingUP', 1, 0, 0, mockColors)).toBe('#checking');
    });

    it('queuedDL → stateQueued', () => {
      expect(getStateColor('queuedDL', 0, 0, 0, mockColors)).toBe('#queued');
    });

    it('queuedUP → stateQueued', () => {
      expect(getStateColor('queuedUP', 0, 0, 0, mockColors)).toBe('#queued');
    });

    it('stalledUP (incomplete) → stateStalled', () => {
      expect(getStateColor('stalledUP', 0.8, 0, 0, mockColors)).toBe('#stalled');
    });

    it('allocating → stateOther', () => {
      expect(getStateColor('allocating', 0, 0, 0, mockColors)).toBe('#other');
    });

    it('moving → stateOther', () => {
      expect(getStateColor('moving', 0.5, 0, 0, mockColors)).toBe('#other');
    });

    it('unknown → stateOther', () => {
      expect(getStateColor('unknown', 0, 0, 0, mockColors)).toBe('#other');
    });

    it('unrecognized state → stateOther (default)', () => {
      expect(getStateColor('somethingNew', 0, 0, 0, mockColors)).toBe('#other');
    });
  });
});

describe('getStateLabel', () => {
  describe('speed-based overrides', () => {
    it('returns "DL + UL" when both dlspeed > 0 and upspeed > 0', () => {
      expect(getStateLabel('downloading', 0.5, 1000, 500)).toBe('DL + UL');
    });

    it('returns "Uploading" when only upspeed > 0', () => {
      expect(getStateLabel('downloading', 0.5, 0, 500)).toBe('Uploading');
    });
  });

  describe('progress-based overrides', () => {
    it('returns "Seeding" for stalledUP with progress >= 1', () => {
      expect(getStateLabel('stalledUP', 1, 0, 0)).toBe('Seeding');
    });

    it('returns "Stalled UP" for stalledUP with progress < 1', () => {
      expect(getStateLabel('stalledUP', 0.5, 0, 0)).toBe('Stalled UP');
    });
  });

  describe('state labels', () => {
    it('downloading → "Downloading"', () => {
      expect(getStateLabel('downloading', 0.5, 0, 0)).toBe('Downloading');
    });

    it('metaDL → "Metadata"', () => {
      expect(getStateLabel('metaDL', 0, 0, 0)).toBe('Metadata');
    });

    it('forcedMetaDL → "Forced Meta"', () => {
      expect(getStateLabel('forcedMetaDL', 0, 0, 0)).toBe('Forced Meta');
    });

    it('forcedDL → "Forced DL"', () => {
      expect(getStateLabel('forcedDL', 0.5, 0, 0)).toBe('Forced DL');
    });

    it('uploading → "Uploading"', () => {
      expect(getStateLabel('uploading', 1, 0, 0)).toBe('Uploading');
    });

    it('forcedUP → "Forced UP"', () => {
      expect(getStateLabel('forcedUP', 1, 0, 0)).toBe('Forced UP');
    });

    it('pausedDL → "Paused"', () => {
      expect(getStateLabel('pausedDL', 0.5, 0, 0)).toBe('Paused');
    });

    it('pausedUP → "Paused"', () => {
      expect(getStateLabel('pausedUP', 1, 0, 0)).toBe('Paused');
    });

    it('stoppedDL → "Stopped"', () => {
      expect(getStateLabel('stoppedDL', 0.5, 0, 0)).toBe('Stopped');
    });

    it('stoppedUP → "Paused"', () => {
      expect(getStateLabel('stoppedUP', 1, 0, 0)).toBe('Paused');
    });

    it('error → "Error"', () => {
      expect(getStateLabel('error', 0, 0, 0)).toBe('Error');
    });

    it('missingFiles → "Missing Files"', () => {
      expect(getStateLabel('missingFiles', 0, 0, 0)).toBe('Missing Files');
    });

    it('checkingDL → "Checking"', () => {
      expect(getStateLabel('checkingDL', 0.5, 0, 0)).toBe('Checking');
    });

    it('checkingUP → "Checking"', () => {
      expect(getStateLabel('checkingUP', 1, 0, 0)).toBe('Checking');
    });

    it('queuedDL → "Queued"', () => {
      expect(getStateLabel('queuedDL', 0, 0, 0)).toBe('Queued');
    });

    it('queuedUP → "Queued"', () => {
      expect(getStateLabel('queuedUP', 0, 0, 0)).toBe('Queued');
    });

    it('stalledDL → "Stalled DL"', () => {
      expect(getStateLabel('stalledDL', 0.5, 0, 0)).toBe('Stalled DL');
    });

    it('allocating → "Allocating"', () => {
      expect(getStateLabel('allocating', 0, 0, 0)).toBe('Allocating');
    });

    it('checkingResumeData → "Checking"', () => {
      expect(getStateLabel('checkingResumeData', 0, 0, 0)).toBe('Checking');
    });

    it('moving → "Moving"', () => {
      expect(getStateLabel('moving', 0.5, 0, 0)).toBe('Moving');
    });

    it('unknown state returns the raw state string', () => {
      expect(getStateLabel('somethingNew', 0, 0, 0)).toBe('somethingNew');
    });
  });
});

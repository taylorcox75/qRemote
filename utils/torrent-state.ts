/**
 * Canonical getStateColor / getStateLabel for torrent state display.
 *
 * Reconciled from TorrentCard.tsx (switch-based, most complete),
 * torrent/[hash].tsx (if-else chain), and ExpandableTorrentCard.tsx (ternary).
 *
 * `colors` is passed as a parameter so these stay pure — no hook calls.
 */

interface StateColors {
  stateUploadAndDownload: string;
  stateUploadOnly: string;
  stateSeeding: string;
  stateDownloading: string;
  stateMetadata: string;
  statePaused: string;
  stateError: string;
  stateChecking: string;
  stateQueued: string;
  stateStalled: string;
  stateOther: string;
}

export function getStateColor(
  state: string,
  progress: number,
  dlspeed: number,
  upspeed: number,
  colors: StateColors,
): string {
  const downloading = dlspeed > 0;
  const uploading = upspeed > 0;

  if (downloading && uploading) return colors.stateUploadAndDownload;
  if (uploading && !downloading) return colors.stateUploadOnly;

  if (state === 'stalledUP' && progress >= 1) return colors.stateSeeding;

  switch (state) {
    case 'downloading':
    case 'forcedDL':
      return colors.stateDownloading;
    case 'metaDL':
    case 'forcedMetaDL':
      return colors.stateMetadata;
    case 'uploading':
    case 'forcedUP':
      return colors.stateUploadOnly;
    case 'pausedDL':
    case 'pausedUP':
    case 'stoppedDL':
    case 'stoppedUP':
      return colors.statePaused;
    case 'error':
    case 'missingFiles':
    case 'stalledDL':
      return colors.stateError;
    case 'checkingDL':
    case 'checkingUP':
      return colors.stateChecking;
    case 'queuedDL':
    case 'queuedUP':
      return colors.stateQueued;
    case 'stalledUP':
      return colors.stateStalled;
    case 'allocating':
    case 'checkingResumeData':
    case 'moving':
    case 'unknown':
    default:
      return colors.stateOther;
  }
}

export function getStateLabel(
  state: string,
  progress: number,
  dlspeed: number,
  upspeed: number,
): string {
  const downloading = dlspeed > 0;
  const uploading = upspeed > 0;

  if (downloading && uploading) return 'DL + UL';
  if (uploading && !downloading) return 'Uploading';

  if (state === 'stalledUP' && progress >= 1) return 'Seeding';

  switch (state) {
    case 'downloading':
      return 'Downloading';
    case 'metaDL':
      return 'Metadata';
    case 'forcedMetaDL':
      return 'Forced Meta';
    case 'forcedDL':
      return 'Forced DL';
    case 'uploading':
      return 'Uploading';
    case 'forcedUP':
      return 'Forced UP';
    case 'pausedDL':
    case 'pausedUP':
      return 'Paused';
    case 'stoppedDL':
      return 'Stopped';
    case 'stoppedUP':
      return 'Paused';
    case 'error':
      return 'Error';
    case 'missingFiles':
      return 'Missing Files';
    case 'checkingDL':
    case 'checkingUP':
      return 'Checking';
    case 'queuedDL':
    case 'queuedUP':
      return 'Queued';
    case 'stalledDL':
      return 'Stalled DL';
    case 'stalledUP':
      return 'Stalled UP';
    case 'allocating':
      return 'Allocating';
    case 'checkingResumeData':
      return 'Checking';
    case 'moving':
      return 'Moving';
    default:
      return state;
  }
}

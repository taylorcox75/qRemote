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

/**
 * `progress` is the raw fraction (0–1); a torrent is complete/seeding once
 * it reaches 100%, regardless of its exact state (uploading, stalledUP,
 * forcedUP, paused-after-completion, ...).
 */
export function isTorrentComplete(progress: number): boolean {
  return progress >= 1;
}

/**
 * ETA is only meaningful while a torrent is still downloading.
 * `8640000` is qBittorrent's sentinel for an infinite/unknown ETA.
 */
export function hasEta(eta: number, progress: number): boolean {
  return eta > 0 && eta < 8640000 && !isTorrentComplete(progress);
}

type TranslateFn = (key: string) => string;

export function getStateLabel(
  state: string,
  progress: number,
  dlspeed: number,
  upspeed: number,
  t?: TranslateFn,
): string {
  const s = (key: string, fallback: string) => (t ? t(`states.${key}`) : fallback);
  const downloading = dlspeed > 0;
  const uploading = upspeed > 0;

  if (downloading && uploading) return s('dlAndUl', 'DL + UL');
  if (uploading && !downloading) return s('uploading', 'Uploading');

  if (state === 'stalledUP' && progress >= 1) return s('seeding', 'Seeding');

  switch (state) {
    case 'downloading':
      return s('downloading', 'Downloading');
    case 'metaDL':
      return s('metadata', 'Metadata');
    case 'forcedMetaDL':
      return s('forcedMeta', 'Forced Meta');
    case 'forcedDL':
      return s('forcedDl', 'Forced DL');
    case 'uploading':
      return s('uploading', 'Uploading');
    case 'forcedUP':
      return s('forcedUp', 'Forced UP');
    case 'pausedDL':
    case 'pausedUP':
      return s('paused', 'Paused');
    case 'stoppedDL':
      return s('stopped', 'Stopped');
    case 'stoppedUP':
      return s('paused', 'Paused');
    case 'error':
      return s('error', 'Error');
    case 'missingFiles':
      return s('missingFiles', 'Missing Files');
    case 'checkingDL':
    case 'checkingUP':
      return s('checking', 'Checking');
    case 'queuedDL':
    case 'queuedUP':
      return s('queued', 'Queued');
    case 'stalledDL':
      return s('stalledDl', 'Stalled DL');
    case 'stalledUP':
      return s('stalledUp', 'Stalled UP');
    case 'allocating':
      return s('allocating', 'Allocating');
    case 'checkingResumeData':
      return s('checking', 'Checking');
    case 'moving':
      return s('moving', 'Moving');
    default:
      return state;
  }
}

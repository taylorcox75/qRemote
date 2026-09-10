/**
 * Shared timing thresholds used across contexts.
 */

// Below this backgrounded duration, treat a foreground return as a quick
// app-switch: the session can't plausibly have expired and the data can't
// have gone meaningfully stale, so skip the forced full resync + recovery
// skeleton and let the normal 2s poll pick up right where it left off. Above
// it, do the full "might need to reconnect, don't show stale/wrong data"
// dance. Without this gate, every single foreground return — even a
// glance at another app — forced a full resync and blocked on it with a
// skeleton, which is the "briefly shows loading every time I reopen" flash.
// Used by TorrentContext and TransferContext.
export const LONG_BACKGROUND_THRESHOLD_MS = 10_000;

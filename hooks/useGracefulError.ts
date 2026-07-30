/**
 * useGracefulError.ts — delays surfacing a transient error to the UI.
 *
 * A poll that fails once right after opening/resuming the app usually
 * self-heals within a couple of seconds (the next poll, or a reactive
 * reconnect) — showing the full error UI immediately causes a jarring
 * flash. `graceError` only becomes non-null once `error` has been
 * continuously truthy for `graceMs`; it clears instantly the moment `error`
 * clears.
 */
import { useEffect, useState } from 'react';

const DEFAULT_GRACE_MS = 2500;

export function useGracefulError(
  error: string | null,
  graceMs: number = DEFAULT_GRACE_MS,
): { graceError: string | null; isPendingError: boolean } {
  const [confirmedError, setConfirmedError] = useState<string | null>(null);
  const hasError = error !== null;

  useEffect(() => {
    if (!hasError) return undefined;
    const timer = setTimeout(() => setConfirmedError(error), graceMs);
    return () => {
      clearTimeout(timer);
      // Forget a stale confirmed error from a prior streak so a new error
      // arriving right after the old one cleared goes through its own
      // grace period instead of appearing to fire instantly.
      setConfirmedError(null);
    };
    // Keyed on presence, not the exact message, so text churn across
    // repeated failures during a sustained outage doesn't keep resetting
    // the countdown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasError, graceMs]);

  // Clear instantly the moment the underlying error clears — derived at
  // render time rather than via a second effect.
  const graceError = hasError ? confirmedError : null;

  return { graceError, isPendingError: hasError && graceError === null };
}

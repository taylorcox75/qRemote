import { DEFAULT_PREFERENCES, AppPreferences } from '@/types/preferences';

/**
 * Resolve the axios timeout / retry count from raw stored preferences.
 * `storageService.getPreferences()` returns a Partial with no defaults merged,
 * so missing or corrupt values fall back — but a legitimately saved 0 for
 * retryAttempts must survive (Settings → Advanced accepts 0..10).
 */
export function resolveConnectionSettings(
  prefs: Partial<Pick<AppPreferences, 'connectionTimeout' | 'retryAttempts'>>,
): { connectionTimeout: number; retryAttempts: number } {
  const timeout = Number(prefs.connectionTimeout);
  const retries = Number(prefs.retryAttempts);
  return {
    connectionTimeout:
      Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_PREFERENCES.connectionTimeout,
    retryAttempts:
      Number.isFinite(retries) && retries >= 0 ? retries : DEFAULT_PREFERENCES.retryAttempts,
  };
}

import type { ApplicationPreferences } from '@/types/api';

/**
 * Global share limits (Transfer tab → Seeding Limits) as `app/setPreferences`
 * patches.
 *
 * qBittorrent stores each global limit as ONE number, with -1 meaning "off",
 * and the `*_enabled` flag in `app/preferences` is only derived from it
 * (`globalMaxRatio() >= 0`). The two halves must therefore always travel
 * together:
 *
 * - 4.1.9 → 5.1.2 only act on `max_ratio_enabled`; `true` reads `max_ratio`
 *   from the same request (`m["max_ratio"].toReal()`), so a missing value
 *   becomes 0 — every completed torrent then hits the limit at once. A
 *   `max_ratio` sent on its own is ignored entirely.
 * - 5.2.0 accepts `max_ratio` alone, but `max_ratio_enabled: false` still wins.
 *
 * Sending `{enabled, value}` is correct on every version. `max_seeding_time*`
 * follows the same shape (minutes, `toInt()`).
 */

export type GlobalShareLimitKind = 'ratio' | 'seedingTime';

export function buildGlobalShareLimitPatch(
  kind: GlobalShareLimitKind,
  enabled: boolean,
  value: number,
): Partial<ApplicationPreferences> {
  // A disabled limit is stored as -1 server-side; send exactly that.
  if (kind === 'ratio') {
    return { max_ratio_enabled: enabled, max_ratio: enabled ? value : -1 };
  }
  return {
    max_seeding_time_enabled: enabled,
    max_seeding_time: enabled ? Math.round(value) : -1,
  };
}

/**
 * The value to remember for a limit after reading `app/preferences`. A
 * disabled limit reads back as -1 (the server keeps no "last value"), so a
 * negative or missing reading keeps whatever was known before.
 */
export function rememberLimitValue(serverValue: unknown, previous: number | null): number | null {
  return typeof serverValue === 'number' && Number.isFinite(serverValue) && serverValue >= 0
    ? serverValue
    : previous;
}

/**
 * Suggested values pre-filled when a limit is switched on with no known
 * value to restore (it read back as -1). Only a suggestion: the user confirms
 * in the value prompt before anything is sent.
 */
export const SUGGESTED_GLOBAL_MAX_RATIO = 1;
export const SUGGESTED_GLOBAL_MAX_SEEDING_MINUTES = 1440;

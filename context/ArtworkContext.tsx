/**
 * ArtworkContext.tsx - App-wide TMDB artwork feature flag.
 *
 * Tracks two independent gates and derives whether artwork lookups are
 * allowed to run at all:
 *  - `enabled`: the user's opt-in preference (tmdbPostersEnabled), default
 *    false - see AGENTS.md privacy rule: only the parsed title/year is ever
 *    sent to TMDB, and only once the user has explicitly turned this on.
 *  - `hasKey`: whether a TMDB v3 API key is present in expo-secure-store.
 *  - `active`: enabled && hasKey - the single flag consumers should gate on.
 *
 * Re-reads both on mount and whenever `refresh()` is called (e.g. after the
 * user flips the preference or saves/clears their API key in Settings, so
 * the rest of the app picks up the change without an app restart).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { storageService } from '@/services/storage';
import { hasTmdbApiKey } from '@/services/tmdb';

interface ArtworkContextType {
  /** User preference (tmdbPostersEnabled), default false. */
  enabled: boolean;
  /** Whether a TMDB API key is currently stored. */
  hasKey: boolean;
  /** enabled && hasKey - gate artwork lookups on this. */
  active: boolean;
  /** Re-read the preference and key from storage. */
  refresh: () => Promise<void>;
}

const ArtworkContext = createContext<ArtworkContextType | undefined>(undefined);

export function ArtworkProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [prefs, key] = await Promise.all([storageService.getPreferences(), hasTmdbApiKey()]);
      setEnabled(prefs.tmdbPostersEnabled === true);
      setHasKey(key);
    } catch {
      // Defensive only - both storageService.getPreferences() and
      // hasTmdbApiKey() already swallow their own errors and resolve to
      // safe defaults ({} / false), so this should never actually throw.
      setEnabled(false);
      setHasKey(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const active = enabled && hasKey;

  const value = useMemo<ArtworkContextType>(
    () => ({ enabled, hasKey, active, refresh }),
    [enabled, hasKey, active, refresh],
  );

  return <ArtworkContext.Provider value={value}>{children}</ArtworkContext.Provider>;
}

/** Consume the artwork feature flag. Named apart from hooks/useArtwork.ts,
 * which resolves one item's artwork rather than the feature gate. */
export function useArtworkSettings(): ArtworkContextType {
  const ctx = useContext(ArtworkContext);
  if (!ctx) {
    throw new Error('useArtworkSettings must be used within an ArtworkProvider');
  }
  return ctx;
}

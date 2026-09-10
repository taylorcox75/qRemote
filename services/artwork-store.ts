import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseReleaseName } from '@/utils/release-name';
import { searchArtwork, TmdbRateLimitError, type Artwork } from '@/services/tmdb';

export type ArtworkEntry = Artwork | null;

export const ARTWORK_CACHE_STORAGE_KEY = 'artwork_cache_v1';

const MAX_CACHE_ENTRIES = 2000;
const PERSIST_DEBOUNCE_MS = 500;
const MAX_CONCURRENT_LOOKUPS = 4;
const MAX_RETRY_WAIT_MS = 10000;

// In-memory mirror of the persisted cache. Insertion order is used as the
// "oldest first" eviction order (a Map preserves insertion order, and
// re-setting a key does not move it, which is fine: we only care about
// bounding growth, not true LRU recency).
let memory = new Map<string, ArtworkEntry>();
let loaded = false;
let loadPromise: Promise<void> | null = null;

// In-flight lookups, deduped by rawName.
const inFlight = new Map<string, Promise<ArtworkEntry>>();

// --- tiny semaphore capping concurrent searchArtwork calls ---
let activeCount = 0;
const waiters: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeCount < MAX_CONCURRENT_LOOKUPS) {
    activeCount += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waiters.push(() => {
      activeCount += 1;
      resolve();
    });
  });
}

function releaseSlot(): void {
  activeCount -= 1;
  const next = waiters.shift();
  if (next) next();
}

// --- write-behind persistence, debounced ---
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistNow();
  }, PERSIST_DEBOUNCE_MS);
}

async function persistNow(): Promise<void> {
  const obj: Record<string, ArtworkEntry> = {};
  for (const [key, value] of memory) {
    obj[key] = value;
  }
  try {
    await AsyncStorage.setItem(ARTWORK_CACHE_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Storage error (disk full, etc): the in-memory cache is still correct,
    // just not durable for this write. Nothing to recover here - the next
    // scheduled persist will retry with whatever memory holds by then.
  }
}

function setCacheEntry(rawName: string, entry: ArtworkEntry): void {
  // Re-inserting a key that already exists keeps it in its original
  // insertion slot (Map semantics), which is fine for a simple cap.
  if (!memory.has(rawName) && memory.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = memory.keys().next().value;
    if (oldestKey !== undefined) memory.delete(oldestKey);
  }
  memory.set(rawName, entry);
  schedulePersist();
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(ARTWORK_CACHE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, ArtworkEntry>;
          const restored = new Map<string, ArtworkEntry>();
          for (const key of Object.keys(parsed)) {
            restored.set(key, parsed[key]);
          }
          memory = restored;
        }
      } catch {
        // Corrupt or unreadable persisted cache: start empty rather than throw.
        memory = new Map();
      } finally {
        loaded = true;
      }
    })();
  }
  await loadPromise;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function performLookup(
  rawName: string,
  parsedTitle: string,
  year?: number,
): Promise<ArtworkEntry> {
  await acquireSlot();
  try {
    // searchArtwork only resolves (rather than throwing) for a genuine
    // no-match, so a resolved result - hit or miss - is safe to persist.
    const result = await searchArtwork(parsedTitle, year);
    setCacheEntry(rawName, result);
    return result;
  } catch (err) {
    if (err instanceof TmdbRateLimitError) {
      const waitMs = Math.min(err.retryAfterMs, MAX_RETRY_WAIT_MS);
      await delay(waitMs);
      try {
        const retryResult = await searchArtwork(parsedTitle, year);
        setCacheEntry(rawName, retryResult);
        return retryResult;
      } catch {
        // Second failure (another 429 or a TmdbLookupError): transient, do
        // not persist a negative entry, just resolve null.
        return null;
      }
    }
    // A TmdbLookupError (network error, timeout, bad status, malformed
    // response) or anything else unexpected: transient by nature, so
    // resolve null WITHOUT persisting - a bad key or a dropped connection
    // must not become a permanent "no artwork" verdict for this release name.
    return null;
  } finally {
    releaseSlot();
  }
}

export async function lookupArtwork(rawName: string): Promise<ArtworkEntry> {
  await ensureLoaded();

  if (memory.has(rawName)) {
    return memory.get(rawName) ?? null;
  }

  const existing = inFlight.get(rawName);
  if (existing) return existing;

  const parsed = parseReleaseName(rawName);
  if (!parsed.title) {
    return null;
  }

  const promise = performLookup(rawName, parsed.title, parsed.year).finally(() => {
    inFlight.delete(rawName);
  });
  inFlight.set(rawName, promise);
  return promise;
}

export function peekArtwork(rawName: string): ArtworkEntry | undefined {
  return memory.has(rawName) ? (memory.get(rawName) ?? null) : undefined;
}

export async function clearArtworkCache(): Promise<void> {
  memory = new Map();
  inFlight.clear();
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  loaded = true;
  loadPromise = Promise.resolve();
  await AsyncStorage.removeItem(ARTWORK_CACHE_STORAGE_KEY);
}

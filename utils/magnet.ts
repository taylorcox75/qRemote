const MAGNET_PREFIX = 'magnet:?';

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const isMagnetLink = (value: string): boolean => value.trim().toLowerCase().startsWith(MAGNET_PREFIX);

/**
 * Extract a magnet URI from an arbitrary incoming URL.
 * Supports direct `magnet:?` links and app deep links that carry it in query params.
 */
export const extractMagnetLink = (incomingUrl?: string | null): string | null => {
  if (!incomingUrl) return null;

  const raw = incomingUrl.trim();
  if (!raw) return null;

  const decodedRaw = safeDecode(raw);
  if (isMagnetLink(decodedRaw)) {
    return decodedRaw;
  }

  try {
    const parsed = new URL(raw);
    const candidates = [
      parsed.searchParams.get('magnet'),
      parsed.searchParams.get('url'),
      parsed.searchParams.get('link'),
    ].filter((value): value is string => !!value);

    for (const candidate of candidates) {
      const decodedCandidate = safeDecode(candidate.trim());
      if (isMagnetLink(decodedCandidate)) {
        return decodedCandidate;
      }
    }
  } catch {
    // Ignore parse errors and try regex fallback.
  }

  const fallback = decodedRaw.match(/magnet:\?[^\s]+/i)?.[0];
  return fallback && isMagnetLink(fallback) ? fallback : null;
};

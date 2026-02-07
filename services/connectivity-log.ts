/**
 * Centralized in-memory log service for app connectivity events.
 *
 * Captures auth, API, and connection events that are normally only visible
 * in the Metro console.  The log is kept in memory (no AsyncStorage) so it
 * is fast and doesn't compete with the qBittorrent-server-log storage.
 *
 * A capped ring-buffer keeps memory usage bounded.
 */

const MAX_ENTRIES = 500;

export type ConnectivityLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface ConnectivityLogEntry {
  id: number;
  timestamp: number;       // Date.now()
  level: ConnectivityLogLevel;
  tag: string;             // e.g. 'AUTH', 'API', 'CONN', 'HTTP'
  message: string;
}

let entries: ConnectivityLogEntry[] = [];
let nextId = 1;

/**
 * Push a log entry.  Called from services (auth, client, server-manager).
 */
export function clog(
  level: ConnectivityLogLevel,
  tag: string,
  message: string,
): void {
  entries.push({
    id: nextId++,
    timestamp: Date.now(),
    level,
    tag,
    message,
  });

  // Trim oldest when we exceed the cap
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(entries.length - MAX_ENTRIES);
  }
}

/** Convenience helpers */
export const clogDebug = (tag: string, msg: string) => clog('DEBUG', tag, msg);
export const clogInfo  = (tag: string, msg: string) => clog('INFO',  tag, msg);
export const clogWarn  = (tag: string, msg: string) => clog('WARN',  tag, msg);
export const clogError = (tag: string, msg: string) => clog('ERROR', tag, msg);

/**
 * Return a *copy* of the current log (newest last).
 */
export function getConnectivityLog(): ConnectivityLogEntry[] {
  return [...entries];
}

/**
 * Clear the in-memory log.
 */
export function clearConnectivityLog(): void {
  entries = [];
  nextId = 1;
}

/**
 * Format the entire connectivity log as a human-readable string, ready for
 * inclusion in an exported report.
 */
export function formatConnectivityLog(): string {
  if (entries.length === 0) {
    return '(no connectivity log entries captured this session)';
  }

  return entries.map((e) => {
    const d = new Date(e.timestamp);
    const ts = d.toISOString().replace('T', ' ').replace('Z', '');
    return `${ts} [${e.level}] [${e.tag}] ${e.message}`;
  }).join('\n');
}

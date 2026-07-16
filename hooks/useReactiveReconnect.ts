/**
 * useReactiveReconnect.ts — shared "reconnect only when a request actually
 * failed" policy.
 *
 * checkAndReconnect always performs a full fresh login (server-manager has no
 * lightweight session-validity probe), and qBittorrent ties search jobs to
 * session state — so reconnecting eagerly (e.g. on every foreground return)
 * orphans in-progress searches. Instead, consumers pass their query's error
 * here and a reconnect fires only when polling actually failed in a way a
 * re-login can fix.
 *
 * A cooldown bounds login churn on flaky-but-alive connections: without it, a
 * server returning intermittent timeouts would trigger a full re-login on
 * every failing poll tick (2-3s), hammering the login endpoint and repeatedly
 * orphaning session-tied state.
 */
import { useEffect, useRef } from 'react';
import { useServer } from '@/context/ServerContext';
import { getErrorMessage } from '@/utils/error';

const RECONNECT_COOLDOWN_MS = 15_000;

// Error-message fragments produced by services/api/client.ts (and axios)
// that indicate the session or connection is gone and a re-login can help.
// Kept in one place so the trigger set can't silently drift between callers.
const RECONNECTABLE_MESSAGES = [
  'Authentication failed',
  'No server configured',
  'Connection timeout',
  'Network Error',
];

export function isReconnectableError(message: string): boolean {
  return RECONNECTABLE_MESSAGES.some((m) => message.includes(m));
}

export function useReactiveReconnect(queryError: unknown): void {
  const { isConnected, checkAndReconnect } = useServer();
  const reconnectingRef = useRef(false);
  const lastAttemptRef = useRef(0);

  useEffect(() => {
    if (!queryError || !isConnected || reconnectingRef.current) return;
    if (!isReconnectableError(getErrorMessage(queryError))) return;

    const now = Date.now();
    if (now - lastAttemptRef.current < RECONNECT_COOLDOWN_MS) return;
    lastAttemptRef.current = now;

    reconnectingRef.current = true;
    checkAndReconnect().finally(() => {
      reconnectingRef.current = false;
    });
  }, [queryError, isConnected, checkAndReconnect]);
}

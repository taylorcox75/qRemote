/**
 * authMode.ts — Derives a ServerConfig's authentication mode from its stored flags.
 *
 * Key exports: ServerAuthMode, getServerAuthMode, applyServerAuthMode
 */
import { ServerConfig } from '@/types/api';

export type ServerAuthMode = 'password' | 'apiKey' | 'none';

/**
 * The mode is derived rather than stored as its own field so legacy records
 * (only `bypassAuth` ever set) keep working unchanged. When both `useApiKey`
 * and `bypassAuth` are set — e.g. a hand-edited or imported record — API key
 * wins, since it is the more specific choice.
 */
export function getServerAuthMode(
  server: Pick<ServerConfig, 'useApiKey' | 'bypassAuth'>,
): ServerAuthMode {
  if (server.useApiKey) return 'apiKey';
  if (server.bypassAuth) return 'none';
  return 'password';
}

export interface AuthModeCredentials {
  username: string;
  password: string;
  apiKey: string;
}

/**
 * Blank out whichever credential fields don't apply to the given mode, the
 * way ServerConfig is meant to be persisted (mirrors the existing
 * useBasicAuth/useFallback conditional-blank pattern in the server forms).
 */
export function applyServerAuthMode(
  mode: ServerAuthMode,
  credentials: AuthModeCredentials,
): { username: string; password: string; bypassAuth: boolean; useApiKey: boolean; apiKey: string } {
  return {
    username: mode === 'password' ? credentials.username.trim() : '',
    password: mode === 'password' ? credentials.password.trim() : '',
    bypassAuth: mode === 'none',
    useApiKey: mode === 'apiKey',
    apiKey: mode === 'apiKey' ? credentials.apiKey.trim() : '',
  };
}

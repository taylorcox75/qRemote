import { ServerConfig, ServerEndpointKind } from '@/types/api';
import { DEFAULT_SERVER_ICON, ServerIconName } from '@/constants/serverIcons';

export const AVATAR_PALETTE = [
  '#0A84FF',
  '#30D158',
  '#FF9F0A',
  '#FF453A',
  '#BF5AF2',
  '#FF375F',
  '#5AC8FA',
  '#FFD60A',
];

/** Deterministic name-derived color, used for categories and tags (not servers —
 * a server's color must never shift on its own; see DEFAULT_AVATAR_COLOR). */
export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

/**
 * A server's badge color when it hasn't picked one — always this fixed
 * swatch, never derived from the server's name. Deriving from the name meant
 * the badge (and the Add/Edit preview) visibly changed color as the user
 * typed or edited the name, which reads as the app changing the color on its
 * own — the color should only ever change when the user picks one.
 */
export const DEFAULT_AVATAR_COLOR = AVATAR_PALETTE[0];

/** The icon a server's badge renders — its own choice, or DEFAULT_SERVER_ICON. */
export function getServerIcon(server: Pick<ServerConfig, 'icon'>): ServerIconName {
  return (server.icon as ServerIconName) || DEFAULT_SERVER_ICON;
}

/** The color a server's badge renders in — its own choice, or the fixed default. */
export function getServerIconColor(server: Pick<ServerConfig, 'iconColor'>): string {
  return server.iconColor || DEFAULT_AVATAR_COLOR;
}

export function serverAddress(server: ServerConfig): string {
  const port = server.port && server.port > 0 ? `:${server.port}` : '';
  return `${server.host}${port}`;
}

export function hasFallback(server: ServerConfig): boolean {
  return server.useFallback === true && !!server.fallbackHost?.trim();
}

export function resolveServerEndpoint(
  server: ServerConfig,
  endpoint: ServerEndpointKind,
): ServerConfig {
  if (endpoint === 'fallback' && hasFallback(server)) {
    return {
      ...server,
      host: server.fallbackHost!.trim(),
      port: server.fallbackPort,
      useHttps: server.fallbackUseHttps ?? server.useHttps,
      basePath: server.fallbackBasePath || server.basePath || '/',
    };
  }
  return {
    ...server,
    host: server.host.trim(),
    basePath: server.basePath || '/',
  };
}

export function getServerEndpointLabel(server: ServerConfig, endpoint: ServerEndpointKind): string {
  return serverAddress(resolveServerEndpoint(server, endpoint));
}

export function getActiveEndpoint(
  server: ServerConfig,
  activeServer: ServerConfig | null,
): ServerEndpointKind | null {
  if (!activeServer || activeServer.id !== server.id) {
    return null;
  }

  const primary = resolveServerEndpoint(server, 'primary');
  if (
    activeServer.host === primary.host &&
    (activeServer.port || undefined) === (primary.port || undefined) &&
    !!activeServer.useHttps === !!primary.useHttps
  ) {
    return 'primary';
  }

  if (!hasFallback(server)) {
    return null;
  }

  const fallback = resolveServerEndpoint(server, 'fallback');
  if (
    activeServer.host === fallback.host &&
    (activeServer.port || undefined) === (fallback.port || undefined) &&
    !!activeServer.useHttps === !!fallback.useHttps
  ) {
    return 'fallback';
  }

  return null;
}

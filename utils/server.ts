import { ServerConfig, ServerEndpointKind } from '@/types/api';

export const AVATAR_PALETTE = [
  '#0A84FF', '#30D158', '#FF9F0A', '#FF453A',
  '#BF5AF2', '#FF375F', '#5AC8FA', '#FFD60A',
];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
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
  endpoint: ServerEndpointKind
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
  activeServer: ServerConfig | null
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

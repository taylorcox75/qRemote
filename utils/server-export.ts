/**
 * server-export.ts — Pure build/parse logic for the server-list export file
 * (Settings → Servers → Export/Import Servers).
 *
 * Secrets (`password`, `basicAuthPassword`, `apiKey`) are NEVER written to an
 * export and are forced empty on import regardless of what a file contains —
 * the same rule `services/storage.ts` applies before anything reaches
 * AsyncStorage. Auth mode flags and usernames are kept so an imported server
 * only needs its secret re-entered.
 *
 * Key exports: SERVER_EXPORT_KIND, ServerExportFile, buildServerExport, parseServerImport
 */
import { ServerConfig } from '@/types/api';

export const SERVER_EXPORT_KIND = 'qremote-server-export';
export const SERVER_EXPORT_VERSION = 1;

export interface ServerExportFile {
  kind: typeof SERVER_EXPORT_KIND;
  version: typeof SERVER_EXPORT_VERSION;
  exportedAt: string;
  servers: ServerConfig[];
}

function sanitizePort(value: unknown): number | undefined {
  const port = typeof value === 'string' ? Number(value) : value;
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    return undefined;
  }
  return port;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Strip every secret from a server config, keeping connection settings, auth
 * mode flags, and usernames. Field-by-field (not `...spread`) so a future
 * secret added to ServerConfig is excluded by default instead of leaking.
 */
export function toExportedServer(server: ServerConfig): ServerConfig {
  return {
    id: server.id,
    name: server.name,
    host: server.host,
    port: sanitizePort(server.port),
    basePath: optionalString(server.basePath),
    username: server.username || '',
    password: '',
    useHttps: server.useHttps === true,
    bypassAuth: server.bypassAuth === true,
    useFallback: server.useFallback === true,
    fallbackHost: optionalString(server.fallbackHost) ?? '',
    fallbackPort: sanitizePort(server.fallbackPort),
    fallbackUseHttps: server.fallbackUseHttps === true,
    fallbackBasePath: optionalString(server.fallbackBasePath),
    useBasicAuth: server.useBasicAuth === true,
    basicAuthUsername: server.basicAuthUsername || '',
    basicAuthPassword: '',
    useApiKey: server.useApiKey === true,
    apiKey: '',
  };
}

export function buildServerExport(
  servers: ServerConfig[],
  now: Date = new Date(),
): ServerExportFile {
  return {
    kind: SERVER_EXPORT_KIND,
    version: SERVER_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    servers: servers.map(toExportedServer),
  };
}

/**
 * Parse and validate an export file's JSON text back into server configs.
 *
 * @throws Error with a human-readable message when the text isn't valid JSON,
 *   isn't a qRemote server export, or contains no usable server entries.
 *   Entries missing the required `name`/`host` strings are skipped rather than
 *   failing the whole import; an `id` is generated when absent so hand-edited
 *   files still import.
 */
export function parseServerImport(jsonText: string): ServerConfig[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Not a valid JSON file.');
  }

  const envelope = parsed as Partial<ServerExportFile> | null;
  if (
    !envelope ||
    typeof envelope !== 'object' ||
    envelope.kind !== SERVER_EXPORT_KIND ||
    !Array.isArray(envelope.servers)
  ) {
    throw new Error('Not a qRemote server export file.');
  }

  const servers: ServerConfig[] = [];
  for (const entry of envelope.servers as unknown[]) {
    if (!entry || typeof entry !== 'object') continue;
    const raw = entry as Record<string, unknown>;
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    const host = typeof raw.host === 'string' ? raw.host.trim() : '';
    if (!name || !host) continue;

    servers.push(
      toExportedServer({
        ...(raw as Partial<ServerConfig>),
        id:
          typeof raw.id === 'string' && raw.id.trim()
            ? raw.id.trim()
            : `${Date.now()}-${servers.length}`,
        name,
        host,
        username: typeof raw.username === 'string' ? raw.username : '',
        password: '',
      }),
    );
  }

  if (servers.length === 0) {
    throw new Error('The file contains no usable server entries.');
  }

  return servers;
}

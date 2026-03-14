import { ServerConfig } from '@/types/api';

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

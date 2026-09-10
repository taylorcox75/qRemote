/**
 * [hash].tsx — Torrent detail route.
 *
 * The actual detail body (hero, actions, all grouped sections, and every
 * modal) lives in components/torrent-detail/TorrentDetailBody.tsx so it can
 * also be rendered embedded in a split-view detail pane on regular/mac
 * layout idioms. This file just reads the route param and renders it full
 * screen, exactly as before the split (#Phase B shell work).
 *
 * Key exports: TorrentDetail (default)
 */
import { useLocalSearchParams } from 'expo-router';
import { TorrentDetailBody } from '@/components/torrent-detail/TorrentDetailBody';

export default function TorrentDetail() {
  const { hash } = useLocalSearchParams<{ hash: string }>();
  return <TorrentDetailBody hash={hash} />;
}

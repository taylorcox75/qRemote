import React from 'react';
import Animated from 'react-native-reanimated';
import { TorrentCard } from './TorrentCard';
import { TorrentInfo } from '../types/api';

interface SharedTransitionCardProps {
  torrent: TorrentInfo;
  viewMode?: 'compact' | 'expanded';
  onPress: () => void;
}

/**
 * Torrent card with shared element transition support
 * Creates smooth morphing animation when navigating to detail page
 */
export function SharedTransitionCard({
  torrent,
  viewMode,
  onPress,
}: SharedTransitionCardProps) {
  return (
    <Animated.View sharedTransitionTag={`torrent-${torrent.hash}`}>
      <TorrentCard torrent={torrent} viewMode={viewMode} onPress={onPress} />
    </Animated.View>
  );
}



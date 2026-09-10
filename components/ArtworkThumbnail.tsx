/**
 * ArtworkThumbnail.tsx - Poster-style TMDB artwork thumbnail for a torrent
 * row, mirroring Pogona/DesignSystem/ArtworkCache.swift's ArtworkThumbnail:
 * a 2:3 poster crop (or square) with a rounded plate, an Ionicons
 * placeholder while there's no image, and no spinner while loading.
 *
 * Renders `null` when the artwork feature is inactive (not enabled, or no
 * TMDB key configured) so screens that don't opt in are visually unchanged
 * - unless the caller explicitly asks for the placeholder anyway via
 * `showPlaceholderWhenInactive` (e.g. a settings preview).
 */
import React from 'react';
import { Image, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useArtworkSettings } from '@/context/ArtworkContext';
import { useArtwork } from '@/hooks/useArtwork';
import { posterUrl } from '@/services/tmdb';
import { borderRadius } from '@/constants/spacing';

// Poster aspect ~= 2:3 (width:height) -> height = width * 1.5, matching the
// Swift source's `thumbHeight`.
const ASPECT = 1.5;

interface ArtworkThumbnailProps {
  /** Raw release/torrent name - parsed internally by the artwork lookup. */
  name: string;
  width: number;
  /** Square crop instead of the default 2:3 poster crop. */
  square?: boolean;
  placeholderIcon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  /** Render the placeholder plate even when the feature is inactive.
   * Default false - existing layouts that don't opt in stay untouched. */
  showPlaceholderWhenInactive?: boolean;
}

function placeholderIconSize(width: number, square?: boolean): number {
  // Scaled steps mirroring the Swift source's placeholderFont sizing.
  if (width >= 100) return 28;
  if (square || width >= 28) return 18;
  return 14;
}

export function ArtworkThumbnail({
  name,
  width,
  square,
  placeholderIcon = 'film-outline',
  style,
  showPlaceholderWhenInactive = false,
}: ArtworkThumbnailProps) {
  const { colors } = useTheme();
  const { active } = useArtworkSettings();
  const { artwork, loading } = useArtwork(name);

  if (!active && !showPlaceholderWhenInactive) {
    return null;
  }

  const height = square ? width : width * ASPECT;
  const posterSize = width >= 100 ? 'w342' : 'w154';
  const uri = active && artwork?.posterPath ? posterUrl(artwork.posterPath, posterSize) : null;
  // While loading, or with no artwork/no poster path, show the placeholder
  // plate instead of a spinner.
  const showImage = active && !loading && !!uri;

  return (
    <View
      testID="artwork-thumbnail-plate"
      style={[
        styles.plate,
        {
          width,
          height,
          borderRadius: borderRadius.xsmall,
          backgroundColor: colors.surfaceOutline,
        },
        style,
      ]}
    >
      {showImage ? (
        <Image
          testID="artwork-thumbnail-image"
          source={{ uri: uri as string }}
          resizeMode="cover"
          style={[styles.image, { borderRadius: borderRadius.xsmall }]}
        />
      ) : (
        <Ionicons
          testID="artwork-thumbnail-placeholder"
          name={placeholderIcon}
          size={placeholderIconSize(width, square)}
          color={colors.textSecondary}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

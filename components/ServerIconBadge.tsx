/**
 * ServerIconBadge.tsx — Tinted icon badge for a server, used anywhere a server
 * is listed (Quick Connect, Settings → Servers). Icon and color come from the
 * server's own customization (#224), falling back to a default icon and a
 * name-derived color so every server still looks distinct out of the box.
 *
 * Key exports: ServerIconBadge
 */
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ServerConfig } from '@/types/api';
import { getServerIcon, getServerIconColor } from '@/utils/server';
import { borderRadius } from '@/constants/spacing';

interface ServerIconBadgeProps {
  server: Pick<ServerConfig, 'name' | 'icon' | 'iconColor'>;
  size?: number;
  style?: ViewStyle;
}

export function ServerIconBadge({ server, size = 44, style }: ServerIconBadgeProps) {
  const icon = getServerIcon(server);
  const color = getServerIconColor(server);

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size * (borderRadius.medium / 44),
          backgroundColor: color + '22',
          borderColor: color + '44',
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
});

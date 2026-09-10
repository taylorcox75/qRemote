import React, { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useShell } from '@/context/ShellContext';
import { useTheme } from '@/context/ThemeContext';

/**
 * Centers form-style content (Transfer, Settings, Search, RSS) in a
 * macOS-style column on the regular and mac idioms, the way System
 * Settings and Pogona's Mac settings keep forms at ~720pt instead of
 * stretching rows across a 1400pt window. On compact it renders children
 * untouched (a plain pass-through, no extra view).
 */
export const DESKTOP_COLUMN_MAX_WIDTH = 760;

interface DesktopColumnProps {
  children: ReactNode;
}

export function DesktopColumn({ children }: DesktopColumnProps) {
  const { idiom } = useShell();
  const { colors } = useTheme();
  if (idiom === 'compact') {
    return <>{children}</>;
  }
  return (
    <View style={[styles.outer, { backgroundColor: colors.background }]}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: DESKTOP_COLUMN_MAX_WIDTH,
  },
});

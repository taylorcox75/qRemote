/**
 * DebugRow.tsx — Shared label/value row for connection debug info panels.
 * Used by app/server/add.tsx and app/server/[id].tsx to avoid duplicating
 * the same debug-info row markup and styling in both screens.
 */
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

interface DebugRowProps {
  label: string;
  value: string;
  selectable?: boolean;
  numberOfLines?: number;
}

export function DebugRow({ label, value, selectable, numberOfLines }: DebugRowProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text
        style={[styles.value, { color: colors.text }]}
        selectable={selectable}
        numberOfLines={numberOfLines}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'flex-start',
  },
  label: {
    width: 70,
    fontSize: 12,
    fontWeight: '600',
  },
  value: {
    flex: 1,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

/**
 * SplitLayout.tsx - Desktop/iPad shell frame (Phase B): sidebar | content |
 * optional detail pane, each separated by a 1px colors.surfaceOutline line.
 * Only rendered on 'regular'/'mac' layouts (see hooks/useLayoutIdiom.ts) -
 * 'compact' screens don't mount this component at all.
 *
 * Key exports: SplitLayout
 */
import React, { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

interface SplitLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  detail?: ReactNode;
  sidebarWidth?: number;
  detailWidth?: number;
  sidebarCollapsed?: boolean;
}

export function SplitLayout({
  sidebar,
  children,
  detail,
  sidebarWidth = 240,
  detailWidth = 380,
  sidebarCollapsed = false,
}: SplitLayoutProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: colors.background }]} testID="split-layout">
      <View
        testID="split-layout-sidebar"
        style={[
          styles.sidebar,
          {
            width: sidebarCollapsed ? 0 : sidebarWidth,
            backgroundColor: colors.surface,
            borderRightColor: colors.surfaceOutline,
            borderRightWidth: sidebarCollapsed ? 0 : StyleSheet.hairlineWidth,
          },
        ]}
      >
        {!sidebarCollapsed && sidebar}
      </View>

      <View
        testID="split-layout-content"
        style={[styles.content, { backgroundColor: colors.background }]}
      >
        {children}
      </View>

      {detail !== undefined && (
        <View
          testID="split-layout-detail"
          style={[
            styles.detail,
            {
              width: detailWidth,
              backgroundColor: colors.background,
              borderLeftColor: colors.surfaceOutline,
              borderLeftWidth: StyleSheet.hairlineWidth,
            },
          ]}
        >
          {detail}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    flexShrink: 0,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  detail: {
    flexShrink: 0,
  },
});

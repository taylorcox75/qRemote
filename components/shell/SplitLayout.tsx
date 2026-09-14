/**
 * SplitLayout.tsx - Desktop/iPad shell frame (Phase B): sidebar | content |
 * optional detail pane, each separated by a 1px colors.surfaceOutline line.
 * Only rendered on 'regular'/'mac' layouts (see hooks/useLayoutIdiom.ts) -
 * 'compact' screens don't mount this component at all.
 *
 * Key exports: SplitLayout
 */
import React, { ReactNode } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { hexToRgba } from '@/utils/color';
import { desktopMetrics } from '@/constants/desktop';

interface SplitLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  detail?: ReactNode;
  sidebarWidth?: number;
  detailWidth?: number;
  sidebarCollapsed?: boolean;
  /** Shown when the sidebar is collapsed so it can be opened again (mac). */
  onExpandSidebar?: () => void;
}

export function SplitLayout({
  sidebar,
  children,
  detail,
  sidebarWidth = 240,
  detailWidth = 380,
  sidebarCollapsed = false,
  onExpandSidebar,
}: SplitLayoutProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const mac = desktopMetrics('mac');

  return (
    <View style={[styles.row, { backgroundColor: colors.background }]} testID="split-layout">
      <View
        testID="split-layout-sidebar"
        style={[
          styles.sidebar,
          {
            width: sidebarCollapsed ? 0 : sidebarWidth,
            backgroundColor: colors.surface,
            borderRightColor: hexToRgba(colors.text, 0.08),
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
        {sidebarCollapsed && onExpandSidebar ? (
          <Pressable
            testID="split-layout-expand"
            onPress={onExpandSidebar}
            accessibilityRole="button"
            accessibilityLabel={t('sidebar.expand')}
            style={[
              styles.expandHit,
              {
                top: 0,
                left: mac.trafficLightsWidth,
                height: mac.titlebarHeight,
                width: mac.titlebarHeight,
              },
            ]}
          >
            <Ionicons name="menu-outline" size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}
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
  expandHit: {
    position: 'absolute',
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detail: {
    flexShrink: 0,
  },
});

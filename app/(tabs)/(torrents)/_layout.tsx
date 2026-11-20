import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useGlassStackContentStyle } from '@/context/LiquidGlassContext';
import { PaneLayout, TorrentSplitContext } from '@/context/PaneLayoutContext';
import { useTheme } from '@/context/ThemeContext';
import { useServer } from '@/context/ServerContext';
import { useTabBarSide } from '@/hooks/useReadableLayout';
import { TorrentDetailView } from './torrent/[hash]';
import { getSplitLayout } from '@/utils/split-view';
import { spacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';

/**
 * Stack under the Torrents tab so list → detail → files/trackers
 * keeps the bottom tab bar visible (same pattern as settings/).
 *
 * On wide windows (iPhone Duo unfolded, iPad) the list sits in a column and
 * the selected torrent's detail fills the rest (utils/split-view.ts). The
 * Stack keeps the same place in the tree either way, so folding/unfolding or
 * pushing a screen (which drops back to full width) never loses its history.
 */
/** The Stack, reading its side insets from inside its pane. */
function TorrentsStack() {
  const contentStyle = useGlassStackContentStyle();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        contentStyle,
      }}
    />
  );
}

export default function TorrentsLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const tabBarSide = useTabBarSide();
  const { currentServer, isConnected } = useServer();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [selectedHash, setSelectedHash] = useState<string | null>(null);

  const { split, listWidth } = getSplitLayout(width, insets, pathname);

  // A selection belongs to one server's list.
  const serverId = currentServer?.id;
  useEffect(() => {
    setSelectedHash(null);
  }, [serverId, isConnected]);

  const listPane = useMemo(
    () => (split ? { width: listWidth, insets: { ...insets, right: 0 }, tabBarSide } : null),
    [split, listWidth, insets, tabBarSide],
  );
  const detailPane = useMemo(
    () => (split ? { width: width - listWidth, insets: { ...insets, left: 0 }, tabBarSide } : null),
    [split, width, listWidth, insets, tabBarSide],
  );
  const splitValue = useMemo(
    () => ({ active: split, selectedHash, select: setSelectedHash }),
    [split, selectedHash],
  );

  return (
    <TorrentSplitContext.Provider value={splitValue}>
      <View style={[styles.row, { backgroundColor: colors.background }]}>
        <View style={split ? { width: listWidth } : styles.fill}>
          <PaneLayout pane={listPane}>
            <TorrentsStack />
          </PaneLayout>
        </View>
        {split && detailPane && (
          <View
            style={[styles.fill, styles.detailPane, { borderLeftColor: colors.surfaceOutline }]}
          >
            {/* A margin, not padding: the detail's floating glass header is
                absolutely positioned, and absolute children ignore padding. */}
            <View style={[styles.fill, { marginRight: insets.right }]}>
              <PaneLayout pane={detailPane}>
                {selectedHash ? (
                  <TorrentDetailView
                    key={selectedHash}
                    hash={selectedHash}
                    embedded
                    onClose={() => setSelectedHash(null)}
                  />
                ) : (
                  <View style={styles.placeholder}>
                    <Ionicons name="albums-outline" size={48} color={colors.textSecondary} />
                    <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
                      {t('screens.torrents.splitPlaceholder')}
                    </Text>
                  </View>
                )}
              </PaneLayout>
            </View>
          </View>
        )}
      </View>
    </TorrentSplitContext.Provider>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  fill: { flex: 1 },
  detailPane: { borderLeftWidth: StyleSheet.hairlineWidth },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  placeholderText: { ...typography.body, textAlign: 'center', paddingHorizontal: spacing.xl },
});

// A render error in this tab shows a retry screen inside the tab instead of
// taking down the whole app (tabs mount eagerly under native tabs — #334).
export { AppErrorBoundary as ErrorBoundary } from '@/components/AppErrorBoundary';

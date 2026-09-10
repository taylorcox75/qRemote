/**
 * MacStatusBar.tsx - qBittorrent-style bottom status bar for the 'mac'
 * layout idiom, mirroring Pogona's Features/Main/MacTransfersView.swift
 * `MacStatusBar`: DHT node count, a connection-state dot, an alternative-
 * speed-limits toggle, then down/up speeds (with session totals in
 * parentheses), free disk space and the global ratio.
 *
 * Reads its own data - no props. Renders nothing while `serverState` is
 * unavailable (not yet synced, or disconnected).
 *
 * Only rendered on the 'mac' layout idiom - the iPhone ('compact') and
 * iPad ('regular') layouts are untouched by this component.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useTorrents } from '@/context/TorrentContext';
import { useTransfer } from '@/context/TransferContext';
import { formatSpeed, formatSize } from '@/utils/format';
import { spacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';

const BAR_HEIGHT = 24;

export function MacStatusBar() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { serverState } = useTorrents();
  const { toggleAlternativeSpeedLimits } = useTransfer();

  if (!serverState) {
    return null;
  }

  const dhtNodes = serverState.dht_nodes ?? 0;
  const connectionStatus = serverState.connection_status ?? 'disconnected';
  const altSpeedActive = serverState.use_alt_speed_limits ?? false;
  const dlSpeed = serverState.dl_info_speed ?? 0;
  const dlData = serverState.dl_info_data ?? 0;
  const upSpeed = serverState.up_info_speed ?? 0;
  const upData = serverState.up_info_data ?? 0;
  const freeSpace = serverState.free_space_on_disk ?? 0;
  const globalRatio = serverState.global_ratio ?? '0.00';

  const connectionColor =
    connectionStatus === 'connected'
      ? colors.success
      : connectionStatus === 'firewalled'
        ? colors.warning
        : colors.error;

  const downloadText = `${formatSpeed(dlSpeed)} (${formatSize(dlData)})`;
  const uploadText = `${formatSpeed(upSpeed)} (${formatSize(upData)})`;

  return (
    <View
      testID="mac-status-bar"
      style={[
        styles.bar,
        { backgroundColor: colors.surface, borderTopColor: colors.surfaceOutline },
      ]}
    >
      <View
        style={styles.segment}
        accessibilityLabel={t('statusBar.dhtNodesLabel', { count: dhtNodes })}
      >
        <Ionicons name="git-network-outline" size={14} color={colors.textSecondary} />
        <Text style={[typography.caption, styles.segmentText, { color: colors.textSecondary }]}>
          {dhtNodes}
        </Text>
      </View>

      <View
        testID="mac-status-bar-connection-dot"
        style={[styles.connectionDot, { backgroundColor: connectionColor }]}
        accessibilityLabel={t(`statusBar.connection.${connectionStatus}`)}
      />

      <Pressable
        testID="mac-status-bar-alt-speed"
        onPress={toggleAlternativeSpeedLimits}
        accessibilityRole="button"
        accessibilityState={{ selected: altSpeedActive }}
        accessibilityLabel={t(
          altSpeedActive ? 'statusBar.toggleAltSpeedOff' : 'statusBar.toggleAltSpeedOn',
        )}
      >
        <Ionicons
          name={altSpeedActive ? 'speedometer' : 'speedometer-outline'}
          size={14}
          color={altSpeedActive ? colors.warning : colors.textSecondary}
        />
      </Pressable>

      <View style={[styles.divider, { backgroundColor: colors.surfaceOutline }]} />

      <View
        style={styles.segment}
        accessibilityLabel={t('statusBar.downloadSpeedLabel', { value: downloadText })}
      >
        <Ionicons name="arrow-down" size={14} color={colors.stateDownloading} />
        <Text style={[typography.caption, styles.segmentText, { color: colors.textSecondary }]}>
          {downloadText}
        </Text>
      </View>

      <View
        style={styles.segment}
        accessibilityLabel={t('statusBar.uploadSpeedLabel', { value: uploadText })}
      >
        <Ionicons name="arrow-up" size={14} color={colors.stateSeeding} />
        <Text style={[typography.caption, styles.segmentText, { color: colors.textSecondary }]}>
          {uploadText}
        </Text>
      </View>

      <View style={styles.spacer} />

      <View
        style={styles.segment}
        accessibilityLabel={t('statusBar.freeSpaceLabel', { value: formatSize(freeSpace) })}
      >
        <Ionicons name="server-outline" size={14} color={colors.textSecondary} />
        <Text style={[typography.caption, styles.segmentText, { color: colors.textSecondary }]}>
          {formatSize(freeSpace)}
        </Text>
      </View>

      <View
        style={styles.segment}
        accessibilityLabel={t('statusBar.globalRatioLabel', { value: globalRatio })}
      >
        <Ionicons name="swap-vertical-outline" size={14} color={colors.textSecondary} />
        <Text style={[typography.caption, styles.segmentText, { color: colors.textSecondary }]}>
          {globalRatio}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_HEIGHT,
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  segmentText: {
    fontVariant: ['tabular-nums'],
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  divider: {
    width: 1,
    height: 12,
  },
  spacer: {
    flex: 1,
  },
});

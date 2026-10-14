/**
 * ServerSwitcherModal.tsx — Quick server switcher sheet (#249).
 *
 * Opened from a compact badge in the torrents screen header. Lists every
 * saved server, marks the connected one, and switches directly to whichever
 * other one is tapped — mirrors QuickConnectPanel's row treatment (icon
 * badge, address, per-row error/spinner) since that's the UI both the issue
 * reporter and a commenter praised. Owns its own transient switching/error
 * state, like CategoryModal owns `busy` — callers just hand it a list and an
 * async `onSelectServer`.
 *
 * Key exports: ServerSwitcherModal
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { ServerConfig } from '@/types/api';
import { ServerIconBadge } from '@/components/ServerIconBadge';
import { getServerIconColor, serverAddress } from '@/utils/server';
import { withAlpha } from '@/utils/color';
import { getErrorMessage } from '@/utils/error';
import { localizeErrorMessage } from '@/utils/localize-error';
import { haptics } from '@/utils/haptics';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';

interface ServerSwitcherModalProps {
  visible: boolean;
  servers: ServerConfig[];
  currentServerId: string | null;
  /** Same contract as ServerContext's connectToServer: resolves false (not a throw) on bad credentials. */
  onSelectServer: (server: ServerConfig) => Promise<boolean>;
  onManageServers: () => void;
  onClose: () => void;
}

export function ServerSwitcherModal({
  visible,
  servers,
  currentServerId,
  onSelectServer,
  onManageServers,
  onClose,
}: ServerSwitcherModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [switchErrors, setSwitchErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setSwitchingId(null);
      setSwitchErrors({});
    }
  }, [visible]);

  const handlePress = async (server: ServerConfig) => {
    if (server.id === currentServerId) {
      onClose();
      return;
    }
    haptics.medium();
    setSwitchingId(server.id);
    setSwitchErrors((prev) => {
      const next = { ...prev };
      delete next[server.id];
      return next;
    });
    try {
      const connected = await onSelectServer(server);
      if (connected) {
        onClose();
      } else {
        setSwitchErrors((prev) => ({ ...prev, [server.id]: t('errors.checkCredentials') }));
        haptics.error();
      }
    } catch (err: unknown) {
      setSwitchErrors((prev) => ({
        ...prev,
        [server.id]: localizeErrorMessage(getErrorMessage(err), t),
      }));
      haptics.error();
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
      accessibilityLabel={t('screens.torrents.switchServer')}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.card,
            shadows.medium,
            { backgroundColor: colors.surface, borderColor: colors.surfaceOutline },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: colors.surfaceOutline }]}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('screens.torrents.switchServer')}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {servers.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('screens.torrents.notConnectedSubtitle')}
            </Text>
          ) : (
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {servers.map((server, index) => {
                const color = getServerIconColor(server);
                const addr = serverAddress(server);
                const isCurrent = server.id === currentServerId;
                const isSwitchingThis = switchingId === server.id;
                const errMsg = switchErrors[server.id];
                const isLast = index === servers.length - 1;
                return (
                  <View key={server.id}>
                    <TouchableOpacity
                      style={styles.row}
                      onPress={() => {
                        void handlePress(server);
                      }}
                      activeOpacity={0.7}
                      disabled={switchingId !== null}
                      accessibilityLabel={server.name}
                      accessibilityState={{ selected: isCurrent }}
                    >
                      <ServerIconBadge server={server} size={40} />
                      <View style={styles.rowBody}>
                        <Text style={[styles.rowText, { color: colors.text }]} numberOfLines={1}>
                          {server.name}
                        </Text>
                        <View style={styles.addressRow}>
                          {server.useHttps && (
                            <Ionicons
                              name="lock-closed"
                              size={10}
                              color={colors.success}
                              style={{ marginRight: 3 }}
                            />
                          )}
                          <Text
                            style={[styles.rowMeta, { color: colors.textSecondary }]}
                            numberOfLines={1}
                          >
                            {addr}
                          </Text>
                        </View>
                        {errMsg && (
                          <Text
                            style={[styles.errorText, { color: colors.error }]}
                            numberOfLines={1}
                          >
                            {errMsg}
                          </Text>
                        )}
                      </View>
                      {isCurrent ? (
                        <View
                          style={[
                            styles.currentPill,
                            { backgroundColor: withAlpha(colors.primary, 0.09) },
                          ]}
                        >
                          <Ionicons name="checkmark" size={14} color={colors.primary} />
                          <Text style={[styles.currentPillText, { color: colors.primary }]}>
                            {t('screens.torrents.currentServer')}
                          </Text>
                        </View>
                      ) : isSwitchingThis ? (
                        <ActivityIndicator size="small" color={color} />
                      ) : (
                        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                    {!isLast && (
                      <View style={[styles.divider, { backgroundColor: colors.surfaceOutline }]} />
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[styles.manageRow, { borderTopColor: colors.surfaceOutline }]}
            onPress={onManageServers}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={18} color={colors.primary} />
            <Text style={[styles.manageRowText, { color: colors.primary }]}>
              {t('screens.torrents.manageServers')}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '90%',
    maxWidth: 480,
    maxHeight: '75%',
    borderRadius: borderRadius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  title: { ...typography.h3, fontSize: 18 },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowMeta: {
    fontSize: 12,
    fontWeight: '400',
  },
  errorText: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  currentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    flexShrink: 0,
  },
  currentPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
  },
  emptyText: {
    ...typography.secondary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  manageRowText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

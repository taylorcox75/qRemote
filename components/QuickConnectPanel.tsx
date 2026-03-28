import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ServerConfig } from '@/types/api';
import { useTheme } from '@/context/ThemeContext';
import { avatarColor, serverAddress } from '@/utils/server';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { shadows } from '@/constants/shadows';
import { spacing, borderRadius } from '@/constants/spacing';
import { buttonStyles, buttonText } from '@/constants/buttons';
import { typography } from '@/constants/typography';

interface QuickConnectPanelProps {
  savedServers: ServerConfig[];
  serversLoaded: boolean;
  connectingId: string | null;
  connectErrors: Record<string, string>;
  onConnect: (server: ServerConfig) => void;
  onAddServer: () => void;
}

export function QuickConnectPanel({
  savedServers,
  serversLoaded,
  connectingId,
  connectErrors,
  onConnect,
  onAddServer,
}: QuickConnectPanelProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  if (!serversLoaded || savedServers.length === 0) {
    return (
      <>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Ionicons name="navigate-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('screens.torrents.notConnected')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {t('screens.torrents.notConnectedSubtitle')}
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: colors.primary }]}
            onPress={onAddServer}
          >
            <Text style={styles.emptyButtonText}>{t('screens.settings.addServer')}</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={[styles.iconRing, { borderColor: colors.surfaceOutline }]}>
            <Ionicons name="navigate-outline" size={36} color={colors.textSecondary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text, marginTop: spacing.lg, fontSize: 20 }]}>
            {t('screens.torrents.notConnected')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {t('screens.torrents.notConnectedSubtitle')}
          </Text>
        </View>

        <View style={styles.serversSection}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            {t('screens.torrents.yourServers', { defaultValue: 'YOUR SERVERS' })}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {savedServers.map((server, index) => {
              const color = avatarColor(server.name);
              const addr = serverAddress(server);
              const isConnectingThis = connectingId === server.id;
              const errMsg = connectErrors[server.id];
              const isLast = index === savedServers.length - 1;
              return (
                <View key={server.id}>
                  <TouchableOpacity
                    style={styles.serverRow}
                    onPress={() => onConnect(server)}
                    activeOpacity={0.7}
                    disabled={connectingId !== null}
                  >
                    <View style={[styles.serverAvatar, { backgroundColor: color + '22', borderColor: color + '44' }]}>
                      <Text style={[styles.serverAvatarLetter, { color }]}>
                        {server.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.serverInfo}>
                      <Text style={[styles.serverName, { color: colors.text }]} numberOfLines={1}>
                        {server.name}
                      </Text>
                      <View style={styles.serverAddressRow}>
                        {server.useHttps && (
                          <Ionicons name="lock-closed" size={10} color={colors.success} style={{ marginRight: 3 }} />
                        )}
                        <Text style={[styles.serverAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                          {addr}
                        </Text>
                      </View>
                      {errMsg && (
                        <Text style={[styles.serverErrorText, { color: colors.error }]} numberOfLines={1}>
                          {errMsg}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.connectPill, { backgroundColor: errMsg ? colors.error + '18' : color + '18', borderColor: errMsg ? colors.error + '40' : color + '40' }]}>
                      {isConnectingThis
                        ? <ActivityIndicator size="small" color={color} />
                        : <Text style={[styles.connectPillText, { color: errMsg ? colors.error : color }]}>
                            {errMsg ? t('common.retry', { defaultValue: 'Retry' }) : t('common.connect', { defaultValue: 'Connect' })}
                          </Text>
                      }
                    </View>
                  </TouchableOpacity>
                  {!isLast && <View style={[styles.divider, { backgroundColor: colors.surfaceOutline }]} />}
                </View>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.addServerRow, { borderColor: colors.surfaceOutline }]}
          onPress={onAddServer}
          activeOpacity={0.7}
        >
          <View style={[styles.addServerIcon, { backgroundColor: colors.surface, borderColor: colors.surfaceOutline }]}>
            <Ionicons name="add" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.addServerText, { color: colors.primary }]}>
            {t('common.connect', { defaultValue: 'Connect' })}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.secondary,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '500',
  },
  emptyButton: {
    ...buttonStyles.primary,
    marginTop: spacing.sm,
  },
  emptyButtonText: {
    ...buttonText.primary,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 72,
    paddingBottom: spacing.xxxl,
  },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serversSection: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    borderRadius: borderRadius.large,
    overflow: 'hidden',
    ...shadows.card,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    gap: spacing.md,
  },
  divider: {
    height: 0.5,
    marginLeft: 68,
  },
  serverAvatar: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  serverAvatarLetter: {
    fontSize: 18,
    fontWeight: '700',
  },
  serverInfo: {
    flex: 1,
    minWidth: 0,
  },
  serverName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  serverAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serverAddress: {
    fontSize: 12,
    fontWeight: '400',
  },
  serverErrorText: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  connectPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  connectPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  addServerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.large,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  addServerIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addServerText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

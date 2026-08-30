import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { OptionPicker, OptionPickerItem } from '@/components/OptionPicker';
import { InputModal } from '@/components/InputModal';
import { applicationApi } from '@/services/api/application';
import { ApplicationPreferences } from '@/types/api';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';

type ConnectionLimitKey =
  'max_connec' | 'max_connec_per_torrent' | 'max_uploads' | 'max_uploads_per_torrent';

const CONNECTION_LIMIT_KEYS: ConnectionLimitKey[] = [
  'max_connec',
  'max_connec_per_torrent',
  'max_uploads',
  'max_uploads_per_torrent',
];

/**
 * connection.tsx — qBittorrent-side network settings, live from app/preferences
 * (#233): listen port, connection/upload-slot limits, proxy server, IP
 * filtering. I2P isn't here — it's not exposed by the WebUI API at all (no
 * i2p_* fields exist in app/preferences on either 4.1 or 5.0).
 */
export default function ConnectionSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { showToast } = useToast();

  // Peer connection protocol
  const [listenPort, setListenPort] = useState('');
  const [lastSavedListenPort, setLastSavedListenPort] = useState<number | null>(null);
  const [randomPort, setRandomPort] = useState(false);
  const [upnpEnabled, setUpnpEnabled] = useState(false);

  // Connection limits. -1 is qBittorrent's own sentinel for "unlimited" — there's
  // no separate _enabled flag for these fields, so the switch is derived from
  // whether the stored value is -1, and turning it on collects a value via modal
  // rather than writing a made-up default.
  const [limits, setLimits] = useState<Record<ConnectionLimitKey, number>>({
    max_connec: -1,
    max_connec_per_torrent: -1,
    max_uploads: -1,
    max_uploads_per_torrent: -1,
  });
  const [activeLimitModal, setActiveLimitModal] = useState<ConnectionLimitKey | null>(null);

  // Proxy server
  const [proxyType, setProxyType] = useState(-1);
  const [proxyTypePickerVisible, setProxyTypePickerVisible] = useState(false);
  const [proxyIp, setProxyIp] = useState('');
  const [proxyPort, setProxyPort] = useState('');
  const [proxyAuthEnabled, setProxyAuthEnabled] = useState(false);
  const [proxyUsername, setProxyUsername] = useState('');
  const [proxyPassword, setProxyPassword] = useState('');
  const [proxyPeerConnections, setProxyPeerConnections] = useState(false);
  const [proxyTorrentsOnly, setProxyTorrentsOnly] = useState(false);

  // IP filtering
  const [ipFilterEnabled, setIpFilterEnabled] = useState(false);
  const [ipFilterPath, setIpFilterPath] = useState('');
  const [ipFilterTrackers, setIpFilterTrackers] = useState(false);
  const [bannedIPs, setBannedIPs] = useState('');
  const [bannedIPsModalVisible, setBannedIPsModalVisible] = useState(false);

  const proxyTypeOptions: OptionPickerItem[] = [
    { label: t('screens.settings.proxyDisabled'), value: '-1', icon: 'close-circle-outline' },
    { label: t('screens.settings.proxyHttp'), value: '1', icon: 'globe-outline' },
    { label: t('screens.settings.proxySocks5'), value: '2', icon: 'globe-outline' },
    {
      label: t('screens.settings.proxyHttpAuth'),
      value: '3',
      icon: 'lock-closed-outline',
    },
    {
      label: t('screens.settings.proxySocks5Auth'),
      value: '4',
      icon: 'lock-closed-outline',
    },
    { label: t('screens.settings.proxySocks4'), value: '5', icon: 'globe-outline' },
  ];

  const loadPreferences = async () => {
    try {
      const prefs = (await applicationApi.getPreferences()) as ApplicationPreferences;

      const port = prefs.listen_port;
      setListenPort(port != null ? String(port) : '');
      setLastSavedListenPort(port ?? null);
      setRandomPort(!!prefs.random_port);
      setUpnpEnabled(!!prefs.upnp);

      setLimits({
        max_connec: typeof prefs.max_connec === 'number' ? prefs.max_connec : -1,
        max_connec_per_torrent:
          typeof prefs.max_connec_per_torrent === 'number' ? prefs.max_connec_per_torrent : -1,
        max_uploads: typeof prefs.max_uploads === 'number' ? prefs.max_uploads : -1,
        max_uploads_per_torrent:
          typeof prefs.max_uploads_per_torrent === 'number' ? prefs.max_uploads_per_torrent : -1,
      });

      setProxyType(typeof prefs.proxy_type === 'number' ? prefs.proxy_type : -1);
      setProxyIp(prefs.proxy_ip || '');
      setProxyPort(prefs.proxy_port != null ? String(prefs.proxy_port) : '');
      setProxyAuthEnabled(!!prefs.proxy_auth_enabled);
      setProxyUsername(prefs.proxy_username || '');
      setProxyPassword(prefs.proxy_password || '');
      setProxyPeerConnections(!!prefs.proxy_peer_connections);
      setProxyTorrentsOnly(!!prefs.proxy_torrents_only);

      setIpFilterEnabled(!!prefs.ip_filter_enabled);
      setIpFilterPath(prefs.ip_filter_path || '');
      setIpFilterTrackers(!!prefs.ip_filter_trackers);
      setBannedIPs(prefs.banned_IPs || '');
    } catch {
      // Not connected / failed to load — leave defaults
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPreferences();
    }, []),
  );

  const setPref = async <K extends keyof ApplicationPreferences>(
    key: K,
    value: ApplicationPreferences[K],
    applyLocally: () => void,
    rollback: () => void,
  ) => {
    applyLocally();
    try {
      await applicationApi.setPreferences({ [key]: value });
      showToast(t('toast.serverSettingUpdated'), 'success');
    } catch {
      rollback();
      showToast(t('errors.failedToUpdateServerSetting'), 'error');
    }
  };

  /** Integer field with an onBlur commit, shared by the port/limit rows below. */
  const numericField = (
    value: string,
    setValue: (v: string) => void,
    lastSaved: number | null,
    setLastSaved: (v: number | null) => void,
    key: keyof ApplicationPreferences,
    options?: { min?: number; max?: number; allowNegativeOne?: boolean },
  ) => ({
    value,
    onChangeText: setValue,
    onBlur: () => {
      const num = parseInt(value, 10);
      const min = options?.min ?? 0;
      const max = options?.max ?? Number.MAX_SAFE_INTEGER;
      const validNegativeOne = options?.allowNegativeOne && num === -1;
      if (isNaN(num) || (!validNegativeOne && (num < min || num > max))) {
        setValue(lastSaved != null ? String(lastSaved) : '');
        showToast(t('errors.invalidNumber'), 'error');
        return;
      }
      const prev = lastSaved;
      setPref(
        key,
        num,
        () => setLastSaved(num),
        () => {
          setLastSaved(prev);
          setValue(prev != null ? String(prev) : '');
        },
      );
    },
  });

  const limitLabels: Record<ConnectionLimitKey, string> = {
    max_connec: t('screens.settings.maxConnec'),
    max_connec_per_torrent: t('screens.settings.maxConnecPerTorrent'),
    max_uploads: t('screens.settings.maxUploads'),
    max_uploads_per_torrent: t('screens.settings.maxUploadsPerTorrent'),
  };

  const saveLimit = (key: ConnectionLimitKey, value: number) => {
    const prev = limits[key];
    setPref(
      key,
      value,
      () => setLimits((l) => ({ ...l, [key]: value })),
      () => setLimits((l) => ({ ...l, [key]: prev })),
    );
  };

  const proxyEnabled = proxyType !== -1;

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.surfaceOutline }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerButton}
            activeOpacity={0.7}
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('screens.settings.connectionSettings')}
          </Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Peer Connection Protocol */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.peerConnectionProtocol').toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="shuffle-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t('screens.settings.randomPort')}
                  </Text>
                </View>
                <Switch
                  value={randomPort}
                  onValueChange={(value) => {
                    const prev = randomPort;
                    setPref(
                      'random_port',
                      value,
                      () => setRandomPort(value),
                      () => setRandomPort(prev),
                    );
                  }}
                  trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                  ios_backgroundColor={colors.surfaceOutline}
                />
              </View>
              {!randomPort && (
                <>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                  <View style={styles.fieldRow}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      {t('screens.settings.listeningPort')}
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, { color: colors.text }]}
                      placeholder="6881"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="number-pad"
                      {...numericField(
                        listenPort,
                        setListenPort,
                        lastSavedListenPort,
                        setLastSavedListenPort,
                        'listen_port',
                        { min: 1, max: 65535 },
                      )}
                    />
                  </View>
                </>
              )}
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="swap-horizontal-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t('screens.settings.upnpEnabled')}
                  </Text>
                </View>
                <Switch
                  value={upnpEnabled}
                  onValueChange={(value) => {
                    const prev = upnpEnabled;
                    setPref(
                      'upnp',
                      value,
                      () => setUpnpEnabled(value),
                      () => setUpnpEnabled(prev),
                    );
                  }}
                  trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                  ios_backgroundColor={colors.surfaceOutline}
                />
              </View>
            </View>
          </View>

          {/* Connection Limits */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.connectionLimits').toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              {CONNECTION_LIMIT_KEYS.map((key, index) => {
                const value = limits[key];
                const isLimited = value !== -1;
                return (
                  <View key={key}>
                    {index > 0 && (
                      <View
                        style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                      />
                    )}
                    <View style={styles.settingRow}>
                      <View style={styles.settingLeft}>
                        <Text style={[styles.settingLabel, { color: colors.text }]}>
                          {limitLabels[key]}
                        </Text>
                      </View>
                      <Switch
                        value={isLimited}
                        onValueChange={(enabled) => {
                          if (enabled) {
                            setActiveLimitModal(key);
                          } else {
                            saveLimit(key, -1);
                          }
                        }}
                        trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                        ios_backgroundColor={colors.surfaceOutline}
                      />
                    </View>
                    {isLimited && (
                      <>
                        <View
                          style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                        />
                        <TouchableOpacity
                          style={styles.settingRow}
                          onPress={() => setActiveLimitModal(key)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.settingLeft}>
                            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                              {t('screens.settings.limitValue')}
                            </Text>
                          </View>
                          <View style={styles.pickerButton}>
                            <Text style={[styles.pickerText, { color: colors.text }]}>{value}</Text>
                            <Ionicons name="pencil" size={14} color={colors.textSecondary} />
                          </View>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Proxy Server */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.proxyServer').toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="git-network-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t('screens.settings.proxyType')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setProxyTypePickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerText, { color: colors.text }]}>
                    {proxyTypeOptions.find((opt) => opt.value === String(proxyType))?.label}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {proxyEnabled && (
                <>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                  <View style={styles.fieldRow}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      {t('screens.settings.proxyHost')}
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, { color: colors.text }]}
                      placeholder={t('screens.settings.proxyHostPlaceholder')}
                      placeholderTextColor={colors.textSecondary}
                      value={proxyIp}
                      onChangeText={setProxyIp}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onBlur={() => {
                        const prev = proxyIp;
                        setPref(
                          'proxy_ip',
                          proxyIp,
                          () => {},
                          () => setProxyIp(prev),
                        );
                      }}
                    />
                  </View>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                  <View style={styles.fieldRow}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      {t('screens.settings.proxyPort')}
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, { color: colors.text }]}
                      placeholder="8080"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="number-pad"
                      value={proxyPort}
                      onChangeText={setProxyPort}
                      onBlur={() => {
                        const num = parseInt(proxyPort, 10);
                        if (isNaN(num) || num < 1 || num > 65535) {
                          showToast(t('errors.invalidPort'), 'error');
                          return;
                        }
                        setPref(
                          'proxy_port',
                          num,
                          () => {},
                          () => {},
                        );
                      }}
                    />
                  </View>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Text style={[styles.settingLabel, { color: colors.text }]}>
                        {t('screens.settings.proxyPeerConnections')}
                      </Text>
                    </View>
                    <Switch
                      value={proxyPeerConnections}
                      onValueChange={(value) => {
                        const prev = proxyPeerConnections;
                        setPref(
                          'proxy_peer_connections',
                          value,
                          () => setProxyPeerConnections(value),
                          () => setProxyPeerConnections(prev),
                        );
                      }}
                      trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                      ios_backgroundColor={colors.surfaceOutline}
                    />
                  </View>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Text style={[styles.settingLabel, { color: colors.text }]}>
                        {t('screens.settings.proxyTorrentsOnly')}
                      </Text>
                    </View>
                    <Switch
                      value={proxyTorrentsOnly}
                      onValueChange={(value) => {
                        const prev = proxyTorrentsOnly;
                        setPref(
                          'proxy_torrents_only',
                          value,
                          () => setProxyTorrentsOnly(value),
                          () => setProxyTorrentsOnly(prev),
                        );
                      }}
                      trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                      ios_backgroundColor={colors.surfaceOutline}
                    />
                  </View>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Text style={[styles.settingLabel, { color: colors.text }]}>
                        {t('screens.settings.proxyAuthEnabled')}
                      </Text>
                    </View>
                    <Switch
                      value={proxyAuthEnabled}
                      onValueChange={(value) => {
                        const prev = proxyAuthEnabled;
                        setPref(
                          'proxy_auth_enabled',
                          value,
                          () => setProxyAuthEnabled(value),
                          () => setProxyAuthEnabled(prev),
                        );
                      }}
                      trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                      ios_backgroundColor={colors.surfaceOutline}
                    />
                  </View>
                  {proxyAuthEnabled && (
                    <>
                      <View
                        style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                      />
                      <View style={styles.fieldRow}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          {t('screens.settings.proxyUsername')}
                        </Text>
                        <TextInput
                          style={[styles.fieldInput, { color: colors.text }]}
                          placeholderTextColor={colors.textSecondary}
                          value={proxyUsername}
                          onChangeText={setProxyUsername}
                          autoCapitalize="none"
                          autoCorrect={false}
                          onBlur={() => {
                            const prev = proxyUsername;
                            setPref(
                              'proxy_username',
                              proxyUsername,
                              () => {},
                              () => setProxyUsername(prev),
                            );
                          }}
                        />
                      </View>
                      <View
                        style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                      />
                      <View style={styles.fieldRow}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          {t('screens.settings.proxyPassword')}
                        </Text>
                        <TextInput
                          style={[styles.fieldInput, { color: colors.text }]}
                          placeholderTextColor={colors.textSecondary}
                          value={proxyPassword}
                          onChangeText={setProxyPassword}
                          autoCapitalize="none"
                          autoCorrect={false}
                          secureTextEntry
                          onBlur={() => {
                            const prev = proxyPassword;
                            setPref(
                              'proxy_password',
                              proxyPassword,
                              () => {},
                              () => setProxyPassword(prev),
                            );
                          }}
                        />
                      </View>
                      <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                        {t('screens.settings.proxyPasswordUnencryptedHint')}
                      </Text>
                    </>
                  )}
                </>
              )}
            </View>
          </View>

          {/* IP Filtering */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              {t('screens.settings.ipFiltering').toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="funnel-outline" size={22} color={colors.primary} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t('screens.settings.ipFilterEnabled')}
                  </Text>
                </View>
                <Switch
                  value={ipFilterEnabled}
                  onValueChange={(value) => {
                    const prev = ipFilterEnabled;
                    setPref(
                      'ip_filter_enabled',
                      value,
                      () => setIpFilterEnabled(value),
                      () => setIpFilterEnabled(prev),
                    );
                  }}
                  trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                  ios_backgroundColor={colors.surfaceOutline}
                />
              </View>
              {ipFilterEnabled && (
                <>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                  <View style={styles.fieldRow}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      {t('screens.settings.ipFilterPath')}
                    </Text>
                    <TextInput
                      style={[styles.fieldInput, { color: colors.text }]}
                      placeholder={t('screens.settings.ipFilterPathPlaceholder')}
                      placeholderTextColor={colors.textSecondary}
                      value={ipFilterPath}
                      onChangeText={setIpFilterPath}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onBlur={() => {
                        const prev = ipFilterPath;
                        setPref(
                          'ip_filter_path',
                          ipFilterPath,
                          () => {},
                          () => setIpFilterPath(prev),
                        );
                      }}
                    />
                  </View>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Text style={[styles.settingLabel, { color: colors.text }]}>
                        {t('screens.settings.ipFilterTrackers')}
                      </Text>
                    </View>
                    <Switch
                      value={ipFilterTrackers}
                      onValueChange={(value) => {
                        const prev = ipFilterTrackers;
                        setPref(
                          'ip_filter_trackers',
                          value,
                          () => setIpFilterTrackers(value),
                          () => setIpFilterTrackers(prev),
                        );
                      }}
                      trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                      ios_backgroundColor={colors.surfaceOutline}
                    />
                  </View>
                </>
              )}
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => setBannedIPsModalVisible(true)}
                activeOpacity={0.7}
              >
                <View style={styles.settingLeft}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t('screens.settings.bannedIPs')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      <InputModal
        visible={activeLimitModal !== null}
        title={activeLimitModal ? limitLabels[activeLimitModal] : ''}
        placeholder="200"
        defaultValue={
          activeLimitModal && limits[activeLimitModal] !== -1
            ? String(limits[activeLimitModal])
            : ''
        }
        keyboardType="numeric"
        validate={(value) => {
          const num = parseInt(value, 10);
          if (isNaN(num) || num < 1) return t('errors.invalidNumber');
          return null;
        }}
        onCancel={() => setActiveLimitModal(null)}
        onConfirm={(value) => {
          if (!activeLimitModal) return;
          const num = parseInt(value, 10);
          saveLimit(activeLimitModal, num);
          setActiveLimitModal(null);
        }}
      />

      <OptionPicker
        visible={proxyTypePickerVisible}
        title={t('screens.settings.proxyType')}
        options={proxyTypeOptions}
        selectedValue={String(proxyType)}
        onSelect={(value) => {
          const type = Number(value);
          const prev = proxyType;
          setProxyTypePickerVisible(false);
          setPref(
            'proxy_type',
            type,
            () => setProxyType(type),
            () => setProxyType(prev),
          );
        }}
        onClose={() => setProxyTypePickerVisible(false)}
      />

      <InputModal
        visible={bannedIPsModalVisible}
        title={t('screens.settings.bannedIPs')}
        message={t('screens.settings.bannedIPsHint')}
        defaultValue={bannedIPs}
        multiline
        allowEmpty
        onCancel={() => setBannedIPsModalVisible(false)}
        onConfirm={(value) => {
          const prev = bannedIPs;
          setBannedIPsModalVisible(false);
          setPref(
            'banned_IPs',
            value,
            () => setBannedIPs(value),
            () => setBannedIPs(prev),
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl },
  section: { marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  sectionHeader: { ...typography.label, marginBottom: spacing.sm, marginLeft: spacing.xs },
  card: { borderRadius: borderRadius.medium, overflow: 'hidden', ...shadows.card },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: { fontSize: 16, fontWeight: '500', flexShrink: 1 },
  separator: { height: 1, marginLeft: 50 },
  pickerButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pickerText: { fontSize: 16, fontWeight: '500' },
  fieldRow: { paddingHorizontal: 16, paddingVertical: 8 },
  fieldLabel: { fontSize: 12, marginBottom: 4 },
  fieldInput: { fontSize: 16, paddingVertical: 4 },
  hintText: {
    fontSize: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    marginTop: -4,
  },
});

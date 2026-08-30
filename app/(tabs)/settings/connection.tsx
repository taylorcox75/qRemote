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
import { useServer } from '@/context/ServerContext';
import { useApiFeatures } from '@/context/ApiVersionContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { EmptyState } from '@/components/EmptyState';
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
 * filtering, I2P. Field shapes here are confirmed against qBittorrent's own
 * source (src/webui/api/appcontroller.cpp), not just the wiki — the wiki
 * never documents I2P at all, and documents proxy_type as an integer even
 * though it became a string enum in qBit 4.6 (WebAPI 2.9.0). See
 * ApiFeatures.hasModernProxyFields / supportsI2p in utils/apiVersion.ts.
 */
export default function ConnectionSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { showToast } = useToast();
  const { isConnected } = useServer();
  const { features } = useApiFeatures();

  // Peer connection protocol
  const [listenPort, setListenPort] = useState('');
  const [lastSavedListenPort, setLastSavedListenPort] = useState<number | null>(null);
  const [randomPort, setRandomPort] = useState(false);
  // qBittorrent reports listen_port as 0 while random_port is on, so there's
  // no live value to read back once it's active. Remember the last real port
  // we saw or saved, so turning randomization off has something to restore.
  const [lastRealPort, setLastRealPort] = useState(6881);
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

  // Proxy server. proxyType is kept as the server's own wire-format string —
  // 'None'/'HTTP'/'SOCKS5'/'SOCKS4' on hasModernProxyFields servers, or the
  // legacy '0'..'5' integer-as-string on older ones (Net::ProxyType::None is 0,
  // not -1 — the wiki's -1 is stale 3.x-era documentation) — since the two
  // version tiers don't share a value space (see the proxy_type comment in
  // types/api.ts).
  const [proxyType, setProxyType] = useState('None');
  const [proxyTypePickerVisible, setProxyTypePickerVisible] = useState(false);
  const [proxyIp, setProxyIp] = useState('');
  const [proxyPort, setProxyPort] = useState('');
  const [proxyAuthEnabled, setProxyAuthEnabled] = useState(false);
  const [proxyUsername, setProxyUsername] = useState('');
  const [proxyPassword, setProxyPassword] = useState('');
  const [proxyPeerConnections, setProxyPeerConnections] = useState(false);
  const [proxyHostnameLookup, setProxyHostnameLookup] = useState(false);
  // Modern (hasModernProxyFields) scope toggles — replace legacy proxyTorrentsOnly.
  const [proxyBittorrent, setProxyBittorrent] = useState(false);
  const [proxyRss, setProxyRss] = useState(false);
  const [proxyMisc, setProxyMisc] = useState(false);
  // Legacy-only single toggle.
  const [proxyTorrentsOnly, setProxyTorrentsOnly] = useState(false);

  // IP filtering
  const [ipFilterEnabled, setIpFilterEnabled] = useState(false);
  const [ipFilterPath, setIpFilterPath] = useState('');
  const [ipFilterTrackers, setIpFilterTrackers] = useState(false);
  const [bannedIPs, setBannedIPs] = useState('');
  const [bannedIPsModalVisible, setBannedIPsModalVisible] = useState(false);

  // I2P (supportsI2p only)
  const [i2pEnabled, setI2pEnabled] = useState(false);
  const [i2pAddress, setI2pAddress] = useState('');
  const [i2pPort, setI2pPort] = useState('');
  const [i2pMixedMode, setI2pMixedMode] = useState(false);
  const [i2pInboundQuantity, setI2pInboundQuantity] = useState('');
  const [i2pOutboundQuantity, setI2pOutboundQuantity] = useState('');
  const [i2pInboundLength, setI2pInboundLength] = useState('');
  const [i2pOutboundLength, setI2pOutboundLength] = useState('');

  const proxyTypeOptions: OptionPickerItem[] = features.hasModernProxyFields
    ? [
        { label: t('screens.settings.proxyDisabled'), value: 'None', icon: 'close-circle-outline' },
        { label: t('screens.settings.proxyHttp'), value: 'HTTP', icon: 'globe-outline' },
        { label: t('screens.settings.proxySocks5'), value: 'SOCKS5', icon: 'globe-outline' },
        { label: t('screens.settings.proxySocks4'), value: 'SOCKS4', icon: 'globe-outline' },
      ]
    : [
        { label: t('screens.settings.proxyDisabled'), value: '0', icon: 'close-circle-outline' },
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
      if (port) setLastRealPort(port);
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

      setProxyType(
        prefs.proxy_type != null
          ? String(prefs.proxy_type)
          : features.hasModernProxyFields
            ? 'None'
            : '0',
      );
      setProxyIp(prefs.proxy_ip || '');
      setProxyPort(prefs.proxy_port != null ? String(prefs.proxy_port) : '');
      setProxyAuthEnabled(!!prefs.proxy_auth_enabled);
      setProxyUsername(prefs.proxy_username || '');
      setProxyPassword(prefs.proxy_password || '');
      setProxyPeerConnections(!!prefs.proxy_peer_connections);
      setProxyHostnameLookup(!!prefs.proxy_hostname_lookup);
      setProxyBittorrent(!!prefs.proxy_bittorrent);
      setProxyRss(!!prefs.proxy_rss);
      setProxyMisc(!!prefs.proxy_misc);
      setProxyTorrentsOnly(!!prefs.proxy_torrents_only);

      setIpFilterEnabled(!!prefs.ip_filter_enabled);
      setIpFilterPath(prefs.ip_filter_path || '');
      setIpFilterTrackers(!!prefs.ip_filter_trackers);
      setBannedIPs(prefs.banned_IPs || '');

      if (features.supportsI2p) {
        setI2pEnabled(!!prefs.i2p_enabled);
        setI2pAddress(prefs.i2p_address || '');
        setI2pPort(prefs.i2p_port != null ? String(prefs.i2p_port) : '');
        setI2pMixedMode(!!prefs.i2p_mixed_mode);
        setI2pInboundQuantity(
          prefs.i2p_inbound_quantity != null ? String(prefs.i2p_inbound_quantity) : '',
        );
        setI2pOutboundQuantity(
          prefs.i2p_outbound_quantity != null ? String(prefs.i2p_outbound_quantity) : '',
        );
        setI2pInboundLength(
          prefs.i2p_inbound_length != null ? String(prefs.i2p_inbound_length) : '',
        );
        setI2pOutboundLength(
          prefs.i2p_outbound_length != null ? String(prefs.i2p_outbound_length) : '',
        );
      }
    } catch {
      // Not connected / failed to load — leave defaults
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (isConnected) {
        loadPreferences();
      }
      // loadPreferences isn't memoized — only re-run when isConnected/features change.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected, features]),
  );

  const setPrefs = async (
    patch: Partial<ApplicationPreferences>,
    applyLocally: () => void,
    rollback: () => void,
  ) => {
    applyLocally();
    try {
      await applicationApi.setPreferences(patch);
      showToast(t('toast.serverSettingUpdated'), 'success');
    } catch {
      rollback();
      showToast(t('errors.failedToUpdateServerSetting'), 'error');
    }
  };

  const setPref = <K extends keyof ApplicationPreferences>(
    key: K,
    value: ApplicationPreferences[K],
    applyLocally: () => void,
    rollback: () => void,
  ) => setPrefs({ [key]: value } as Partial<ApplicationPreferences>, applyLocally, rollback);

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
        () => {
          setLastSaved(num);
          if (key === 'listen_port') setLastRealPort(num);
        },
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

  const proxyEnabled = features.hasModernProxyFields ? proxyType !== 'None' : proxyType !== '0';

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

        {!isConnected ? (
          <EmptyState subtitle={t('toast.notConnected')} />
        ) : (
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
                      const prevRandom = randomPort;
                      if (value) {
                        setPref(
                          'random_port',
                          true,
                          () => setRandomPort(true),
                          () => setRandomPort(prevRandom),
                        );
                        return;
                      }
                      // qBittorrent's setPreferences only turns randomization off
                      // when a concrete listen_port arrives in the SAME request
                      // as random_port:false — a bare {random_port:false} matches
                      // neither branch of its handler and silently does nothing.
                      const prevListenPort = listenPort;
                      const restoredPort = lastRealPort;
                      setPrefs(
                        { random_port: false, listen_port: restoredPort },
                        () => {
                          setRandomPort(false);
                          setListenPort(String(restoredPort));
                          setLastSavedListenPort(restoredPort);
                        },
                        () => {
                          setRandomPort(prevRandom);
                          setListenPort(prevListenPort);
                        },
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
                              <Text style={[styles.pickerText, { color: colors.text }]}>
                                {value}
                              </Text>
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

            {/* I2P */}
            {features.supportsI2p && (
              <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                  {t('screens.settings.i2pSection').toUpperCase()}
                </Text>
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Ionicons name="flask-outline" size={22} color={colors.primary} />
                      <Text style={[styles.settingLabel, { color: colors.text }]}>
                        {t('screens.settings.i2pEnabled')}
                      </Text>
                    </View>
                    <Switch
                      value={i2pEnabled}
                      onValueChange={(value) => {
                        const prev = i2pEnabled;
                        setPref(
                          'i2p_enabled',
                          value,
                          () => setI2pEnabled(value),
                          () => setI2pEnabled(prev),
                        );
                      }}
                      trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                      ios_backgroundColor={colors.surfaceOutline}
                    />
                  </View>
                  {i2pEnabled && (
                    <>
                      <View
                        style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                      />
                      <View style={styles.fieldRow}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          {t('screens.settings.i2pAddress')}
                        </Text>
                        <TextInput
                          style={[styles.fieldInput, { color: colors.text }]}
                          placeholder={t('screens.settings.i2pAddressPlaceholder')}
                          placeholderTextColor={colors.textSecondary}
                          value={i2pAddress}
                          onChangeText={setI2pAddress}
                          autoCapitalize="none"
                          autoCorrect={false}
                          onBlur={() => {
                            const prev = i2pAddress;
                            setPref(
                              'i2p_address',
                              i2pAddress,
                              () => {},
                              () => setI2pAddress(prev),
                            );
                          }}
                        />
                      </View>
                      <View
                        style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                      />
                      <View style={styles.fieldRow}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          {t('screens.settings.i2pPort')}
                        </Text>
                        <TextInput
                          style={[styles.fieldInput, { color: colors.text }]}
                          placeholder="7656"
                          placeholderTextColor={colors.textSecondary}
                          keyboardType="number-pad"
                          value={i2pPort}
                          onChangeText={setI2pPort}
                          onBlur={() => {
                            const num = parseInt(i2pPort, 10);
                            if (isNaN(num) || num < 1 || num > 65535) {
                              showToast(t('errors.invalidPort'), 'error');
                              return;
                            }
                            setPref(
                              'i2p_port',
                              num,
                              () => {},
                              () => {},
                            );
                          }}
                        />
                      </View>
                      <View
                        style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                      />
                      <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                          <Text style={[styles.settingLabel, { color: colors.text }]}>
                            {t('screens.settings.i2pMixedMode')}
                          </Text>
                        </View>
                        <Switch
                          value={i2pMixedMode}
                          onValueChange={(value) => {
                            const prev = i2pMixedMode;
                            setPref(
                              'i2p_mixed_mode',
                              value,
                              () => setI2pMixedMode(value),
                              () => setI2pMixedMode(prev),
                            );
                          }}
                          trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                          ios_backgroundColor={colors.surfaceOutline}
                        />
                      </View>
                      {(
                        [
                          [
                            'i2pInboundQuantity',
                            i2pInboundQuantity,
                            setI2pInboundQuantity,
                            'i2p_inbound_quantity',
                          ],
                          [
                            'i2pOutboundQuantity',
                            i2pOutboundQuantity,
                            setI2pOutboundQuantity,
                            'i2p_outbound_quantity',
                          ],
                          [
                            'i2pInboundLength',
                            i2pInboundLength,
                            setI2pInboundLength,
                            'i2p_inbound_length',
                          ],
                          [
                            'i2pOutboundLength',
                            i2pOutboundLength,
                            setI2pOutboundLength,
                            'i2p_outbound_length',
                          ],
                        ] as const
                      ).map(([labelKey, value, setValue, prefKey]) => (
                        <View key={prefKey}>
                          <View
                            style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                          />
                          <View style={styles.fieldRow}>
                            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                              {t(`screens.settings.${labelKey}`)}
                            </Text>
                            <TextInput
                              style={[styles.fieldInput, { color: colors.text }]}
                              placeholder="3"
                              placeholderTextColor={colors.textSecondary}
                              keyboardType="number-pad"
                              value={value}
                              onChangeText={setValue}
                              onBlur={() => {
                                const num = parseInt(value, 10);
                                if (isNaN(num) || num < 1) {
                                  showToast(t('errors.invalidNumber'), 'error');
                                  return;
                                }
                                setPref(
                                  prefKey,
                                  num,
                                  () => {},
                                  () => {},
                                );
                              }}
                            />
                          </View>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              </View>
            )}

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
                      {proxyTypeOptions.find((opt) => opt.value === proxyType)?.label}
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
                    {features.hasModernProxyFields && (
                      <>
                        <View
                          style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                        />
                        <View style={styles.settingRow}>
                          <View style={styles.settingLeft}>
                            <Text style={[styles.settingLabel, { color: colors.text }]}>
                              {t('screens.settings.proxyHostnameLookup')}
                            </Text>
                          </View>
                          <Switch
                            value={proxyHostnameLookup}
                            onValueChange={(value) => {
                              const prev = proxyHostnameLookup;
                              setPref(
                                'proxy_hostname_lookup',
                                value,
                                () => setProxyHostnameLookup(value),
                                () => setProxyHostnameLookup(prev),
                              );
                            }}
                            trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                            ios_backgroundColor={colors.surfaceOutline}
                          />
                        </View>
                      </>
                    )}
                    {features.hasModernProxyFields ? (
                      <>
                        <View
                          style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                        />
                        <View style={styles.settingRow}>
                          <View style={styles.settingLeft}>
                            <Text style={[styles.settingLabel, { color: colors.text }]}>
                              {t('screens.settings.proxyBittorrent')}
                            </Text>
                          </View>
                          <Switch
                            value={proxyBittorrent}
                            onValueChange={(value) => {
                              const prev = proxyBittorrent;
                              setPref(
                                'proxy_bittorrent',
                                value,
                                () => setProxyBittorrent(value),
                                () => setProxyBittorrent(prev),
                              );
                            }}
                            trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                            ios_backgroundColor={colors.surfaceOutline}
                          />
                        </View>
                        <View
                          style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                        />
                        <View style={styles.settingRow}>
                          <View style={styles.settingLeft}>
                            <Text style={[styles.settingLabel, { color: colors.text }]}>
                              {t('screens.settings.proxyRss')}
                            </Text>
                          </View>
                          <Switch
                            value={proxyRss}
                            onValueChange={(value) => {
                              const prev = proxyRss;
                              setPref(
                                'proxy_rss',
                                value,
                                () => setProxyRss(value),
                                () => setProxyRss(prev),
                              );
                            }}
                            trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                            ios_backgroundColor={colors.surfaceOutline}
                          />
                        </View>
                        <View
                          style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                        />
                        <View style={styles.settingRow}>
                          <View style={styles.settingLeft}>
                            <Text style={[styles.settingLabel, { color: colors.text }]}>
                              {t('screens.settings.proxyMisc')}
                            </Text>
                          </View>
                          <Switch
                            value={proxyMisc}
                            onValueChange={(value) => {
                              const prev = proxyMisc;
                              setPref(
                                'proxy_misc',
                                value,
                                () => setProxyMisc(value),
                                () => setProxyMisc(prev),
                              );
                            }}
                            trackColor={{ false: colors.surfaceOutline, true: colors.success }}
                            ios_backgroundColor={colors.surfaceOutline}
                          />
                        </View>
                      </>
                    ) : (
                      <>
                        <View
                          style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                        />
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
                      </>
                    )}
                    {features.hasModernProxyFields && (
                      <>
                        <View
                          style={[styles.separator, { backgroundColor: colors.surfaceOutline }]}
                        />
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
                      </>
                    )}
                    {(features.hasModernProxyFields
                      ? proxyAuthEnabled
                      : proxyType === '3' || proxyType === '4') && (
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
        )}
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
        selectedValue={proxyType}
        onSelect={(value) => {
          // Wire format matches the picker's own option values: the real string
          // enum on hasModernProxyFields servers, the legacy integer otherwise.
          const wireValue: string | number = features.hasModernProxyFields ? value : Number(value);
          const prev = proxyType;
          setProxyTypePickerVisible(false);
          setPref(
            'proxy_type',
            wireValue,
            () => setProxyType(value),
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

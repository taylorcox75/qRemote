import '@/i18n';
import * as ExpoLinking from 'expo-linking';
import { ErrorBoundaryProps, Stack, useRootNavigationState, useRouter } from 'expo-router';
import {
  Dimensions,
  InteractionManager,
  Linking,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useRef } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/services/query-client';
import { ServerProvider } from '@/context/ServerContext';
import { ApiVersionProvider } from '@/context/ApiVersionContext';
import { TorrentProvider } from '@/context/TorrentContext';
import { TransferProvider } from '@/context/TransferContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { ToastProvider, useToast } from '@/context/ToastContext';
import { logStorage } from '@/services/log-storage';
import { storageService } from '@/services/storage';
import { apiClient } from '@/services/api/client';
import { setHapticsEnabled } from '@/utils/haptics';
import {
  setDebugMode as setConnectivityDebugMode,
  clogInfo,
  clogWarn,
} from '@/services/connectivity-log';
import { extractMagnetLink } from '@/utils/magnet';
import { extractTorrentFile, IncomingTorrentFile } from '@/utils/torrent-file';
import { persistIncomingTorrentFile } from '@/services/incoming-file';

const { width } = Dimensions.get('window');

// Keep (tabs) as the stack anchor so pushing server/add routes (and
// deep-linking to them) never wipes the tab navigator out of history —
// without this, dismissing a modal or going back can leave the user on a
// full-screen route with no bottom tab bar. Settings and torrent detail
// live under (tabs) so the tab bar stays visible there.
export const unstable_settings = {
  initialRouteName: '(tabs)',
  anchor: '(tabs)',
};

/**
 * Expo Router renders this in place of the route tree when a render throws.
 * Without it an uncaught error leaves a blank screen with no way out but a
 * force-quit.
 *
 * This is the one component in the app that does NOT use `useTheme()`
 * (AGENTS.md rule 1). It is mounted above ThemeProvider, so if the theme is
 * what failed, calling useTheme() here would throw again and leave no boundary
 * at all. It follows the system colour scheme instead. Strings use
 * `defaultValue` for the same reason — i18n may be the thing that broke.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const bg = isDark ? '#000000' : '#FFFFFF';
  const fg = isDark ? '#FFFFFF' : '#000000';
  const muted = isDark ? '#9E9E9E' : '#6B6B6B';

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Text
        style={{
          fontSize: 20,
          fontWeight: '600',
          color: fg,
          textAlign: 'center',
          marginBottom: 12,
        }}
      >
        {t('errors.crashTitle', { defaultValue: 'Something went wrong' })}
      </Text>
      <Text style={{ fontSize: 15, color: muted, textAlign: 'center', marginBottom: 20 }}>
        {t('errors.crashMessage', {
          defaultValue: 'qRemote ran into an unexpected error. Your servers and settings are safe.',
        })}
      </Text>
      {!!error?.message && (
        <Text
          selectable
          style={{ fontSize: 12, color: muted, textAlign: 'center', marginBottom: 28 }}
        >
          {error.message}
        </Text>
      )}
      <TouchableOpacity
        onPress={retry}
        accessibilityRole="button"
        style={{
          backgroundColor: '#0A84FF',
          paddingVertical: 12,
          paddingHorizontal: 28,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
          {t('common.retry', { defaultValue: 'Try Again' })}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function StackNavigator() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const lastHandledMagnetRef = useRef<{ value: string; at: number } | null>(null);
  const lastHandledTorrentFileRef = useRef<{ value: string; at: number } | null>(null);
  const pendingDeepLinkRef = useRef<
    { type: 'magnet'; value: string } | { type: 'torrentFile'; value: IncomingTorrentFile } | null
  >(null);
  const initialUrlCheckedRef = useRef(false);
  // Mirror nav-readiness into a ref so the async getInitialURL callback (which
  // closes over the mount-time effect scope) sees the current value instead of
  // a stale `undefined` — otherwise a cold-launch magnet/.torrent open is
  // silently queued and never dispatched.
  const rootNavReadyRef = useRef(false);
  useEffect(() => {
    rootNavReadyRef.current = !!rootNavigationState?.key;
  }, [rootNavigationState?.key]);

  useEffect(() => {
    const navigateToMagnet = (magnetLink: string) => {
      InteractionManager.runAfterInteractions(() => {
        router.replace({
          pathname: '/',
          params: { magnet: magnetLink },
        });
      });
    };

    const navigateToTorrentFile = (torrentFile: IncomingTorrentFile) => {
      InteractionManager.runAfterInteractions(() => {
        router.replace({
          pathname: '/',
          params: { torrentFileUri: torrentFile.uri, torrentFileName: torrentFile.name },
        });
      });
    };

    const dispatchDeepLink = async (
      incomingUrl?: string | null,
      opts: { silentFailure?: boolean } = {},
    ): Promise<boolean> => {
      const magnetLink = extractMagnetLink(incomingUrl);
      if (magnetLink) {
        const now = Date.now();
        if (
          lastHandledMagnetRef.current &&
          lastHandledMagnetRef.current.value === magnetLink &&
          now - lastHandledMagnetRef.current.at < 1500
        ) {
          return true;
        }
        lastHandledMagnetRef.current = { value: magnetLink, at: now };

        if (!rootNavReadyRef.current) {
          pendingDeepLinkRef.current = { type: 'magnet', value: magnetLink };
          return true;
        }
        navigateToMagnet(magnetLink);
        return true;
      }

      const rawTorrentFile = extractTorrentFile(incomingUrl);
      if (!rawTorrentFile) return false;

      const now = Date.now();
      if (
        lastHandledTorrentFileRef.current &&
        lastHandledTorrentFileRef.current.value === rawTorrentFile.uri &&
        now - lastHandledTorrentFileRef.current.at < 1500
      ) {
        return true;
      }
      lastHandledTorrentFileRef.current = { value: rawTorrentFile.uri, at: now };

      // Copy into app-owned cache immediately, before waiting on navigation
      // readiness — see persistIncomingTorrentFile for why the source URI
      // can't be trusted to survive that wait.
      // Logged so a failing "Open In" can be diagnosed from the Logs tab
      // instead of guessing: if the URI is already under the app's own
      // cache/incoming-torrents/ the native copy ran, and anything else means
      // JS got the raw security-scoped URL straight from iOS.
      clogInfo('LINK', `Incoming .torrent URI: ${rawTorrentFile.uri}`);

      const torrentFile = await persistIncomingTorrentFile(rawTorrentFile);
      if (!torrentFile) {
        clogWarn('LINK', `Could not read incoming .torrent: ${rawTorrentFile.uri}`);
        if (!opts.silentFailure) {
          showToast(t('errors.couldNotReadTorrentFile'), 'error');
        }
        return false;
      }

      if (!rootNavReadyRef.current) {
        pendingDeepLinkRef.current = { type: 'torrentFile', value: torrentFile };
        return true;
      }
      navigateToTorrentFile(torrentFile);
      return true;
    };

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void dispatchDeepLink(url);
    });

    if (!initialUrlCheckedRef.current) {
      initialUrlCheckedRef.current = true;

      // Two independent sources for the cold-launch URL, because neither is
      // reliable alone on iOS here:
      //  - expo-linking's getLinkingURL() reads a native registry populated
      //    by the "open url" AppDelegate callback, which can still carry the
      //    original security-scoped file:// URI whose access has already
      //    lapsed by the time JS reads it.
      //  - RN core's Linking.getInitialURL() reads bridge.launchOptions,
      //    which our withNativeTorrentFileCopy patch rewrites to an
      //    app-owned copy of an incoming .torrent — but the New Architecture
      //    may not populate it at all.
      // Try the RN source first and only fall back to expo-linking's URL —
      // silently — when the two disagree, so a stale/expired scoped URI from
      // one source doesn't flash a failure toast right before the other
      // source's valid copy succeeds (#175). Do NOT reduce this to one
      // source without testing a real cold launch — cold-launch "Open In"
      // has regressed repeatedly on exactly this code path.
      void (async () => {
        const [expoUrl, rnUrl] = await Promise.all([
          Promise.resolve(ExpoLinking.getLinkingURL()),
          Linking.getInitialURL().catch(() => null),
        ]);
        clogInfo('LINK', `Cold-launch expo-linking URL: ${expoUrl ?? '(none)'}`);
        clogInfo('LINK', `Cold-launch RN URL: ${rnUrl ?? '(none)'}`);

        const hasDistinctFallback = !!expoUrl && expoUrl !== rnUrl;
        const handled = rnUrl
          ? await dispatchDeepLink(rnUrl, { silentFailure: hasDistinctFallback })
          : false;
        if (!handled && hasDistinctFallback) {
          await dispatchDeepLink(expoUrl);
        }
      })();
    }

    if (pendingDeepLinkRef.current) {
      const pending = pendingDeepLinkRef.current;
      pendingDeepLinkRef.current = null;
      if (pending.type === 'magnet') {
        navigateToMagnet(pending.value);
      } else {
        navigateToTorrentFile(pending.value);
      }
    }

    return () => {
      subscription.remove();
    };
    // showToast/t are only used for one edge-case error deep inside this
    // handler — including them would tear down and re-register the Linking
    // subscription whenever either identity changes, unrelated to the deep
    // link state this effect actually cares about.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootNavigationState?.key, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          gestureResponseDistance: {
            start: width / 2,
          },
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="server/add"
          options={{
            presentation: 'modal',
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="server/[id]"
          options={{
            presentation: 'modal',
            gestureEnabled: true,
          }}
        />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    logStorage.autoDeleteIfNeeded();

    // Apply persisted preferences to global modules at cold start so they
    // take effect immediately — before the user ever visits Settings.
    storageService
      .getPreferences()
      .then((prefs) => {
        setHapticsEnabled(prefs.hapticFeedback !== false);
        setConnectivityDebugMode(prefs.debugMode === true);
        apiClient.updateSettings({
          connectionTimeout: Number(prefs.connectionTimeout) || 10000,
          retryAttempts: Number(prefs.retryAttempts) || 3,
        });
      })
      .catch(() => {
        // Defaults already applied in each module — safe to ignore
      });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <ServerProvider>
                <ApiVersionProvider>
                  <TorrentProvider>
                    <TransferProvider>
                      <StackNavigator />
                    </TransferProvider>
                  </TorrentProvider>
                </ApiVersionProvider>
              </ServerProvider>
            </ToastProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

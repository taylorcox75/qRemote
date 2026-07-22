import '@/i18n';
import { Stack, useRootNavigationState, useRouter } from 'expo-router';
import { Dimensions, InteractionManager, Linking, View } from 'react-native';
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
import { ToastProvider } from '@/context/ToastContext';
import { logStorage } from '@/services/log-storage';
import { storageService } from '@/services/storage';
import { apiClient } from '@/services/api/client';
import { setHapticsEnabled } from '@/utils/haptics';
import { setDebugMode as setConnectivityDebugMode } from '@/services/connectivity-log';
import { extractMagnetLink } from '@/utils/magnet';
import { extractTorrentFile, IncomingTorrentFile } from '@/utils/torrent-file';
import { persistIncomingTorrentFile } from '@/services/incoming-file';

const { width } = Dimensions.get('window');

function StackNavigator() {
  const { colors } = useTheme();
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
  rootNavReadyRef.current = !!rootNavigationState?.key;

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

    const dispatchDeepLink = async (incomingUrl?: string | null) => {
      const magnetLink = extractMagnetLink(incomingUrl);
      if (magnetLink) {
        const now = Date.now();
        if (
          lastHandledMagnetRef.current &&
          lastHandledMagnetRef.current.value === magnetLink &&
          now - lastHandledMagnetRef.current.at < 1500
        ) {
          return;
        }
        lastHandledMagnetRef.current = { value: magnetLink, at: now };

        if (!rootNavReadyRef.current) {
          pendingDeepLinkRef.current = { type: 'magnet', value: magnetLink };
          return;
        }
        navigateToMagnet(magnetLink);
        return;
      }

      const rawTorrentFile = extractTorrentFile(incomingUrl);
      if (!rawTorrentFile) return;

      const now = Date.now();
      if (
        lastHandledTorrentFileRef.current &&
        lastHandledTorrentFileRef.current.value === rawTorrentFile.uri &&
        now - lastHandledTorrentFileRef.current.at < 1500
      ) {
        return;
      }
      lastHandledTorrentFileRef.current = { value: rawTorrentFile.uri, at: now };

      // Copy into app-owned cache immediately, before waiting on navigation
      // readiness — see persistIncomingTorrentFile for why the source URI
      // can't be trusted to survive that wait.
      const torrentFile = await persistIncomingTorrentFile(rawTorrentFile);

      if (!rootNavReadyRef.current) {
        pendingDeepLinkRef.current = { type: 'torrentFile', value: torrentFile };
        return;
      }
      navigateToTorrentFile(torrentFile);
    };

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void dispatchDeepLink(url);
    });

    if (!initialUrlCheckedRef.current) {
      initialUrlCheckedRef.current = true;
      Linking.getInitialURL()
        .then((url) => dispatchDeepLink(url))
        .catch(() => {
          // No initial URL — safe to ignore.
        });
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
    storageService.getPreferences().then((prefs) => {
      setHapticsEnabled(prefs.hapticFeedback !== false);
      setConnectivityDebugMode(prefs.debugMode === true);
      apiClient.updateSettings({
        connectionTimeout: Number(prefs.connectionTimeout) || 10000,
        retryAttempts: Number(prefs.retryAttempts) || 3,
      });
    }).catch(() => {
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

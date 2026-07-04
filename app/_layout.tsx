import '@/i18n';
import { Stack, useRouter } from 'expo-router';
import { Dimensions, Linking, View } from 'react-native';
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
import { extractTorrentFile } from '@/utils/torrent-file';

const { width } = Dimensions.get('window');

function StackNavigator() {
  const { colors } = useTheme();
  const router = useRouter();
  const lastHandledMagnetRef = useRef<{ value: string; at: number } | null>(null);
  const lastHandledTorrentFileRef = useRef<{ value: string; at: number } | null>(null);

  useEffect(() => {
    const handleIncomingUrl = (incomingUrl?: string | null) => {
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

        router.push({
          pathname: '/',
          params: { magnet: magnetLink },
        });
        return;
      }

      const torrentFile = extractTorrentFile(incomingUrl);
      if (!torrentFile) return;

      const now = Date.now();
      if (
        lastHandledTorrentFileRef.current &&
        lastHandledTorrentFileRef.current.value === torrentFile.uri &&
        now - lastHandledTorrentFileRef.current.at < 1500
      ) {
        return;
      }
      lastHandledTorrentFileRef.current = { value: torrentFile.uri, at: now };

      router.push({
        pathname: '/',
        params: { torrentFileUri: torrentFile.uri, torrentFileName: torrentFile.name },
      });
    };

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingUrl(url);
    });

    Linking.getInitialURL()
      .then((url) => {
        handleIncomingUrl(url);
      })
      .catch(() => {
        // No initial URL — safe to ignore.
      });

    return () => {
      subscription.remove();
    };
  }, [router]);

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

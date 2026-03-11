import '../i18n';
import { Stack, useRouter } from 'expo-router';
import { Dimensions, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { ApiVersionProvider } from '../context/ApiVersionContext';
import { ServerProvider } from '../context/ServerContext';
import { TorrentProvider } from '../context/TorrentContext';
import { TransferProvider } from '../context/TransferContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { ToastProvider } from '../context/ToastContext';
import { logStorage } from '../services/log-storage';
import { storageService } from '../services/storage';
import { ServerManager } from '../services/server-manager';
import { apiClient } from '../services/api/client';
import { setHapticsEnabled } from '../utils/haptics';
import { setDebugMode as setConnectivityDebugMode } from '../services/connectivity-log';

const { width } = Dimensions.get('window');

function StackNavigator() {
  const { colors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    const checkOnboarding = async () => {
      const prefs = await storageService.getPreferences();
      if (prefs.hasCompletedOnboarding) return;

      // Existing users who already have servers configured are graduated past
      // onboarding automatically — only truly new users see the flow.
      const existingServers = await ServerManager.getServers();
      if (existingServers.length > 0) {
        await storageService.savePreferences({ ...prefs, hasCompletedOnboarding: true });
        return;
      }

      router.replace('/onboarding');
    };
    checkOnboarding();
  }, []);
  
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
            backgroundColor: 'colors.r',
          },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
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
        apiTimeout: Number(prefs.apiTimeout) || 30000,
        retryAttempts: Number(prefs.retryAttempts) || 3,
      });
    }).catch(() => {
      // Defaults already applied in each module — safe to ignore
    });
  }, []);

  return (
    <SafeAreaProvider>
      <ApiVersionProvider>
        <ThemeProvider>
          <ToastProvider>
            <ServerProvider>
              <TorrentProvider>
                <TransferProvider>
                  <StackNavigator />
                </TransferProvider>
              </TorrentProvider>
            </ServerProvider>
          </ToastProvider>
        </ThemeProvider>
      </ApiVersionProvider>
    </SafeAreaProvider>
  );
}


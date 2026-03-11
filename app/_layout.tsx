import '../i18n';
import { Stack, useRouter } from 'expo-router';
import { Dimensions, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { ServerProvider } from '../context/ServerContext';
import { TorrentProvider } from '../context/TorrentContext';
import { TransferProvider } from '../context/TransferContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { ToastProvider } from '../context/ToastContext';
import { logStorage } from '../services/log-storage';
import { storageService } from '../services/storage';
import { ServerManager } from '../services/server-manager';

const { width } = Dimensions.get('window');

function StackNavigator() {
  const { colors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const prefs = await storageService.getPreferences();

        // Already completed — nothing to do.
        if (prefs.hasCompletedOnboarding) return;

        // Existing install: any saved server means the user has already set up
        // the app in a previous version. Graduate them past onboarding silently
        // so they are never interrupted by an unexpected redirect.
        const existingServers = await ServerManager.getServers();
        if (existingServers.length > 0) {
          await storageService.savePreferences({ ...prefs, hasCompletedOnboarding: true });
          return;
        }

        // Genuinely first launch — show onboarding.
        router.replace('/onboarding');
      } catch {
        // Storage failure: let the user reach the main screen normally.
      }
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
  // Auto-delete logs on app launch
  useEffect(() => {
    logStorage.autoDeleteIfNeeded();
  }, []);

  return (
    <SafeAreaProvider>
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
    </SafeAreaProvider>
  );
}


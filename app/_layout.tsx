import { Stack } from 'expo-router';
import { Dimensions, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { ServerProvider } from '../context/ServerContext';
import { TorrentProvider } from '../context/TorrentContext';
import { TransferProvider } from '../context/TransferContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { ToastProvider } from '../context/ToastContext';
import { logStorage } from '../services/log-storage';

const { width } = Dimensions.get('window');

function StackNavigator() {
  const { colors } = useTheme();
  
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


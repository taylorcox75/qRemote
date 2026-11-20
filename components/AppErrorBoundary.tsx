import { useEffect } from 'react';
import { ScrollView, Text, TouchableOpacity, useColorScheme } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { clogError } from '@/services/connectivity-log';

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
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  // Leave a trail in Settings → Advanced → View Connectivity Logs: the screen
  // itself only shows the message, never the component that threw.
  useEffect(() => {
    try {
      if (error) clogError('CRASH', `${error.message}\n${error.stack ?? ''}`.slice(0, 2000));
    } catch {
      // The fallback screen must never throw itself.
    }
  }, [error]);
  const isDark = useColorScheme() === 'dark';
  const bg = isDark ? '#000000' : '#FFFFFF';
  const fg = isDark ? '#FFFFFF' : '#000000';
  const muted = isDark ? '#9E9E9E' : '#6B6B6B';

  return (
    // Scrolls so a long error message can be read in full instead of running
    // off-screen (#293).
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{
        flexGrow: 1,
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
    </ScrollView>
  );
}

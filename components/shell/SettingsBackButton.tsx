/**
 * SettingsBackButton.tsx - iPhone-only back control for settings sub-screens.
 * On regular/mac the settings source list is the navigation, so this renders
 * an empty spacer to keep the header title centered.
 */
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useShell } from '@/context/ShellContext';

export function SettingsBackButton() {
  const { idiom } = useShell();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();

  if (idiom !== 'compact') {
    return <View style={styles.slot} />;
  }

  return (
    <TouchableOpacity
      onPress={() => router.back()}
      style={styles.slot}
      activeOpacity={0.7}
      accessibilityLabel={t('common.back')}
    >
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { FocusAwareStatusBar } from '../../components/FocusAwareStatusBar';
import { ColorPicker } from '../../components/ColorPicker';
import { colorThemeManager, ColorTheme } from '../../services/color-theme-manager';
import { useToast } from '../../context/ToastContext';
import { spacing, borderRadius } from '../../constants/spacing';
import { shadows } from '../../constants/shadows';
import { typography } from '../../constants/typography';

interface ColorSettingRowProps {
  label: string;
  color: string;
  onPress: () => void;
  colors: any;
}

function ColorSettingRow({ label, color, onPress, colors }: ColorSettingRowProps) {
  return (
    <TouchableOpacity
      style={styles.colorRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.colorLabel, { color: colors.text }]}>{label}</Text>
      <View style={[styles.colorPreview, { backgroundColor: color, borderColor: colors.surfaceOutline }]} />
    </TouchableOpacity>
  );
}

export default function ThemeSettingsScreen() {
  const router = useRouter();
  const { isDark, toggleTheme, colors, reloadCustomColors } = useTheme();
  const { showToast } = useToast();
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [colorPickerKey, setColorPickerKey] = useState<keyof ColorTheme | null>(null);

  useEffect(() => {
    reloadCustomColors();
  }, []);

  const handleColorSelect = (key: keyof ColorTheme) => {
    setColorPickerKey(key);
    setColorPickerVisible(true);
  };

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.surfaceOutline }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Theme & Colors</Text>
          <View style={styles.headerButton} />
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Theme Toggle */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>APPEARANCE</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="moon-outline" size={22} color={colors.primary} />
                <View style={styles.settingText}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Dark Mode</Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    Switch between light and dark theme
                  </Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.surfaceOutline, true: colors.primary }}
                ios_backgroundColor={colors.surfaceOutline}
              />
            </View>
          </View>
        </View>

        {/* Advanced Color Customization */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>ADVANCED COLORS</Text>
            <TouchableOpacity
              onPress={async () => {
                try {
                  await colorThemeManager.resetCustomColors(isDark);
                  await reloadCustomColors();
                  showToast('Colors reset to defaults', 'success');
                } catch (error) {
                  showToast('Failed to reset colors', 'error');
                }
              }}
            >
              <Ionicons name="refresh" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <ColorSettingRow
              label="Primary"
              color={colors.primary}
              onPress={() => handleColorSelect('primary')}
              colors={colors}
            />
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <ColorSettingRow
              label="Error"
              color={colors.error}
              onPress={() => handleColorSelect('error')}
              colors={colors}
            />
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <ColorSettingRow
              label="Success"
              color={colors.success}
              onPress={() => handleColorSelect('success')}
              colors={colors}
            />
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <ColorSettingRow
              label="Warning"
              color={colors.warning}
              onPress={() => handleColorSelect('warning')}
              colors={colors}
            />
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <ColorSettingRow
              label="Background"
              color={colors.background}
              onPress={() => handleColorSelect('background')}
              colors={colors}
            />
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <ColorSettingRow
              label="Surface"
              color={colors.surface}
              onPress={() => handleColorSelect('surface')}
              colors={colors}
            />
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <ColorSettingRow
              label="Surface Outline"
              color={colors.surfaceOutline}
              onPress={() => handleColorSelect('surfaceOutline')}
              colors={colors}
            />
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <ColorSettingRow
              label="Text"
              color={colors.text}
              onPress={() => handleColorSelect('text')}
              colors={colors}
            />
            <View style={[styles.separator, { backgroundColor: colors.background }]} />
            <ColorSettingRow
              label="Text Secondary"
              color={colors.textSecondary}
              onPress={() => handleColorSelect('textSecondary')}
              colors={colors}
            />
          </View>
        </View>

        <ColorPicker
          visible={colorPickerVisible}
          currentColor={colorPickerKey ? colors[colorPickerKey] : '#000000'}
          onColorChange={async (newColor) => {
            try {
              const custom = await colorThemeManager.getCustomColors(isDark);
              const updatedCustom: ColorTheme = {
                ...(custom || {}),
                [colorPickerKey!]: newColor,
              };
              await colorThemeManager.saveCustomColors(isDark, updatedCustom);
              await reloadCustomColors();
              showToast(`${colorPickerKey} color updated`, 'success');
            } catch (error) {
              showToast('Failed to save color', 'error');
            }
          }}
          onClose={() => setColorPickerVisible(false)}
        />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.headlineSmall,
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  section: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    marginHorizontal: spacing.md,
    letterSpacing: 0.5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    marginHorizontal: spacing.md,
  },
  card: {
    borderRadius: borderRadius.medium,
    marginHorizontal: spacing.md,
    ...shadows.card,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
    gap: spacing.sm,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    ...typography.bodyMedium,
    fontSize: 16,
    fontWeight: '500',
  },
  settingDescription: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 2,
  },
  separator: {
    height: 1,
    marginHorizontal: spacing.md,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  colorLabel: {
    ...typography.bodyMedium,
    fontSize: 16,
  },
  colorPreview: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.small,
    borderWidth: 2,
  },
});


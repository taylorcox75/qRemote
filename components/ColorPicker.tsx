import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing, borderRadius } from '../constants/spacing';
import { shadows } from '../constants/shadows';
import { typography } from '../constants/typography';
import { colorThemeManager } from '../services/color-theme-manager';

interface ColorPickerProps {
  visible: boolean;
  currentColor: string;
  onColorChange: (color: string) => void;
  onClose: () => void;
}

const PRESET_COLORS = [
  // Primary colors
  '#007AFF', // Blue
  '#5856D6', // Purple
  '#FF2D55', // Pink
  '#FF3B30', // Red
  '#FF9500', // Orange
  '#FFCC00', // Yellow
  '#34C759', // Green
  '#5AC8FA', // Light Blue
  '#AF52DE', // Light Purple
  '#FF6B00', // Deep Orange
  
  // Darker variants
  '#003366', // Dark Blue
  '#4A148C', // Dark Purple
  '#B71C1C', // Dark Red
  '#E65100', // Dark Orange
  '#33691E', // Dark Green
  '#01579B', // Dark Light Blue
  
  // Lighter variants
  '#81C784', // Light Green
  '#64B5F6', // Light Blue
  '#BA68C8', // Light Purple
  '#FFB74D', // Light Orange
  '#90CAF9', // Very Light Blue
  
  // Grays
  '#212121', // Dark Gray
  '#424242', // Medium Gray
  '#757575', // Light Gray
  '#BDBDBD', // Very Light Gray
];

export function ColorPicker({ visible, currentColor, onColorChange, onClose }: ColorPickerProps) {
  const { colors, isDark } = useTheme();
  const [hexInput, setHexInput] = useState(colorThemeManager.rgbaToHex(currentColor));
  const [inputError, setInputError] = useState(false);

  const handlePresetSelect = (color: string) => {
    // Add opacity if original had it (extract alpha from current color)
    const alphaMatch = currentColor.match(/[\d.]+\)$/);
    if (alphaMatch) {
      const alpha = parseFloat(alphaMatch[0].replace(')', ''));
      const rgba = colorThemeManager.hexToRgba(color, alpha);
      onColorChange(rgba);
    } else {
      onColorChange(color);
    }
    setHexInput(color);
  };

  const handleHexInput = (text: string) => {
    setHexInput(text);
    setInputError(false);
    
    // Validate hex color
    const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (hexPattern.test(text)) {
      const alphaMatch = currentColor.match(/[\d.]+\)$/);
      if (alphaMatch) {
        const alpha = parseFloat(alphaMatch[0].replace(')', ''));
        const rgba = colorThemeManager.hexToRgba(text, alpha);
        onColorChange(rgba);
      } else {
        onColorChange(text);
      }
    } else if (text.length === 7) {
      setInputError(true);
    }
  };

  const handleClose = () => {
    setInputError(false);
    setHexInput(colorThemeManager.rgbaToHex(currentColor));
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.surface, opacity: 1 }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Pick a Color</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Current color preview */}
          <View style={styles.previewContainer}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Current Color</Text>
            <View style={styles.colorPreview}>
              <View
                style={[
                  styles.colorSwatch,
                  { backgroundColor: currentColor },
                  { borderColor: colors.surfaceOutline },
                ]}
              />
              <Text style={[styles.colorText, { color: colors.text }]} numberOfLines={1}>
                {currentColor}
              </Text>
            </View>
          </View>

          {/* Hex input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Hex Color</Text>
            <View style={styles.hexInputRow}>
              <TextInput
                style={[
                  styles.hexInput,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: inputError ? colors.error : colors.surfaceOutline,
                  },
                ]}
                value={hexInput}
                onChangeText={handleHexInput}
                placeholder="#000000"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={7}
              />
              <View
                style={[
                  styles.hexPreview,
                  { backgroundColor: hexInput.match(/^#[A-Fa-f0-9]{6}$/) ? hexInput : currentColor },
                  { borderColor: colors.surfaceOutline },
                ]}
              />
            </View>
            {inputError && (
              <Text style={[styles.errorText, { color: colors.error }]}>
                Invalid hex color
              </Text>
            )}
          </View>

          {/* Preset colors */}
          <View style={styles.presetsContainer}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Presets</Text>
            <ScrollView style={styles.presetsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.presetsGrid}>
                {PRESET_COLORS.map((color, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.presetSwatch,
                      { backgroundColor: color },
                      colorThemeManager.rgbaToHex(currentColor).toUpperCase() === color.toUpperCase() && styles.presetSelected,
                      { borderColor: colors.surfaceOutline },
                    ]}
                    onPress={() => handlePresetSelect(color)}
                  >
                    {colorThemeManager.rgbaToHex(currentColor).toUpperCase() === color.toUpperCase() && (
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: borderRadius.large,
    padding: spacing.lg,
    ...shadows.large,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h3,
  },
  previewContainer: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.smallMedium,
    marginBottom: spacing.sm,
  },
  colorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  colorSwatch: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.small,
    borderWidth: 1,
  },
  colorText: {
    ...typography.small,
    flex: 1,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  hexInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  hexInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.small,
    padding: spacing.md,
    ...typography.body,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hexPreview: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.small,
    borderWidth: 1,
  },
  errorText: {
    ...typography.label,
    marginTop: spacing.xs,
  },
  presetsContainer: {
    marginTop: spacing.md,
  },
  presetsScroll: {
    maxHeight: 250,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  presetSwatch: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.small,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
});


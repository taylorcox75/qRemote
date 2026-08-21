/**
 * ServerAppearanceSection.tsx — Icon + badge color customization for the
 * add/edit server forms (#224). Badge color offers a row of quick presets
 * (AVATAR_PALETTE) plus a "custom color" swatch that opens the full
 * ColorPicker, so a user can go straight to a familiar accent or dial in
 * an exact one.
 *
 * Key exports: ServerAppearanceSection
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { IconPicker } from '@/components/IconPicker';
import { ColorPicker } from '@/components/ColorPicker';
import { spacing, borderRadius } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { AVATAR_PALETTE, avatarColor } from '@/utils/server';
import { DEFAULT_SERVER_ICON, ServerIconName } from '@/constants/serverIcons';

interface ServerAppearanceSectionProps {
  name: string;
  icon: string;
  iconColor: string;
  onIconChange: (icon: string) => void;
  onIconColorChange: (color: string) => void;
}

export function ServerAppearanceSection({
  name,
  icon,
  iconColor,
  onIconChange,
  onIconColorChange,
}: ServerAppearanceSectionProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [iconPickerVisible, setIconPickerVisible] = useState(false);
  const [colorPickerVisible, setColorPickerVisible] = useState(false);

  const effectiveIcon = (icon || DEFAULT_SERVER_ICON) as ServerIconName;
  const effectiveColor = iconColor || avatarColor(name || 'qRemote');

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
        {t('server.appearance')}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={styles.row}
          onPress={() => setIconPickerVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.rowLabel, { color: colors.text }]}>{t('server.icon')}</Text>
          <View style={styles.rowRight}>
            <View
              style={[
                styles.iconPreview,
                { backgroundColor: effectiveColor + '22', borderColor: effectiveColor + '44' },
              ]}
            >
              <Ionicons name={effectiveIcon} size={20} color={effectiveColor} />
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>
        <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{t('server.badgeColor')}</Text>
        </View>
        <View style={styles.swatchRow}>
          {AVATAR_PALETTE.map((color) => {
            const selected = effectiveColor.toUpperCase() === color.toUpperCase();
            return (
              <TouchableOpacity
                key={color}
                style={[
                  styles.swatch,
                  { backgroundColor: color },
                  selected && styles.swatchSelected,
                ]}
                onPress={() => onIconColorChange(color)}
                accessibilityLabel={color}
              >
                {selected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[
              styles.swatch,
              styles.customSwatch,
              { borderColor: colors.surfaceOutline, backgroundColor: colors.background },
            ]}
            onPress={() => setColorPickerVisible(true)}
            accessibilityLabel={t('server.customColor')}
          >
            <Ionicons name="color-palette-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <IconPicker
        visible={iconPickerVisible}
        currentIcon={effectiveIcon}
        iconColor={effectiveColor}
        onIconChange={(selected) => {
          onIconChange(selected);
          setIconPickerVisible(false);
        }}
        onClose={() => setIconPickerVisible(false)}
      />
      <ColorPicker
        visible={colorPickerVisible}
        currentColor={effectiveColor}
        onColorChange={onIconColorChange}
        onClose={() => setColorPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowLabel: {
    ...typography.bodyMedium,
    fontSize: 16,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconPreview: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.small,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: 1,
    marginLeft: 16,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  customSwatch: {
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});

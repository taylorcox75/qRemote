/**
 * IconPicker.tsx — Modal grid picker for a server's badge icon (#224).
 * Mirrors ColorPicker's structure; icons preview in the currently chosen
 * badge color so the picker itself demonstrates the theming.
 *
 * Key exports: IconPicker
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';
import { SERVER_ICON_OPTIONS, ServerIconName } from '@/constants/serverIcons';

interface IconPickerProps {
  visible: boolean;
  currentIcon: ServerIconName;
  iconColor: string;
  onIconChange: (icon: ServerIconName) => void;
  onClose: () => void;
}

export function IconPicker({
  visible,
  currentIcon,
  iconColor,
  onIconChange,
  onClose,
}: IconPickerProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{t('server.chooseIcon')}</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.grid} showsVerticalScrollIndicator={false}>
            <View style={styles.gridInner}>
              {SERVER_ICON_OPTIONS.map((icon) => {
                const selected = icon === currentIcon;
                return (
                  <TouchableOpacity
                    key={icon}
                    style={[
                      styles.swatch,
                      { borderColor: selected ? iconColor : colors.surfaceOutline },
                      selected && { backgroundColor: iconColor + '22' },
                    ]}
                    onPress={() => onIconChange(icon)}
                    accessibilityLabel={icon}
                  >
                    <Ionicons name={icon} size={26} color={selected ? iconColor : colors.text} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
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
  grid: {
    maxHeight: 320,
  },
  gridInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  swatch: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.medium,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/**
 * SavePathPickerModal.tsx — Themed modal listing save paths already in use by
 * qBittorrent (from live torrents/categories, see utils/save-paths.ts) so the
 * user can tap one instead of typing it (#180).
 *
 * Key exports: SavePathPickerModal
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';

interface SavePathPickerModalProps {
  visible: boolean;
  paths: string[];
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function SavePathPickerModal({
  visible,
  paths,
  onSelect,
  onClose,
}: SavePathPickerModalProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const filtered = paths.filter((path) => path.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
      accessibilityLabel={t('savePathPicker.title')}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.card,
            shadows.medium,
            { backgroundColor: colors.surface, borderColor: colors.surfaceOutline },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: colors.surfaceOutline }]}>
            <Text style={[styles.title, { color: colors.text }]}>{t('savePathPicker.title')}</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={[
              styles.filterInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.surfaceOutline,
                color: colors.text,
              },
            ]}
            value={query}
            onChangeText={setQuery}
            placeholder={t('savePathPicker.filterPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {paths.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('savePathPicker.empty')}
            </Text>
          ) : filtered.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('savePathPicker.noMatches')}
            </Text>
          ) : (
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {filtered.map((path, index) => (
                <React.Fragment key={path}>
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => {
                      onSelect(path);
                      onClose();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={path}
                  >
                    <Ionicons name="folder-outline" size={18} color={colors.primary} />
                    <Text
                      style={[styles.rowText, { color: colors.text }]}
                      numberOfLines={1}
                      ellipsizeMode="middle"
                    >
                      {path}
                    </Text>
                  </TouchableOpacity>
                  {index < filtered.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: colors.surfaceOutline }]} />
                  )}
                </React.Fragment>
              ))}
            </ScrollView>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '90%',
    maxWidth: 480,
    maxHeight: '75%',
    borderRadius: borderRadius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  title: { ...typography.h3, fontSize: 18 },
  filterInput: {
    borderWidth: 1,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.sm,
    ...typography.secondary,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  rowText: {
    ...typography.bodyMedium,
    flex: 1,
  },
  divider: {
    height: 1,
  },
  emptyText: {
    ...typography.secondary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});

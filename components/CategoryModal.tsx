/**
 * CategoryModal.tsx — Apple-inspired popup for selecting a torrent category.
 *
 * Mirrors TagsModal: centered overlay, chip-based UI, dimmed backdrop.
 * Shows the current category as a dismissable chip, all other server
 * categories as selectable chips, and an input to create a new one.
 */
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';

interface CategoryModalProps {
  visible: boolean;
  /** Currently assigned category, or empty string for none */
  currentCategory: string;
  /** All categories available on the server */
  allCategories: string[];
  loading?: boolean;
  /** Called with a category name to assign, or '' to clear */
  onSelect: (category: string) => Promise<void>;
  /** Called when the user creates and assigns a brand-new category */
  onCreateAndSelect: (category: string) => Promise<void>;
  onClose: () => void;
}

export function CategoryModal({
  visible,
  currentCategory,
  allCategories,
  loading = false,
  onSelect,
  onCreateAndSelect,
  onClose,
}: CategoryModalProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [newInput, setNewInput] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) setNewInput('');
  }, [visible]);

  const availableCategories = allCategories.filter((c) => c !== currentCategory);
  const isLoading = loading || busy;

  const handleRemove = async () => {
    haptics.light();
    setBusy(true);
    try {
      await onSelect('');
    } finally {
      setBusy(false);
    }
  };

  const handleSelect = async (category: string) => {
    haptics.light();
    setBusy(true);
    try {
      await onSelect(category);
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    const trimmed = newInput.trim();
    if (!trimmed) return;
    haptics.medium();
    setBusy(true);
    try {
      await onCreateAndSelect(trimmed);
      setNewInput('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.sheet, { backgroundColor: colors.surface, ...shadows.large }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('torrentDetail.setCategory')}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={t('common.close')}>
              <Ionicons name="close-circle" size={26} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Current category */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>CURRENT</Text>
            {!currentCategory ? (
              <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                {t('common.none')}
              </Text>
            ) : (
              <View style={styles.chipRow}>
                <View style={[styles.currentChip, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
                  <Text style={[styles.currentChipText, { color: colors.primary }]}>
                    {currentCategory}
                  </Text>
                  <TouchableOpacity
                    onPress={handleRemove}
                    disabled={isLoading}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    accessibilityLabel={t('common.remove')}
                  >
                    <Ionicons name="close" size={14} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Available categories */}
            {availableCategories.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                  ALL CATEGORIES
                </Text>
                <View style={styles.chipRow}>
                  {availableCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.availableChip, { backgroundColor: colors.background, borderColor: colors.surfaceOutline }]}
                      onPress={() => handleSelect(cat)}
                      disabled={isLoading}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={14} color={colors.textSecondary} />
                      <Text style={[styles.availableChipText, { color: colors.text }]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* New category */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              NEW CATEGORY
            </Text>
            <View style={styles.newRow}>
              <TextInput
                style={[
                  styles.newInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.surfaceOutline,
                    color: colors.text,
                  },
                ]}
                value={newInput}
                onChangeText={setNewInput}
                placeholder={t('torrentDetail.enterCategoryName')}
                placeholderTextColor={colors.textSecondary}
                returnKeyType="done"
                onSubmitEditing={handleCreate}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={[
                  styles.createButton,
                  { backgroundColor: newInput.trim() ? colors.primary : colors.surfaceOutline },
                ]}
                onPress={handleCreate}
                disabled={isLoading || !newInput.trim()}
                activeOpacity={0.8}
                accessibilityLabel={t('screens.settings.addCategory')}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons
                    name="add"
                    size={20}
                    color={newInput.trim() ? '#FFFFFF' : colors.textSecondary}
                  />
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.large,
    paddingTop: spacing.lg,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h3,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyHint: {
    ...typography.small,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  currentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  currentChipText: {
    ...typography.small,
    fontWeight: '500',
  },
  availableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs - 2,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm - 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  availableChipText: {
    ...typography.small,
  },
  newRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  newInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    minHeight: 40,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

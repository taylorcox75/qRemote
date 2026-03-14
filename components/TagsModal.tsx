/**
 * TagsModal.tsx — Apple-inspired popup for managing torrent tags.
 *
 * Shows current tags as removable chips, available server tags as
 * tappable chips to add, and an input field to create new tags.
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
import { useTheme } from '@/context/ThemeContext';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';

interface TagsModalProps {
  visible: boolean;
  /** Comma-separated string of currently assigned tags, or empty string */
  currentTagsCsv: string;
  /** All tags available on the server */
  allServerTags: string[];
  loading?: boolean;
  onAddTag: (tag: string) => Promise<void>;
  onRemoveTag: (tag: string) => Promise<void>;
  onCreateTag?: (tag: string) => Promise<void>;
  onClose: () => void;
}

export function TagsModal({
  visible,
  currentTagsCsv,
  allServerTags,
  loading = false,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  onClose,
}: TagsModalProps) {
  const { colors, isDark } = useTheme();
  const [newTagInput, setNewTagInput] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setNewTagInput('');
    }
  }, [visible]);

  const currentTags = currentTagsCsv
    ? currentTagsCsv
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    : [];

  // Available tags not yet assigned to this torrent
  const availableTags = allServerTags.filter((t) => !currentTags.includes(t));

  const handleRemove = async (tag: string) => {
    haptics.light();
    setBusy(true);
    try {
      await onRemoveTag(tag);
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (tag: string) => {
    haptics.light();
    setBusy(true);
    try {
      await onAddTag(tag);
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    const trimmed = newTagInput.trim();
    if (!trimmed) return;
    haptics.medium();
    setBusy(true);
    try {
      if (onCreateTag) {
        await onCreateTag(trimmed);
      } else {
        await onAddTag(trimmed);
      }
      setNewTagInput('');
    } finally {
      setBusy(false);
    }
  };

  const isLoading = loading || busy;

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
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, ...shadows.large },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Tags</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={26} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Current tags */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              ASSIGNED
            </Text>
            {currentTags.length === 0 ? (
              <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                No tags assigned yet
              </Text>
            ) : (
              <View style={styles.chipRow}>
                {currentTags.map((tag) => (
                  <View
                    key={tag}
                    style={[styles.currentChip, { backgroundColor: colors.surface, borderColor: colors.primary }]}
                  >
                    <Text style={[styles.currentChipText, { color: colors.primary }]}>
                      {tag}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemove(tag)}
                      disabled={isLoading}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close" size={14} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Available tags to add */}
            {availableTags.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                  ADD FROM LIBRARY
                </Text>
                <View style={styles.chipRow}>
                  {availableTags.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={[
                        styles.availableChip,
                        { backgroundColor: colors.background, borderColor: colors.surfaceOutline },
                      ]}
                      onPress={() => handleAdd(tag)}
                      disabled={isLoading}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={14} color={colors.textSecondary} />
                      <Text style={[styles.availableChipText, { color: colors.text }]}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* New tag input */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              NEW TAG
            </Text>
            <View style={styles.newTagRow}>
              <TextInput
                style={[
                  styles.newTagInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.surfaceOutline,
                    color: colors.text,
                  },
                ]}
                value={newTagInput}
                onChangeText={setNewTagInput}
                placeholder="Tag name…"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="done"
                onSubmitEditing={handleCreate}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={[
                  styles.createButton,
                  {
                    backgroundColor: newTagInput.trim() ? colors.primary : colors.surfaceOutline,
                  },
                ]}
                onPress={handleCreate}
                disabled={isLoading || !newTagInput.trim()}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="add" size={20} color={newTagInput.trim() ? '#FFFFFF' : colors.textSecondary} />
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
  newTagRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  newTagInput: {
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

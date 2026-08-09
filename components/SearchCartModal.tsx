/**
 * SearchCartModal.tsx — Review sheet for the Search tab's add queue (#217).
 *
 * Tapping the floating cart button on the Search tab opens this: a themed
 * list of every queued result (removable individually or all at once) plus a
 * Checkout button that hands off to the full add-torrent screen. Structure
 * mirrors SavePathPickerModal (same overlay/card/header/list shape).
 *
 * Key exports: SearchCartModal
 */
import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { SearchCartItem } from '@/context/SearchCartContext';
import { formatSize } from '@/utils/format';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';
import { haptics } from '@/utils/haptics';

interface SearchCartModalProps {
  visible: boolean;
  items: SearchCartItem[];
  onRemove: (fileUrl: string) => void;
  onClearAll: () => void;
  onCheckout: () => void;
  onClose: () => void;
}

export function SearchCartModal({
  visible,
  items,
  onRemove,
  onClearAll,
  onCheckout,
  onClose,
}: SearchCartModalProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
      accessibilityLabel={t('screens.search.cartTitle')}
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
            <Text style={[styles.title, { color: colors.text }]}>
              {t('screens.search.cartTitle')}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {items.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('screens.search.cartEmpty')}
            </Text>
          ) : (
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {items.map((item, index) => (
                <React.Fragment key={item.fileUrl}>
                  <View style={styles.row}>
                    <Ionicons name="cart-outline" size={18} color={colors.primary} />
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowText, { color: colors.text }]} numberOfLines={2}>
                        {item.fileName || '—'}
                      </Text>
                      <Text
                        style={[styles.rowMeta, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {formatSize(item.fileSize)}
                        {'  ·  '}
                        <Text style={{ color: colors.success }}>
                          ↑{Math.max(0, item.nbSeeders)}
                        </Text>
                        {item.indexerLabel ? `  ·  ${item.indexerLabel}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        haptics.light();
                        onRemove(item.fileUrl);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel={t('common.remove')}
                    >
                      <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {index < items.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: colors.surfaceOutline }]} />
                  )}
                </React.Fragment>
              ))}
            </ScrollView>
          )}

          <View style={styles.footer}>
            <TouchableOpacity
              onPress={() => {
                haptics.medium();
                onClearAll();
              }}
              disabled={items.length === 0}
              style={styles.clearButton}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.clearButtonText,
                  { color: items.length === 0 ? colors.textSecondary : colors.error },
                ]}
              >
                {t('screens.search.cartClearAll')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                haptics.medium();
                onCheckout();
              }}
              disabled={items.length === 0}
              style={[
                styles.checkoutButton,
                {
                  backgroundColor: items.length === 0 ? colors.surfaceOutline : colors.primary,
                },
              ]}
              activeOpacity={0.7}
            >
              <Text style={styles.checkoutButtonText}>
                {t('screens.search.cartCheckout', { count: items.length })}
              </Text>
            </TouchableOpacity>
          </View>
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
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowText: {
    ...typography.bodyMedium,
  },
  rowMeta: {
    ...typography.caption,
  },
  divider: {
    height: 1,
  },
  emptyText: {
    ...typography.secondary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  clearButton: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
  },
  clearButtonText: {
    ...typography.bodyMedium,
  },
  checkoutButton: {
    flex: 1,
    borderRadius: borderRadius.medium,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
  },
  checkoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

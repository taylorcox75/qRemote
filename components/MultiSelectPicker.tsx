/**
 * MultiSelectPicker.tsx — Reusable modal for multi-select option lists with checkbox indicator.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';

export interface MultiSelectPickerItem {
  label: string;
  value: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}

interface MultiSelectPickerProps {
  visible: boolean;
  title: string;
  options: MultiSelectPickerItem[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  onClose: () => void;
}

export function MultiSelectPicker({
  visible,
  title,
  options,
  selectedValues,
  onChange,
  onClose,
}: MultiSelectPickerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const menuContainerRef = useRef<View>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const hasAdjustedPosition = useRef(false);

  useEffect(() => {
    if (visible) {
      const screenWidth = Dimensions.get('window').width;
      const screenHeight = Dimensions.get('window').height;
      const menuWidth = 320;
      const menuX = (screenWidth - menuWidth) / 2;
      const menuY = screenHeight / 4;
      setMenuPosition({ x: menuX, y: menuY });
      hasAdjustedPosition.current = false;
    }
  }, [visible]);

  const toggleValue = (value: string) => {
    const has = selectedValues.includes(value);
    const next = has ? selectedValues.filter((v) => v !== value) : [...selectedValues, value];
    onChange(next);
  };

  const menuRole = Platform.OS === 'ios' ? 'menu' : 'none';
  const menuItemRole = Platform.OS === 'ios' ? 'menuitem' : 'button';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
      accessibilityLabel={title}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close picker"
      >
        <View
          ref={menuContainerRef}
          onLayout={(event) => {
            if (hasAdjustedPosition.current) return;
            const { height } = event.nativeEvent.layout;
            if (height > 0 && height > 10) {
              const screenHeight = Dimensions.get('window').height;
              const topPadding = Math.max(insets.top, 16) + 8;
              const bottomPadding = Math.max(insets.bottom, 16) + 8;
              const currentTop = menuPosition.y;
              const menuBottom = currentTop + height;

              let adjustedY = currentTop;
              if (menuBottom > screenHeight - bottomPadding) {
                adjustedY = screenHeight - height - bottomPadding;
              }
              if (adjustedY < topPadding) {
                adjustedY = topPadding;
              }

              const screenWidth = Dimensions.get('window').width;
              const menuWidth = 320;
              const adjustedX = (screenWidth - menuWidth) / 2;

              if (Math.abs(adjustedY - currentTop) > 5 || Math.abs(adjustedX - menuPosition.x) > 5) {
                hasAdjustedPosition.current = true;
                setMenuPosition({ x: adjustedX, y: adjustedY });
              }
            }
          }}
          style={[
            styles.menuContainer,
            {
              backgroundColor: colors.surface,
              top: menuPosition.y,
              left: menuPosition.x,
              shadowColor: colors.text,
            },
          ]}
          accessibilityRole={menuRole}
          accessibilityLabel={title}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.menuHeader}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ paddingBottom: spacing.sm }}>
            {options.map((option, index) => {
              const selected = selectedValues.includes(option.value);
              return (
                <React.Fragment key={option.value}>
                  <TouchableOpacity
                    style={[
                      styles.menuOption,
                      selected && { backgroundColor: colors.surfaceOutline },
                    ]}
                    onPress={() => toggleValue(option.value)}
                    activeOpacity={0.7}
                    accessibilityRole={menuItemRole}
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected }}
                  >
                    {option.icon && (
                      <Ionicons name={option.icon} size={20} color={colors.primary} style={styles.menuIcon} />
                    )}
                    <Text
                      style={[
                        styles.menuOptionText,
                        {
                          color: colors.text,
                          fontWeight: selected ? '600' : '400',
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={selected ? colors.primary : colors.textSecondary}
                    />
                  </TouchableOpacity>
                  {index < options.length - 1 && (
                    <View style={[styles.menuDivider, { backgroundColor: colors.surfaceOutline }]} />
                  )}
                </React.Fragment>
              );
            })}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  menuContainer: {
    position: 'absolute',
    width: 320,
    borderRadius: borderRadius.large,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    ...shadows.card,
    elevation: 8,
    maxHeight: '75%',
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    marginBottom: spacing.xs,
  },
  menuTitle: {
    ...typography.h3,
    fontSize: 18,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  menuIcon: {
    marginRight: spacing.xs,
  },
  menuOptionText: {
    ...typography.bodyMedium,
    flex: 1,
  },
  menuDivider: {
    height: 1,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
});


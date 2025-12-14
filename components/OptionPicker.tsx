import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, borderRadius } from '../constants/spacing';
import { shadows } from '../constants/shadows';
import { typography } from '../constants/typography';

export interface OptionPickerItem {
  label: string;
  value: string;
  icon?: string;
}

interface OptionPickerProps {
  visible: boolean;
  title: string;
  options: OptionPickerItem[];
  selectedValue?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export function OptionPicker({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: OptionPickerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const menuContainerRef = useRef<View>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const hasAdjustedPosition = useRef(false);

  useEffect(() => {
    if (visible) {
      // Center the menu on screen
      const screenWidth = Dimensions.get('window').width;
      const screenHeight = Dimensions.get('window').height;
      const menuWidth = 280;
      const menuX = (screenWidth - menuWidth) / 2;
      const menuY = screenHeight / 3; // Start at 1/3 from top
      setMenuPosition({ x: menuX, y: menuY });
      hasAdjustedPosition.current = false;
    }
  }, [visible]);

  const handleSelect = (value: string) => {
    onSelect(value);
    onClose();
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
              
              // Center vertically if possible, but keep within bounds
              if (menuBottom > screenHeight - bottomPadding) {
                adjustedY = screenHeight - height - bottomPadding;
              }
              if (adjustedY < topPadding) {
                adjustedY = topPadding;
              }
              
              // Center horizontally
              const screenWidth = Dimensions.get('window').width;
              const menuWidth = 280;
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
          {/* Title */}
          <View style={styles.menuHeader}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          {/* Options */}
          {options.map((option, index) => (
            <React.Fragment key={option.value}>
              <TouchableOpacity
                style={[
                  styles.menuOption,
                  selectedValue === option.value && { backgroundColor: colors.surfaceOutline },
                ]}
                onPress={() => handleSelect(option.value)}
                activeOpacity={0.7}
                accessibilityRole={menuItemRole}
                accessibilityLabel={option.label}
                accessibilityState={{ selected: selectedValue === option.value }}
              >
                {option.icon && (
                  <Ionicons
                    name={option.icon as any}
                    size={20}
                    color={colors.primary}
                    style={styles.menuIcon}
                  />
                )}
                <Text
                  style={[
                    styles.menuOptionText,
                    {
                      color: colors.text,
                      fontWeight: selectedValue === option.value ? '600' : '400',
                    },
                  ]}
                >
                  {option.label}
                </Text>
                {selectedValue === option.value && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
              {index < options.length - 1 && (
                <View style={[styles.menuDivider, { backgroundColor: colors.surfaceOutline }]} />
              )}
            </React.Fragment>
          ))}
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
    width: 280,
    borderRadius: borderRadius.large,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    ...shadows.card,
    elevation: 8,
    maxHeight: '70%',
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


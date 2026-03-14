import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { spacing, borderRadius } from '@/constants/spacing';

export interface ActionMenuItemDef {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  destructive?: boolean;
}

interface ActionMenuProps {
  visible: boolean;
  onClose: () => void;
  items: ActionMenuItemDef[];
}

export function ActionMenu({ visible, onClose, items }: ActionMenuProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const handleItemPress = (onPress: () => void) => {
    onClose();
    setTimeout(onPress, 150);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={[styles.handle, { backgroundColor: colors.surfaceOutline }]} />
          <ScrollView bounces={false} style={styles.list}>
            {items.map((item, idx) => (
              <TouchableOpacity
                key={`${item.icon}-${idx}`}
                style={styles.row}
                onPress={() => handleItemPress(item.onPress)}
                activeOpacity={0.6}
              >
                <Ionicons
                  name={item.icon}
                  size={22}
                  color={item.destructive ? colors.error : colors.primary}
                  style={styles.icon}
                />
                <Text
                  style={[
                    styles.label,
                    { color: item.destructive ? colors.error : colors.text },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: borderRadius.large,
    borderTopRightRadius: borderRadius.large,
    paddingTop: spacing.sm,
    maxHeight: '60%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    minHeight: 48,
  },
  icon: {
    width: 28,
    marginRight: spacing.md,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
});

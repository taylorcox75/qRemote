import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { haptics } from '@/utils/haptics';

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
  /**
   * When set, the menu renders as a floating popover anchored near this
   * window-coordinate point (e.g. a button's bottom-left corner) instead of
   * the default bottom sheet.
   */
  anchor?: { x: number; y: number };
}

const POPOVER_WIDTH = 230;
const POPOVER_MARGIN = spacing.sm;
const POPOVER_ANCHOR_GAP = spacing.xs;

export function ActionMenu({ visible, onClose, items, anchor }: ActionMenuProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // Measured popover height (null until the first layout pass), used to clamp
  // the popover's top edge inside the safe area without guessing content size.
  const [popoverHeight, setPopoverHeight] = useState<number | null>(null);

  useEffect(() => {
    // Re-measure whenever the menu reopens or moves to a new anchor. Skip the
    // closing transition: the Modal stays mounted for its fade-out, so clearing
    // the measured height on the way out drops the popover to opacity 0 and then
    // re-reveals it after onLayout — a visible flash mid-dismiss.
    if (!visible) return;
    setPopoverHeight(null);
  }, [visible, anchor?.x, anchor?.y]);

  const handleItemPress = (onPress: () => void, destructive?: boolean) => {
    if (destructive) haptics.warning();
    else haptics.selection();
    onClose();
    setTimeout(onPress, 150);
  };

  const handlePopoverLayout = (event: LayoutChangeEvent) => {
    setPopoverHeight(event.nativeEvent.layout.height);
  };

  const renderItems = () => (
    <ScrollView bounces={false} style={styles.list}>
      {items.map((item, idx) => (
        <TouchableOpacity
          key={`${item.icon}-${idx}`}
          style={styles.row}
          onPress={() => handleItemPress(item.onPress, item.destructive)}
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
  );

  const renderPopover = (anchorPoint: { x: number; y: number }) => {
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    const minLeft = insets.left + POPOVER_MARGIN;
    const maxLeft = screenWidth - insets.right - POPOVER_MARGIN - POPOVER_WIDTH;
    const left = Math.max(minLeft, Math.min(anchorPoint.x, maxLeft));

    const minTop = insets.top + POPOVER_MARGIN;
    const maxPopoverHeight =
      screenHeight - insets.top - insets.bottom - POPOVER_MARGIN * 2;
    const effectiveHeight = Math.min(popoverHeight ?? 0, maxPopoverHeight);
    const maxTop =
      screenHeight - insets.bottom - POPOVER_MARGIN - effectiveHeight;
    const top = Math.max(
      minTop,
      Math.min(anchorPoint.y + POPOVER_ANCHOR_GAP, maxTop)
    );

    return (
      <View
        testID="action-menu-popover"
        onLayout={handlePopoverLayout}
        style={[
          styles.popover,
          shadows.medium,
          {
            left,
            top,
            maxHeight: maxPopoverHeight,
            backgroundColor: colors.surface,
            borderColor: colors.surfaceOutline,
            // Avoid a visible jump: keep the popover invisible until it has
            // been measured and clamped into its final position.
            opacity: popoverHeight === null ? 0 : 1,
          },
        ]}
      >
        {renderItems()}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        {anchor ? (
          renderPopover(anchor)
        ) : (
          <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={[styles.handle, { backgroundColor: colors.surfaceOutline }]} />
            {renderItems()}
          </View>
        )}
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
  popover: {
    position: 'absolute',
    width: POPOVER_WIDTH,
    borderRadius: borderRadius.large,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.xs,
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

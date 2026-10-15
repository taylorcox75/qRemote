/**
 * SwipeActionsPanel — the action buttons revealed behind a swiped row
 * (RNGH `Swipeable`'s `renderLeftActions` / `renderRightActions`).
 *
 * Each action grows from zero width to its full width as the row opens
 * (`progress`: 0 = closed, 1 = fully open), with its icon and label scaling up
 * alongside. Height never changes — it always matches the row. Width can't run
 * on the native driver, so the host `Swipeable` must set
 * `useNativeAnimations={false}`.
 */
import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { spacing } from '@/constants/spacing';

/** Full width of one action, including the gap that separates it from its neighbor. */
export const SWIPE_ACTION_WIDTH = 84;

export interface SwipeAction {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}

interface SwipeActionsPanelProps {
  progress: Animated.AnimatedInterpolation<number>;
  /** Which edge of the row the panel is revealed from. */
  side: 'left' | 'right';
  /** Corner radius of each action — pass the row's own radius. */
  radius: number;
  actions: SwipeAction[];
}

export function SwipeActionsPanel({ progress, side, radius, actions }: SwipeActionsPanelProps) {
  const { colors } = useTheme();

  const grow = (to: number) =>
    progress.interpolate({ inputRange: [0, 1], outputRange: [0, to], extrapolate: 'clamp' });
  const width = grow(SWIPE_ACTION_WIDTH);
  const gap = grow(spacing.xs);
  const scale = grow(1);

  // The gap sits on the side of each action that faces the row.
  const gapStyle = side === 'right' ? { marginLeft: gap } : { marginRight: gap };

  return (
    // Fixed width: Swipeable measures this block to know how far the row
    // opens, so it must not shrink with the growing actions inside it.
    <View
      style={[
        styles.panel,
        { width: SWIPE_ACTION_WIDTH * actions.length },
        side === 'right' && styles.panelRight,
      ]}
    >
      {actions.map((action) => (
        <Animated.View key={action.key} style={[styles.slot, { width }]}>
          <Animated.View style={[styles.pill, gapStyle, { borderRadius: radius }]}>
            <RectButton
              style={[styles.button, { backgroundColor: action.color }]}
              onPress={action.onPress}
            >
              {/* Laid out at full size so the label never truncates mid-swipe;
                  the scale alone makes it fit. */}
              <Animated.View style={[styles.content, { transform: [{ scale }] }]}>
                <Ionicons name={action.icon} size={22} color={colors.onAccent} />
                <Text style={[styles.label, { color: colors.onAccent }]} numberOfLines={1}>
                  {action.label}
                </Text>
              </Animated.View>
            </RectButton>
          </Animated.View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flexDirection: 'row',
    marginVertical: spacing.xs,
  },
  panelRight: {
    justifyContent: 'flex-end',
  },
  slot: {
    overflow: 'hidden',
  },
  pill: {
    flex: 1,
    overflow: 'hidden',
  },
  button: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: SWIPE_ACTION_WIDTH - spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
});

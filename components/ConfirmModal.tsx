import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { haptics } from '@/utils/haptics';

export interface ConfirmModalButton {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons: ConfirmModalButton[];
  cancelLabel: string;
  onCancel: () => void;
}

/**
 * Themed confirmation dialog styled like InputModal/ActionMenu, replacing the
 * native Alert.alert which ignores the app's color theme.
 */
export function ConfirmModal({
  visible,
  title,
  message,
  buttons,
  cancelLabel,
  onCancel,
}: ConfirmModalProps) {
  const { colors } = useTheme();

  const handleButtonPress = (button: ConfirmModalButton) => {
    if (button.destructive) haptics.warning();
    else haptics.medium();
    button.onPress();
  };

  const handleCancel = () => {
    haptics.light();
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.modal,
            shadows.medium,
            {
              backgroundColor: colors.surface,
              borderColor: colors.surfaceOutline,
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {message ? (
            <Text
              style={[styles.message, { color: colors.textSecondary }]}
              numberOfLines={3}
              ellipsizeMode="middle"
            >
              {message}
            </Text>
          ) : null}
          <View style={styles.buttons}>
            {buttons.map((button) => (
              <TouchableOpacity
                key={button.label}
                style={[
                  styles.button,
                  {
                    backgroundColor: button.destructive ? colors.error : colors.primary,
                  },
                ]}
                onPress={() => handleButtonPress(button)}
                activeOpacity={0.7}
              >
                <Text style={[styles.buttonText, { color: colors.surface }]}>
                  {button.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.surfaceOutline }]}
              onPress={handleCancel}
              activeOpacity={0.7}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>{cancelLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // Match ActionMenu dim — slightly softer than the old 0.5 so the dialog
    // feels related to the themed action popover rather than a flat system alert.
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modal: {
    borderRadius: borderRadius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    width: '80%',
    maxWidth: 400,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  message: {
    fontSize: 14,
    marginBottom: spacing.md,
  },
  buttons: {
    gap: spacing.sm,
  },
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.medium,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

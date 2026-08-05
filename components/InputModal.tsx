import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { PathAutocompleteInput } from '@/components/PathAutocompleteInput';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { buttonStyles, buttonText } from '@/constants/buttons';

/** A one-tap value, for inputs whose useful answers are hard to type (e.g. "-1"). */
export interface InputModalPreset {
  label: string;
  value: string;
  /**
   * Escape hatch for presets whose effect isn't "fill the field" — e.g. a
   * global "Unlimited" shortcut that actually disables a separate switch
   * rather than writing a sentinel number. When present, this runs instead of
   * setValue/setTouched, and is responsible for closing the modal itself.
   */
  action?: () => void;
}

interface InputModalProps {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad' | 'numbers-and-punctuation';
  multiline?: boolean;
  allowEmpty?: boolean;
  /** Suggests directory names as the user types (qBittorrent 5.0+ only; see PathAutocompleteInput). */
  pathAutocomplete?: boolean;
  /**
   * Returns an error message for an invalid entry, or null when it's acceptable.
   * While it returns a message the error is shown under the field and Confirm is
   * disabled, so bad input can't reach the API.
   */
  validate?: (value: string) => string | null;
  /** Chips that fill the field in one tap. */
  presets?: InputModalPreset[];
  /**
   * Live "= X" preview shown under the field, recomputed from the current value
   * on every keystroke (e.g. converting a typed KiB/s number to its formatted
   * speed). Return null to hide the preview for the current value.
   */
  computeHint?: (value: string) => string | null;
}

export function InputModal({
  visible,
  title,
  message,
  placeholder,
  defaultValue,
  onCancel,
  onConfirm,
  keyboardType = 'default',
  multiline = false,
  allowEmpty = false,
  pathAutocomplete = false,
  validate,
  presets,
  computeHint,
}: InputModalProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [value, setValue] = useState(defaultValue || '');
  const [touched, setTouched] = useState(false);

  // Update value when defaultValue changes (e.g., when modal opens)
  useEffect(() => {
    if (visible && defaultValue !== undefined) {
      setValue(defaultValue);
      setTouched(false);
    }
  }, [visible, defaultValue]);

  const hint = computeHint ? computeHint(value) : null;
  const validationError = validate ? validate(value) : null;
  const isEmpty = value.trim() === '';
  const canConfirm = (allowEmpty || !isEmpty) && !validationError;
  // Don't scold the user about input they haven't typed yet.
  const shownError = touched && validationError ? validationError : null;

  const handleConfirm = () => {
    if (!canConfirm) {
      setTouched(true);
      return;
    }
    onConfirm(value.trim());
    setValue('');
    setTouched(false);
  };

  const handleCancel = () => {
    setValue('');
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
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
          {message && (
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          )}
          {pathAutocomplete ? (
            <PathAutocompleteInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.surfaceOutline,
                  color: colors.text,
                },
              ]}
              value={value}
              onChangeText={setValue}
              placeholder={placeholder}
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
          ) : (
            <TextInput
              style={[
                styles.input,
                multiline && styles.inputMultiline,
                {
                  backgroundColor: colors.background,
                  borderColor: shownError ? colors.error : colors.surfaceOutline,
                  color: colors.text,
                },
                shownError != null && styles.inputWithError,
              ]}
              value={value}
              onChangeText={(next) => {
                setValue(next);
                setTouched(true);
              }}
              placeholder={placeholder}
              placeholderTextColor={colors.textSecondary}
              keyboardType={keyboardType}
              multiline={multiline}
              autoFocus
            />
          )}
          {shownError && (
            <Text style={[styles.errorText, { color: colors.error }]}>{shownError}</Text>
          )}
          {!shownError && hint && (
            <Text style={[styles.hint, { color: colors.primary }]}>= {hint}</Text>
          )}
          {presets && presets.length > 0 && (
            <View style={styles.presets}>
              {presets.map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  style={[
                    buttonStyles.chip,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.surfaceOutline,
                      borderWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                  onPress={() => {
                    if (preset.action) {
                      preset.action();
                      return;
                    }
                    setValue(preset.value);
                    setTouched(true);
                  }}
                >
                  <Text style={[buttonText.chip, { color: colors.text }]}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.surfaceOutline }]}
              onPress={handleCancel}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: colors.primary },
                !canConfirm && styles.buttonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!canConfirm}
            >
              <Text style={[styles.buttonText, { color: colors.onAccent }]}>
                {t('common.confirm')}
              </Text>
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
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.medium,
    padding: spacing.sm,
    fontSize: 16,
    marginBottom: spacing.md,
    minHeight: 44,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  // Tighten the gap so the error message reads as attached to the field.
  inputWithError: {
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: 13,
    marginBottom: spacing.md,
  },
  hint: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: spacing.md,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.medium,
    minWidth: 80,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

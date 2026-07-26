import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, TextInputProps, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useServer } from '@/context/ServerContext';
import { applicationApi } from '@/services/api/application';
import { apiClient } from '@/services/api/client';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';

const SUGGESTION_LIMIT = 8;
const DEBOUNCE_MS = 250;
/** Delay clearing suggestions on blur so a tap on a row can register first. */
const BLUR_CLEAR_MS = 150;

interface PathAutocompleteInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;
  onChangeText: (text: string) => void;
}

/**
 * Drop-in TextInput replacement for absolute directory paths. When connected
 * to a qBittorrent 5.0+ server (app/getDirectoryContent, WebAPI >= 2.11), it
 * lists the contents of whatever directory precedes the text being typed and
 * suggests matches — the same mechanism the official WebUI uses (see
 * pathAutofill.js), minus native <datalist> which RN has no equivalent for.
 * Silently falls back to a plain input (no suggestions) when unsupported,
 * disconnected, or the directory doesn't exist — this is a nicety, not
 * something that should ever block or error the field.
 */
export function PathAutocompleteInput({
  value,
  onChangeText,
  style,
  onBlur,
  ...rest
}: PathAutocompleteInputProps) {
  const { colors } = useTheme();
  const { isConnected } = useServer();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Bumped on each fetch / unmount so in-flight responses are ignored. */
  const fetchIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (blurClearRef.current) clearTimeout(blurClearRef.current);
      fetchIdRef.current += 1;
    };
  }, []);

  const clearSuggestionsSoon = () => {
    if (blurClearRef.current) clearTimeout(blurClearRef.current);
    blurClearRef.current = setTimeout(() => {
      setSuggestions([]);
      blurClearRef.current = null;
    }, BLUR_CLEAR_MS);
  };

  const cancelPendingBlurClear = () => {
    if (blurClearRef.current) {
      clearTimeout(blurClearRef.current);
      blurClearRef.current = null;
    }
  };

  const fetchSuggestions = (text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!isConnected || !apiClient.getApiFeatures().supportsGetDirectoryContent) {
      setSuggestions([]);
      return;
    }
    const lastSlash = text.lastIndexOf('/');
    if (!text.startsWith('/') || lastSlash < 0) {
      setSuggestions([]);
      return;
    }
    const parentDir = text.slice(0, lastSlash + 1);
    const partial = text.slice(lastSlash + 1).toLowerCase();
    const fetchId = ++fetchIdRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const names = await applicationApi.getDirectoryContent(parentDir, 'dirs');
        if (fetchId !== fetchIdRef.current) return;
        setSuggestions(
          names.filter((name) => name.toLowerCase().startsWith(partial)).slice(0, SUGGESTION_LIMIT),
        );
      } catch {
        if (fetchId !== fetchIdRef.current) return;
        setSuggestions([]);
      }
    }, DEBOUNCE_MS);
  };

  const handleChangeText = (text: string) => {
    cancelPendingBlurClear();
    onChangeText(text);
    fetchSuggestions(text);
  };

  const applySuggestion = (name: string) => {
    cancelPendingBlurClear();
    const lastSlash = value.lastIndexOf('/');
    const parentDir = lastSlash >= 0 ? value.slice(0, lastSlash + 1) : '/';
    onChangeText(`${parentDir}${name}/`);
    setSuggestions([]);
  };

  return (
    <View>
      <TextInput
        style={style}
        value={value}
        onChangeText={handleChangeText}
        onBlur={(e) => {
          clearSuggestionsSoon();
          onBlur?.(e);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
      />
      {suggestions.length > 0 && (
        <View
          style={[
            styles.suggestions,
            { backgroundColor: colors.surface, borderColor: colors.surfaceOutline },
            shadows.medium,
          ]}
        >
          {suggestions.map((name) => (
            <TouchableOpacity
              key={name}
              style={styles.suggestionRow}
              onPressIn={() => applySuggestion(name)}
            >
              <Text style={[styles.suggestionText, { color: colors.text }]} numberOfLines={1}>
                {name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  suggestions: {
    borderWidth: 1,
    borderRadius: borderRadius.medium,
    marginTop: 4,
    maxHeight: 220,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  suggestionText: {
    fontSize: 14,
  },
});

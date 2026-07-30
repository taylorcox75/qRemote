import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useServer } from '@/context/ServerContext';
import { useTorrents } from '@/context/TorrentContext';
import { applicationApi } from '@/services/api/application';
import { apiClient } from '@/services/api/client';
import { getKnownSavePaths } from '@/utils/save-paths';
import { SavePathPickerModal } from '@/components/SavePathPickerModal';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';

const SUGGESTION_LIMIT = 8;
const DEBOUNCE_MS = 250;
/** Delay clearing suggestions on blur so a tap on a row can register first. */
const BLUR_CLEAR_MS = 150;

/**
 * qBittorrent's getDirectoryContent returns absolute paths (QDirIterator::next),
 * not basenames. Strip to the final segment so we can filter and apply safely.
 */
function toBaseName(entry: string): string {
  const trimmed = entry.replace(/\/+$/, '');
  const idx = trimmed.lastIndexOf('/');
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

interface PathAutocompleteInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;
  onChangeText: (text: string) => void;
}

/**
 * Drop-in TextInput replacement for absolute directory paths. When connected
 * to a qBittorrent 5.0+ server (app/getDirectoryContent, WebAPI >= 2.11), it
 * lists the parent directory of whatever is being typed and filters by the
 * partial segment after the last `/`. The API returns absolute paths, so
 * entries are normalized to basenames before filtering/applying.
 * Silently falls back to a plain input (no suggestions) when unsupported,
 * disconnected, or the directory doesn't exist — this is a nicety, not
 * something that should ever block or error the field.
 *
 * Also renders a browse button that opens SavePathPickerModal, listing paths
 * already in use by qBittorrent (from TorrentContext — every torrent's
 * save_path plus every category's savePath). Unlike the type-ahead above,
 * this works on any qBittorrent version since it needs no extra API call (#180).
 */
export function PathAutocompleteInput({
  value,
  onChangeText,
  style,
  onBlur,
  editable,
  ...rest
}: PathAutocompleteInputProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { isConnected } = useServer();
  const { torrents, categories } = useTorrents();
  const knownPaths = useMemo(() => getKnownSavePaths(torrents, categories), [torrents, categories]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
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
          names
            .map(toBaseName)
            .filter((name) => name.length > 0 && name.toLowerCase().startsWith(partial))
            .slice(0, SUGGESTION_LIMIT)
            .map((name) => `${parentDir}${name}`),
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

  const applySuggestion = (path: string) => {
    cancelPendingBlurClear();
    const newValue = `${path}/`;
    onChangeText(newValue);
    // Immediately list the directory just selected instead of leaving the
    // dropdown empty until the user types another character.
    fetchSuggestions(newValue);
  };

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          style={[style, styles.textInput]}
          value={value}
          onChangeText={handleChangeText}
          onBlur={(e) => {
            clearSuggestionsSoon();
            onBlur?.(e);
          }}
          editable={editable}
          autoCapitalize="none"
          autoCorrect={false}
          {...rest}
        />
        <TouchableOpacity
          onPress={() => setPickerVisible(true)}
          disabled={editable === false}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={t('savePathPicker.browseButtonLabel')}
        >
          <Ionicons
            name="folder-open-outline"
            size={22}
            color={editable === false ? colors.textSecondary : colors.primary}
          />
        </TouchableOpacity>
      </View>
      {suggestions.length > 0 && (
        <ScrollView
          style={[
            styles.suggestions,
            { backgroundColor: colors.surface, borderColor: colors.surfaceOutline },
            shadows.medium,
          ]}
          keyboardShouldPersistTaps="always"
          nestedScrollEnabled
        >
          {suggestions.map((path) => (
            <TouchableOpacity
              key={path}
              style={styles.suggestionRow}
              onPressIn={() => applySuggestion(path)}
            >
              <Text style={[styles.suggestionText, { color: colors.text }]} numberOfLines={1}>
                {path}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <SavePathPickerModal
        visible={pickerVisible}
        paths={knownPaths}
        onSelect={(path) => {
          cancelPendingBlurClear();
          setSuggestions([]);
          onChangeText(path);
        }}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  textInput: {
    flex: 1,
  },
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

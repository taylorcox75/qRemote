/**
 * CustomHeadersSection.tsx — Custom HTTP header editor for the add/edit server
 * forms (#228). Lets a server send extra headers on every request, for
 * tunnels/proxies (Pangolin, Cloudflare Access, etc.) that gate access with
 * their own header-based token auth, independent of qBittorrent's own auth.
 *
 * Key exports: CustomHeadersSection
 */
import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { SettingRow } from '@/components/SettingRow';
import { CustomHeaderPair, isReservedHeaderName } from '@/utils/customHeaders';

const MAX_CUSTOM_HEADERS = 5;

interface CustomHeadersSectionProps {
  useCustomHeaders: boolean;
  headers: CustomHeaderPair[];
  onUseCustomHeadersChange: (value: boolean) => void;
  onHeadersChange: (headers: CustomHeaderPair[]) => void;
}

export function CustomHeadersSection({
  useCustomHeaders,
  headers,
  onUseCustomHeadersChange,
  onHeadersChange,
}: CustomHeadersSectionProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const handleToggle = (value: boolean) => {
    onUseCustomHeadersChange(value);
    if (value && headers.length === 0) {
      onHeadersChange([{ key: '', value: '' }]);
    }
  };

  const updateHeader = (index: number, field: keyof CustomHeaderPair, text: string) => {
    onHeadersChange(
      headers.map((header, i) => (i === index ? { ...header, [field]: text } : header)),
    );
  };

  const addHeader = () => {
    if (headers.length >= MAX_CUSTOM_HEADERS) return;
    onHeadersChange([...headers, { key: '', value: '' }]);
  };

  const removeHeader = (index: number) => {
    onHeadersChange(headers.filter((_, i) => i !== index));
  };

  const atMax = headers.length >= MAX_CUSTOM_HEADERS;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
        {t('server.customHeaders')}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <SettingRow
          icon="code-slash-outline"
          label={t('server.useCustomHeaders')}
          hint={t('server.useCustomHeadersHint')}
        >
          <Switch
            value={useCustomHeaders}
            onValueChange={handleToggle}
            trackColor={{ false: colors.surfaceOutline, true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </SettingRow>
        {useCustomHeaders && (
          <>
            {headers.map((header, index) => {
              const reserved = isReservedHeaderName(header.key);
              return (
                <View key={index}>
                  <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                  <View style={styles.headerRow}>
                    <View style={styles.headerInputs}>
                      <TextInput
                        style={[
                          styles.headerInput,
                          {
                            color: colors.text,
                            backgroundColor: colors.background,
                            borderColor: reserved ? colors.error : colors.surfaceOutline,
                          },
                        ]}
                        value={header.key}
                        onChangeText={(text) => updateHeader(index, 'key', text)}
                        placeholder={t('placeholders.headerName')}
                        placeholderTextColor={colors.textSecondary}
                        autoCapitalize="none"
                        autoCorrect={false}
                        textContentType="none"
                        autoComplete="off"
                      />
                      <TextInput
                        style={[
                          styles.headerInput,
                          {
                            color: colors.text,
                            backgroundColor: colors.background,
                            borderColor: colors.surfaceOutline,
                          },
                        ]}
                        value={header.value}
                        onChangeText={(text) => updateHeader(index, 'value', text)}
                        placeholder={t('placeholders.headerValue')}
                        placeholderTextColor={colors.textSecondary}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        textContentType="none"
                        autoComplete="off"
                        passwordRules=""
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => removeHeader(index)}
                      style={styles.removeButton}
                      accessibilityLabel={t('server.removeHeader')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={22} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                  {reserved && (
                    <Text style={[styles.hintText, { color: colors.error }]}>
                      {t('errors.reservedHeaderName', { name: header.key.trim() })}
                    </Text>
                  )}
                </View>
              );
            })}
            <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
            <TouchableOpacity style={styles.addRow} onPress={addHeader} disabled={atMax}>
              <Ionicons
                name="add-circle-outline"
                size={20}
                color={atMax ? colors.textSecondary : colors.primary}
              />
              <Text
                style={[
                  styles.addRowText,
                  { color: atMax ? colors.textSecondary : colors.primary },
                ]}
              >
                {t('server.addHeader')}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerInputs: {
    flex: 1,
    gap: 8,
  },
  headerInput: {
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  removeButton: {
    marginLeft: 12,
  },
  separator: {
    height: 1,
    marginLeft: 16,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  addRowText: {
    fontSize: 15,
    fontWeight: '500',
  },
  hintText: {
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
});

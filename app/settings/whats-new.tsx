import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { FocusAwareStatusBar } from '@/components/FocusAwareStatusBar';
import { CHANGELOG } from '@/constants/changelog';
import { spacing, borderRadius } from '@/constants/spacing';
import { shadows } from '@/constants/shadows';
import { typography } from '@/constants/typography';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatReleaseDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const month = MONTH_NAMES[m - 1];
  return month ? `${month} ${d}, ${y}` : isoDate;
}

export default function WhatsNewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isDark, colors } = useTheme();

  return (
    <>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.surfaceOutline }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Ionicons name="sparkles" size={22} color={colors.primary} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t('screens.settings.whatsNew')}</Text>
          </View>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {CHANGELOG.map((release) => (
            <View key={release.version} style={styles.changelogRelease}>
              <View style={styles.releaseHeader}>
                <Text style={[styles.releaseVersion, { color: colors.primary }]}>v{release.version}</Text>
                <Text style={[styles.releaseDate, { color: colors.textSecondary }]}>{formatReleaseDate(release.date)}</Text>
              </View>
              <View style={[styles.changesList, { backgroundColor: colors.surface }]}>
                {release.changes.map((change, changeIndex) => (
                  <View key={changeIndex} style={styles.changeItem}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} style={styles.changeIcon} />
                    <Text style={[styles.changeText, { color: colors.text }]}>{change}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  changelogRelease: { marginBottom: spacing.xxl },
  releaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  releaseVersion: { fontSize: 20, fontWeight: '700' },
  releaseDate: { fontSize: 14, fontWeight: '500' },
  changesList: {
    borderRadius: borderRadius.medium,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  changeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  changeIcon: { marginTop: 2 },
  changeText: { flex: 1, fontSize: 15, lineHeight: 22 },
});

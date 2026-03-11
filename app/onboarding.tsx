import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  FlatList,
  StatusBar,
  ViewToken,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { storageService } from '../services/storage';
import { spacing, borderRadius } from '../constants/spacing';

const { width, height } = Dimensions.get('window');

// ─── Mini UI mockup components ────────────────────────────────────────────────

function TorrentMockup() {
  return (
    <View style={mock.card}>
      <View style={mock.torrentRow}>
        <View style={[mock.stateDot, { backgroundColor: '#30D158' }]} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={mock.torrentName} numberOfLines={1}>Ubuntu 24.04 LTS Desktop.iso</Text>
          <View style={mock.progressTrack}>
            <View style={[mock.progressFill, { width: '72%', backgroundColor: '#0A84FF' }]} />
          </View>
          <View style={mock.torrentStats}>
            <Text style={mock.statText}>↓ 8.4 MB/s</Text>
            <Text style={mock.statText}>72%</Text>
            <Text style={mock.statText}>3.2 GB / 4.4 GB</Text>
          </View>
        </View>
      </View>
      <View style={[mock.separator, { marginVertical: 10 }]} />
      <View style={mock.torrentRow}>
        <View style={[mock.stateDot, { backgroundColor: '#FFD60A' }]} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={mock.torrentName} numberOfLines={1}>Arch Linux 2024.01 x86_64.iso</Text>
          <View style={mock.progressTrack}>
            <View style={[mock.progressFill, { width: '100%', backgroundColor: '#30D158' }]} />
          </View>
          <View style={mock.torrentStats}>
            <Text style={mock.statText}>↑ 2.1 MB/s</Text>
            <Text style={mock.statText}>Seeding</Text>
            <Text style={mock.statText}>Ratio 1.42</Text>
          </View>
        </View>
      </View>
      <View style={[mock.separator, { marginVertical: 10 }]} />
      <View style={mock.torrentRow}>
        <View style={[mock.stateDot, { backgroundColor: '#636366' }]} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={mock.torrentName} numberOfLines={1}>Fedora-Workstation-40-x86_64.iso</Text>
          <View style={mock.progressTrack}>
            <View style={[mock.progressFill, { width: '34%', backgroundColor: '#636366' }]} />
          </View>
          <View style={mock.torrentStats}>
            <Text style={mock.statText}>Paused</Text>
            <Text style={mock.statText}>34%</Text>
            <Text style={mock.statText}>1.6 GB / 4.7 GB</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function SpeedMockup() {
  const bars = [12, 22, 18, 35, 28, 42, 38, 55, 48, 62, 58, 70, 64, 58, 72];
  return (
    <View style={mock.card}>
      <View style={mock.speedHeader}>
        <View>
          <Text style={mock.speedLabel}>↓ Download</Text>
          <Text style={mock.speedValue}>8.4 MB/s</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={mock.speedLabel}>↑ Upload</Text>
          <Text style={[mock.speedValue, { color: '#30D158' }]}>2.1 MB/s</Text>
        </View>
      </View>
      <View style={mock.graphContainer}>
        {bars.map((h, i) => (
          <View
            key={i}
            style={[
              mock.bar,
              {
                height: h * 0.8,
                backgroundColor: i === bars.length - 1 ? '#0A84FF' : `rgba(10,132,255,${0.3 + (i / bars.length) * 0.5})`,
              },
            ]}
          />
        ))}
      </View>
      <View style={mock.separator} />
      <View style={mock.speedFooter}>
        <View style={mock.speedStat}>
          <Text style={mock.speedStatLabel}>Session DL</Text>
          <Text style={mock.speedStatVal}>14.2 GB</Text>
        </View>
        <View style={mock.speedStat}>
          <Text style={mock.speedStatLabel}>Active</Text>
          <Text style={mock.speedStatVal}>4 torrents</Text>
        </View>
        <View style={mock.speedStat}>
          <Text style={mock.speedStatLabel}>Disk Free</Text>
          <Text style={mock.speedStatVal}>412 GB</Text>
        </View>
      </View>
    </View>
  );
}

function ControlMockup() {
  return (
    <View style={mock.card}>
      <View style={mock.controlRow}>
        <TouchableOpacity style={[mock.actionBtn, { backgroundColor: 'rgba(10,132,255,0.15)' }]} activeOpacity={1}>
          <Ionicons name="play" size={16} color="#0A84FF" />
          <Text style={[mock.actionBtnText, { color: '#0A84FF' }]}>Resume All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[mock.actionBtn, { backgroundColor: 'rgba(255,214,10,0.15)' }]} activeOpacity={1}>
          <Ionicons name="pause" size={16} color="#FFD60A" />
          <Text style={[mock.actionBtnText, { color: '#FFD60A' }]}>Pause All</Text>
        </TouchableOpacity>
      </View>
      <View style={[mock.separator, { marginVertical: 12 }]} />
      <Text style={mock.mockLabel}>Global Speed Limits</Text>
      <View style={mock.limitRow}>
        <View style={mock.limitCard}>
          <Ionicons name="arrow-down" size={14} color="#0A84FF" />
          <Text style={mock.limitVal}>10 MB/s</Text>
          <Text style={mock.limitLabel}>Download</Text>
        </View>
        <View style={mock.limitCard}>
          <Ionicons name="arrow-up" size={14} color="#30D158" />
          <Text style={[mock.limitVal, { color: '#30D158' }]}>5 MB/s</Text>
          <Text style={mock.limitLabel}>Upload</Text>
        </View>
        <View style={[mock.limitCard, { backgroundColor: 'rgba(255,159,67,0.15)' }]}>
          <Ionicons name="moon" size={14} color="#FF9F43" />
          <Text style={[mock.limitVal, { color: '#FF9F43' }]}>Alt</Text>
          <Text style={mock.limitLabel}>Schedule</Text>
        </View>
      </View>
    </View>
  );
}

function OrganizeMockup() {
  const filters = ['All', 'Downloading', 'Seeding', 'Paused'];
  return (
    <View style={mock.card}>
      <View style={mock.filterRow}>
        {filters.map((f, i) => (
          <View
            key={f}
            style={[
              mock.filterChip,
              i === 0 && { backgroundColor: '#0A84FF' },
            ]}
          >
            <Text style={[mock.filterText, i === 0 && { color: '#fff' }]}>{f}</Text>
          </View>
        ))}
      </View>
      <View style={[mock.separator, { marginVertical: 10 }]} />
      {[
        { name: 'Ubuntu 24.04 LTS', cat: 'Linux', color: '#30D158', pct: '72%' },
        { name: 'Fedora Workstation 40', cat: 'Linux', color: '#0A84FF', pct: '100%' },
        { name: 'Debian 12 Bookworm', cat: 'Linux', color: '#636366', pct: '34%' },
      ].map((item) => (
        <View key={item.name} style={mock.orgRow}>
          <View style={[mock.stateDot, { backgroundColor: item.color }]} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={mock.torrentName} numberOfLines={1}>{item.name}</Text>
            <Text style={[mock.statText, { marginTop: 2 }]}>{item.cat}</Text>
          </View>
          <View style={mock.pctBadge}>
            <Text style={mock.pctText}>{item.pct}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Slide definitions ────────────────────────────────────────────────────────

interface Slide {
  id: string;
  accentColor: string;
  badgeIcon: string;
  badge: string;
  headline: string;
  sub: string;
  Mockup: React.ComponentType;
}

const SLIDES: Slide[] = [
  {
    id: 'welcome',
    accentColor: '#0A84FF',
    badgeIcon: 'layers',
    badge: 'qRemote',
    headline: 'Your qBittorrent,\nbeautifully remote.',
    sub: 'Full control of your server from anywhere. Fast, private, and always in sync.',
    Mockup: TorrentMockup,
  },
  {
    id: 'speed',
    accentColor: '#0A84FF',
    badgeIcon: 'speedometer',
    badge: 'Live Dashboard',
    headline: 'Real-time stats,\nalways updating.',
    sub: 'Watch speeds, session totals, disk space, and queued jobs — refreshed every second.',
    Mockup: SpeedMockup,
  },
  {
    id: 'control',
    accentColor: '#FF9F43',
    badgeIcon: 'flash',
    badge: 'Full Control',
    headline: 'One tap to pause,\nlimit, or force-start.',
    sub: 'Global speed limits, alternative schedules, bulk actions, and per-torrent controls.',
    Mockup: ControlMockup,
  },
  {
    id: 'organize',
    accentColor: '#30D158',
    badgeIcon: 'funnel',
    badge: 'Smart Filters',
    headline: 'Filter, sort, and\nfind in an instant.',
    sub: 'Categories, tags, state filters, and configurable sort orders keep your list clean.',
    Mockup: OrganizeMockup,
  },
];

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const dotScale = useRef(SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;

  const isLast = activeIndex === SLIDES.length - 1;

  const animateDots = useCallback((next: number) => {
    SLIDES.forEach((_, i) => {
      Animated.spring(dotScale[i], {
        toValue: i === next ? 1 : 0,
        useNativeDriver: true,
        tension: 80,
        friction: 8,
      }).start();
    });
  }, [dotScale]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      const idx = viewableItems[0].index;
      setActiveIndex(idx);
      animateDots(idx);
    }
  }).current;

  const goNext = () => {
    if (isLast) {
      handleComplete();
      return;
    }
    const next = activeIndex + 1;
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
  };

  const goSkip = () => handleComplete();

  const handleComplete = async () => {
    try {
      const prefs = await storageService.getPreferences();
      await storageService.savePreferences({ ...prefs, hasCompletedOnboarding: true });
    } catch {}
    router.replace('/(tabs)');
  };

  const accentColor = SLIDES[activeIndex]?.accentColor ?? '#0A84FF';

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={[styles.slide, { width }]}>
      {/* Mockup area */}
      <View style={styles.mockupArea}>
        <item.Mockup />
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Accent glow behind mockup */}
      <Animated.View
        style={[
          styles.glowBlob,
          { backgroundColor: accentColor, opacity: 0.12 },
        ]}
        pointerEvents="none"
      />

      {/* Skip button */}
      {!isLast && (
        <TouchableOpacity style={styles.skipBtn} onPress={goSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        style={styles.flatList}
      />

      {/* Bottom panel */}
      <View style={styles.panel}>
        {/* Badge */}
        <View style={[styles.badge, { backgroundColor: accentColor + '22', borderColor: accentColor + '44' }]}>
          <Ionicons name={SLIDES[activeIndex]?.badgeIcon as any} size={13} color={accentColor} />
          <Text style={[styles.badgeText, { color: accentColor }]}>{SLIDES[activeIndex]?.badge}</Text>
        </View>

        {/* Headline */}
        <Text style={styles.headline}>{SLIDES[activeIndex]?.headline}</Text>

        {/* Sub */}
        <Text style={styles.sub}>{SLIDES[activeIndex]?.sub}</Text>

        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const scaleX = dotScale[i].interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] });
            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    transform: [{ scaleX }],
                    backgroundColor: i === activeIndex ? accentColor : 'rgba(255,255,255,0.2)',
                  },
                ]}
              />
            );
          })}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: isLast ? accentColor : '#fff' }]}
          onPress={goNext}
          activeOpacity={0.85}
        >
          {isLast ? (
            <>
              <Ionicons name="server-outline" size={18} color="#fff" />
              <Text style={[styles.ctaText, { color: '#fff' }]}>Connect a Server</Text>
            </>
          ) : (
            <>
              <Text style={[styles.ctaText, { color: '#000' }]}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color="#000" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Mock component styles ─────────────────────────────────────────────────────

const mock = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(28,28,30,0.95)',
    borderRadius: borderRadius.large,
    padding: spacing.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    width: width - 64,
  },
  torrentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  torrentName: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 5,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  torrentStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
  },
  separator: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  // Speed mockup
  speedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  speedLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  speedValue: {
    color: '#0A84FF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  graphContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 48,
    gap: 3,
    marginBottom: 12,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 4,
  },
  speedFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  speedStat: {
    alignItems: 'center',
  },
  speedStatLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  speedStatVal: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  // Control mockup
  controlRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: borderRadius.medium,
    gap: 6,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  mockLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  limitRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  limitCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(10,132,255,0.1)',
    borderRadius: borderRadius.medium,
    paddingVertical: 10,
    gap: 3,
  },
  limitVal: {
    color: '#0A84FF',
    fontSize: 13,
    fontWeight: '700',
  },
  limitLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
  },
  // Organize mockup
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  filterText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '500',
  },
  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  pctBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pctText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '500',
  },
});

// ─── Screen styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  glowBlob: {
    position: 'absolute',
    top: -60,
    left: -60,
    width: width + 120,
    height: height * 0.6,
    borderRadius: width,
    zIndex: 0,
  },
  skipBtn: {
    position: 'absolute',
    top: 56,
    right: spacing.xl,
    zIndex: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  skipText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 15,
    fontWeight: '500',
  },
  flatList: {
    flex: 1,
    zIndex: 1,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  mockupArea: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  panel: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 48,
    paddingTop: spacing.xl,
    zIndex: 2,
    gap: spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  headline: {
    fontSize: 30,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  sub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 22,
    marginBottom: 4,
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    marginBottom: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: borderRadius.large,
    gap: 8,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { storageService } from '../services/storage';
import { spacing, borderRadius } from '../constants/spacing';

const { width, height } = Dimensions.get('window');

interface OnboardingSlide {
  icon: string;
  title: string;
  description: string;
  gradient: string[];
}

const slides: OnboardingSlide[] = [
  {
    icon: 'cloud-download',
    title: 'Welcome to qBitRemote',
    description: 'Control your qBittorrent server from anywhere. Fast, secure, and beautiful.',
    gradient: ['#667eea', '#764ba2'],
  },
  {
    icon: 'speedometer',
    title: 'Monitor & Control',
    description: 'Real-time speed monitoring, graphs, and intelligent notifications keep you informed.',
    gradient: ['#f093fb', '#f5576c'],
  },
  {
    icon: 'stats-chart',
    title: 'Powerful Management',
    description: 'Swipe actions, bulk operations, and smart filters for efficient torrent management.',
    gradient: ['#4facfe', '#00f2fe'],
  },
  {
    icon: 'rocket',
    title: 'Ready to Start',
    description: 'Connect to your qBittorrent server and take control of your downloads.',
    gradient: ['#43e97b', '#38f9d7'],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.5,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();

      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      scrollViewRef.current?.scrollTo({
        x: width * nextIndex,
        animated: true,
      });
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    try {
      // Mark onboarding as complete
      const prefs = await storageService.getPreferences();
      await storageService.savePreferences({
        ...prefs,
        hasCompletedOnboarding: true,
      });
      router.replace('/(tabs)');
    } catch (error) {
      router.replace('/(tabs)');
    }
  };

  const isLastSlide = currentIndex === slides.length - 1;

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={styles.scrollView}
      >
        {slides.map((slide, index) => (
          <View key={index} style={styles.slide}>
            <LinearGradient colors={slide.gradient} style={styles.gradientBackground}>
              <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                <View style={styles.iconContainer}>
                  <Ionicons name={slide.icon as any} size={80} color="#FFFFFF" />
                </View>

                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.description}>{slide.description}</Text>
              </Animated.View>
            </LinearGradient>
          </View>
        ))}
      </ScrollView>

      {/* Bottom Controls */}
      <View style={styles.bottomContainer}>
        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.dotActive,
                { backgroundColor: index === currentIndex ? '#FFFFFF' : 'rgba(255,255,255,0.4)' },
              ]}
            />
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          {!isLastSlide && (
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleNext}
            style={[styles.nextButton, { backgroundColor: '#FFFFFF' }]}
          >
            <Text style={[styles.nextText, { color: slides[currentIndex].gradient[0] }]}>
              {isLastSlide ? "Let's Go!" : 'Next'}
            </Text>
            {!isLastSlide && <Ionicons name="arrow-forward" size={20} color={slides[currentIndex].gradient[0]} />}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width,
    height,
  },
  gradientBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  content: {
    alignItems: 'center',
    marginTop: -100,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
    opacity: 0.9,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    gap: spacing.xxl,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.large,
    gap: spacing.sm,
  },
  nextText: {
    fontSize: 16,
    fontWeight: '700',
  },
});



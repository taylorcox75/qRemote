import React from 'react';
import { useIsFocused } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

interface FocusAwareStatusBarProps {
  barStyle: 'light-content' | 'dark-content' | 'default';
}

export function FocusAwareStatusBar({ barStyle }: FocusAwareStatusBarProps) {
  const isFocused = useIsFocused();

  if (!isFocused) {
    return null;
  }

  // expo-status-bar automatically adjusts based on background color
  // style="light" = light content (white text) for dark backgrounds
  // style="dark" = dark content (black text) for light backgrounds
  return <StatusBar style={barStyle === 'light-content' ? 'light' : 'dark'} />;
}


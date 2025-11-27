/**
 * ResponsiveContainer Component
 * Provides responsive layout wrapper for web and mobile
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';
import { MAX_CONTENT_WIDTH, isWeb } from '../utils/platform';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  maxWidth?: number;
  centered?: boolean;
  padding?: number | { horizontal?: number; vertical?: number };
}

export default function ResponsiveContainer({
  children,
  style,
  maxWidth = MAX_CONTENT_WIDTH,
  centered = true,
  padding,
}: ResponsiveContainerProps) {
  const { isWeb, width, contentWidth } = useResponsive();

  const containerStyle: ViewStyle = {
    width: '100%',
    ...(isWeb && centered && {
      alignSelf: 'center',
      maxWidth: typeof contentWidth === 'number' 
        ? Math.min(contentWidth, maxWidth) 
        : maxWidth,
    }),
    ...(padding && typeof padding === 'number'
      ? { paddingHorizontal: padding, paddingVertical: padding }
      : padding
      ? {
          paddingHorizontal: padding.horizontal,
          paddingVertical: padding.vertical,
        }
      : {}),
    ...style,
  };

  return <View style={containerStyle}>{children}</View>;
}


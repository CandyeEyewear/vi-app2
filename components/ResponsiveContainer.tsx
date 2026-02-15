/**
 * ResponsiveContainer Component
 * Provides responsive layout wrapper for web and mobile
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';
import { MAX_CONTENT_WIDTH, isWeb } from '../utils/platform';
import { normalizeViewChildren } from '../utils/normalizeViewChildren';

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
  const paddingObject = typeof padding === 'object' && padding !== null ? padding : undefined;

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
      : paddingObject
      ? {
          paddingHorizontal: paddingObject.horizontal,
          paddingVertical: paddingObject.vertical,
        }
      : {}),
    ...style,
  };

  return <View style={containerStyle}>{normalizeViewChildren(children)}</View>;
}


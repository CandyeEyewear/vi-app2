/**
 * WebLayout Component
 * Provides web-optimized layout with sidebar support
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, useColorScheme } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';
import { Colors } from '../constants/colors';
import ResponsiveContainer from './ResponsiveContainer';
import { normalizeViewChildren } from '../utils/normalizeViewChildren';

interface WebLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export default function WebLayout({
  children,
  sidebar,
  style,
  contentStyle,
}: WebLayoutProps) {
  const { isWeb, showSidebar, width } = useResponsive();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  if (!isWeb) {
    return <View style={style}>{normalizeViewChildren(children)}</View>;
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.mainContent}>
        <ResponsiveContainer style={contentStyle}>
          {normalizeViewChildren(children)}
        </ResponsiveContainer>
      </View>
      {showSidebar && sidebar && (
        <View style={[styles.sidebar, { borderLeftColor: colors.border, backgroundColor: colors.card }]}>
          {normalizeViewChildren(sidebar)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flex: 1,
    width: '100%',
  },
  mainContent: {
    flex: 1,
    minWidth: 0, // Prevents overflow
  },
  sidebar: {
    width: 280,
    borderLeftWidth: 1,
  },
});


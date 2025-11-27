/**
 * WebLayout Component
 * Provides web-optimized layout with sidebar support
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';
import ResponsiveContainer from './ResponsiveContainer';

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

  if (!isWeb) {
    return <View style={style}>{children}</View>;
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.mainContent}>
        <ResponsiveContainer style={contentStyle}>
          {children}
        </ResponsiveContainer>
      </View>
      {showSidebar && sidebar && (
        <View style={styles.sidebar}>
          {sidebar}
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
    borderLeftColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
});


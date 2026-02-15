/**
 * WebContainer Component
 * Constrains content to optimal reading width on desktop web
 * No effect on mobile - only applies to web with screen >= 992px
 */

import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { normalizeViewChildren } from '../utils/normalizeViewChildren';

interface WebContainerProps {
  children: React.ReactNode;
  maxWidth?: number;
}

export default function WebContainer({ children, maxWidth = 680 }: WebContainerProps) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 992;

  if (!isDesktop) {
    // On mobile, just render children without wrapper
    return <>{children}</>;
  }

  return (
    <View style={styles.outerContainer}>
      <View style={[styles.innerContainer, { maxWidth }]}>
        {normalizeViewChildren(children)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  innerContainer: {
    flex: 1,
    width: '100%',
  },
});

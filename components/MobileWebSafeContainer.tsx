/**
 * Container component that uses the real visible viewport height on mobile web
 * Prevents content from being cut off by browser UI elements
 */

import React, { ReactNode } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useMobileWebViewport } from '../hooks/useMobileWebViewport';
import { normalizeViewChildren } from '../utils/normalizeViewChildren';

interface MobileWebSafeContainerProps {
  children: ReactNode;
  style?: any;
}

export function MobileWebSafeContainer({ children, style }: MobileWebSafeContainerProps) {
  const { height } = useMobileWebViewport();

  // On native, just use flex: 1
  if (Platform.OS !== 'web') {
    return <View style={[styles.container, style]}>{normalizeViewChildren(children)}</View>;
  }

  // On web, only apply fixed height when we have a valid viewport height
  // Otherwise fall back to flex: 1 behavior
  const hasValidHeight = height && height > 0;

  return (
    <View
      style={[
        styles.container,
        hasValidHeight && {
          height: height,
          minHeight: height,
          maxHeight: height,
        },
        style,
      ]}
    >
      {normalizeViewChildren(children)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
});

export default MobileWebSafeContainer;

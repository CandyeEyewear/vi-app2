/**
 * Container component that uses the real visible viewport height on mobile web
 * Prevents content from being cut off by browser UI elements
 */

import React, { ReactNode } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useMobileWebViewport } from '../hooks/useMobileWebViewport';

interface MobileWebSafeContainerProps {
  children: ReactNode;
  style?: any;
}

export function MobileWebSafeContainer({ children, style }: MobileWebSafeContainerProps) {
  const { height } = useMobileWebViewport();

  // On native, just use flex: 1
  if (Platform.OS !== 'web') {
    return <View style={[styles.container, style]}>{children}</View>;
  }

  // On web, use the real viewport height
  return (
    <View
      style={[
        styles.container,
        {
          height: height || '100%',
          minHeight: height || '100%',
          maxHeight: height || '100%',
        },
        style,
      ]}
    >
      {children}
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

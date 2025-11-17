/**
 * Network Status Banner
 * Shows an offline indicator when the device is offline
 */

import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useNetwork } from '../contexts/NetworkContext';
import { Colors } from '../constants/colors';
import { WifiOff } from 'lucide-react-native';

export default function NetworkStatusBanner() {
  const { isOffline } = useNetwork();
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOffline ? 0 : -100,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline, slideAnim]);

  if (!isOffline) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <WifiOff size={16} color="#FFFFFF" />
      <Text style={styles.text}>No Internet Connection</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.light.error,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 9999,
    elevation: 5,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});


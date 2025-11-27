/**
 * Online Status Dot Component  
 * Shows blue dot when user is online (matches app theme)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

interface OnlineStatusDotProps {
  isOnline: boolean;
  size?: number;
  style?: any;
}

export default function OnlineStatusDot({ 
  isOnline, 
  size = 12,
  style 
}: OnlineStatusDotProps) {
  if (!isOnline) return null;

  return (
    <View style={[styles.container, style]}>
      <View 
        style={[
          styles.dot, 
          { 
            width: size, 
            height: size, 
            borderRadius: size / 2,
            backgroundColor: Colors.light.primary, // Blue like app theme
          }
        ]} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 2,
  },
  dot: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});

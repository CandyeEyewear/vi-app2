// components/Skeleton.tsx
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, useColorScheme } from 'react-native';
import { Colors } from '../constants/colors';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: any;
  variant?: 'default' | 'circle' | 'text';
}

export default function Skeleton({ 
  width = '100%', 
  height = 20, 
  borderRadius = 4, 
  style,
  variant = 'default' 
}: SkeletonProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const animatedValue = useRef(new Animated.Value(0)).current;

  // Shimmer animation
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  // Auto-set dimensions for variants
  const finalWidth = variant === 'circle' ? height : width;
  const finalBorderRadius = variant === 'circle' ? (typeof height === 'number' ? height / 2 : 50) : 
                            variant === 'text' ? 4 : borderRadius;

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: finalWidth,
          height,
          borderRadius: finalBorderRadius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
});
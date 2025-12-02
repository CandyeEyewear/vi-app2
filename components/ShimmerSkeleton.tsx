import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle, useColorScheme } from 'react-native';
import { Colors, ThemeColors } from '../constants/colors';

interface Props {
  style?: ViewStyle | ViewStyle[];
  colors?: ThemeColors;
}

export function ShimmerSkeleton({ style, colors }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = colors || Colors[colorScheme];
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          backgroundColor: theme.skeleton,
          opacity,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    width: '100%',
    height: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
});

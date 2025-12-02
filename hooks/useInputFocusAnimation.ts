import { useMemo, useRef } from 'react';
import { Animated } from 'react-native';
import { ThemeColors } from '../constants/colors';

export const useInputFocusAnimation = (colors: ThemeColors) => {
  const focusAnim = useRef(new Animated.Value(0)).current;

  const animate = (toValue: number) => {
    Animated.timing(focusAnim, {
      toValue,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = Animated.interpolateColor(focusAnim, {
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  const iconColor = Animated.interpolateColor(focusAnim, {
    inputRange: [0, 1],
    outputRange: [colors.textSecondary, colors.primary],
  });

  const animatedBorderStyle = useMemo(
    () => ({
      borderColor,
      borderWidth: focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 2],
      }),
    }),
    [borderColor, focusAnim, colors.primary]
  );

  return {
    animatedBorderStyle,
    iconColor,
    onFocus: () => animate(1),
    onBlur: () => animate(0),
  } as const;
};

import { useRef } from 'react';
import { Animated } from 'react-native';

interface Options {
  pressedScale?: number;
  disabled?: boolean;
}

export const usePressScaleAnimation = ({ pressedScale = 0.95, disabled = false }: Options = {}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: pressedScale,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 3,
    }).start();
  };

  return {
    scaleAnim,
    animatedStyle: { transform: [{ scale: scaleAnim }] },
    handlePressIn,
    handlePressOut,
  } as const;
};

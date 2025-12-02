import React from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { usePressScaleAnimation } from '../hooks/usePressScaleAnimation';

interface AnimatedPressableProps extends PressableProps {
  containerStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
}

export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  children,
  containerStyle,
  scaleTo = 0.95,
  style,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}) => {
  const { animatedStyle, handlePressIn, handlePressOut } = usePressScaleAnimation({
    pressedScale: scaleTo,
    disabled,
  });

  const composedStyle: PressableProps['style'] = (state) => {
    if (typeof style === 'function') {
      return style(state);
    }
    return [style, state.pressed && { opacity: 0.9 }];
  };

  return (
    <Animated.View style={[animatedStyle, containerStyle]}>
      <Pressable
        {...rest}
        disabled={disabled}
        onPressIn={(event) => {
          handlePressIn();
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          handlePressOut();
          onPressOut?.(event);
        }}
        style={composedStyle}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

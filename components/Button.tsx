import React from 'react';
import { Text, ActivityIndicator, StyleSheet, StyleProp, ViewStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable } from './AnimatedPressable';
import { useThemeStyles } from '../hooks/useThemeStyles';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'lg' | 'md';
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  onPress,
  style,
  icon,
  ...props
}: ButtonProps) {
  const { colors, responsive } = useThemeStyles();

  const textColor =
    variant === 'primary' ? colors.textOnPrimary : variant === 'outline' ? colors.text : colors.text;

  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon && <View>{icon}</View>}
          <Text
            style={[
              styles.text,
              {
                color: textColor,
                fontSize: size === 'lg' ? responsive.fontSize.lg : responsive.fontSize.md,
              },
            ]}
          >
            {children}
          </Text>
        </>
      )}
    </>
  );

  if (variant === 'primary') {
    return (
      <AnimatedPressable
        onPress={onPress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.button,
          {
            opacity: pressed ? 0.9 : 1,
            borderRadius: 14,
          },
          size === 'lg' && { height: responsive.buttonHeight },
          style,
        ]}
        {...props}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          style={[
            styles.gradient,
            {
              borderRadius: 14,
              paddingHorizontal: responsive.spacing.xl,
              height: size === 'lg' ? responsive.buttonHeight : responsive.buttonHeight - 4,
            },
          ]}
        >
          {content}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          borderRadius: 14,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          borderColor: colors.border,
          backgroundColor: variant === 'ghost' ? 'transparent' : colors.surfaceElevated,
          opacity: pressed ? 0.9 : 1,
          paddingHorizontal: responsive.spacing.xl,
          height: size === 'lg' ? responsive.buttonHeight : responsive.buttonHeight - 4,
        },
        style,
      ]}
      {...props}
    >
      {content}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  gradient: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  text: {
    fontWeight: '600',
    textTransform: 'none',
    letterSpacing: 0.3,
  },
});

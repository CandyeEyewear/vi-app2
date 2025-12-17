import React from 'react';
import { Text, ActivityIndicator, StyleSheet, StyleProp, ViewStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable } from './AnimatedPressable';
import { useThemeStyles } from '../hooks/useThemeStyles';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive';
  size?: 'lg' | 'md';
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
  /**
   * Override the text/spinner color (useful for non-standard backgrounds like warning/yellow).
   */
  textColorOverride?: string;
  /**
   * Override gradient colors for the primary variant.
   */
  gradientColors?: [string, string];
  /**
   * Optional label to show while loading. If omitted, we'll try to reuse children when it's a string.
   */
  loadingText?: string;
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
  textColorOverride,
  gradientColors,
  loadingText,
  ...props
}: ButtonProps) {
  const { colors, responsive, buttonShadow } = useThemeStyles();

  const textColor =
    textColorOverride ??
    ((variant === 'primary' || variant === 'destructive')
      ? colors.textOnPrimary
      : colors.text);

  const resolvedLoadingText =
    loadingText ?? (typeof children === 'string' ? children : undefined);

  const content = (
    <>
      {icon && !loading && <View>{icon}</View>}
      {loading && <ActivityIndicator color={textColor} />}
      <Text
        style={[
          styles.text,
          {
            color: textColor,
            fontSize: size === 'lg' ? responsive.fontSize.lg : responsive.fontSize.md,
            opacity: disabled || loading ? 0.9 : 1,
          },
        ]}
      >
        {loading ? resolvedLoadingText ?? children : children}
      </Text>
    </>
  );

  if (variant === 'primary') {
    return (
      <AnimatedPressable
        onPress={onPress}
        disabled={disabled || loading}
        containerStyle={[
          styles.raisedContainer,
          buttonShadow,
          (disabled || loading) && styles.disabledShadow,
        ]}
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
          colors={gradientColors ?? [colors.primary, colors.primaryDark]}
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

  if (variant === 'destructive') {
    return (
      <AnimatedPressable
        onPress={onPress}
        disabled={disabled || loading}
        containerStyle={[
          styles.raisedContainer,
          buttonShadow,
          (disabled || loading) && styles.disabledShadow,
        ]}
        style={({ pressed }) => [
          styles.button,
          {
            borderRadius: 14,
            backgroundColor: colors.danger || '#DC2626',
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
  raisedContainer: {
    borderRadius: 14,
  },
  disabledShadow: {
    // On iOS, shadows remain visible even if opacity changes; reduce it explicitly.
    shadowOpacity: 0,
    elevation: 0,
  },
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

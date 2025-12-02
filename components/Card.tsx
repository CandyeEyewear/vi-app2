import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useThemeStyles } from '../hooks/useThemeStyles';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  elevated?: boolean;
}

export default function Card({ children, style, padding, elevated = true, ...props }: CardProps) {
  const { colors, cardShadow, responsive } = useThemeStyles();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          padding: padding ?? responsive.spacing.lg,
          borderColor: colors.cardBorder || colors.border,
        },
        elevated && cardShadow,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
  },
});

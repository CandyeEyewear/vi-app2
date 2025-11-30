import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle, StyleSheet } from 'react-native';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'outline';
  size?: 'lg' | 'md';
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
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
  const backgroundColor = variant === 'primary' ? '#38B6FF' : 'transparent';
  const textColor = variant === 'primary' ? 'white' : '#38B6FF';
  const borderColor = variant === 'outline' ? '#38B6FF' : 'transparent';
  
  return (
    <TouchableOpacity 
      style={[
        styles.button, 
        { backgroundColor, borderColor, borderWidth: variant === 'outline' ? 2 : 0 },
        size === 'lg' && styles.buttonLg,
        style
      ]} 
      onPress={onPress}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: textColor }]}>{children}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonLg: {
    padding: 16,
  },
  text: {
    fontWeight: '600',
    fontSize: 16,
  },
});

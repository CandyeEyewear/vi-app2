import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';

interface VerifiedBadgeProps {
  type: 'premium' | 'admin';
  size?: number;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ type, size = 16 }) => {
  const backgroundColor = type === 'admin' ? '#000000' : '#38B6FF';
  
  return (
    <View 
      style={[
        styles.container, 
        { 
          width: size, 
          height: size, 
          borderRadius: size / 2,
          backgroundColor,
        }
      ]}
    >
      <Check 
        size={size * 0.65} 
        color="#FFFFFF"
        strokeWidth={3}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
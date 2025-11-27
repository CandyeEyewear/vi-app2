import React from 'react';
import { View, Text, StyleSheet, TextStyle } from 'react-native';
import { VerifiedBadge } from './VerifiedBadge';

interface UserNameWithBadgeProps {
  name: string;
  role: string;
  membershipTier: string;
  membershipStatus?: string;
  style?: TextStyle;
  badgeSize?: number;
}

export const UserNameWithBadge: React.FC<UserNameWithBadgeProps> = ({
  name,
  role,
  membershipTier,
  membershipStatus = 'inactive',
  style,
  badgeSize = 16,
}) => {
  // Determine badge type based on user type
  const isAdmin = role === 'admin';
  const isPremium = membershipTier === 'premium' && membershipStatus === 'active';
  
  let badgeType: 'premium' | 'admin' | null = null;
  
  if (isAdmin) {
    badgeType = 'admin';
  } else if (isPremium) {
    badgeType = 'premium';
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.name, style]}>{name}</Text>
      {badgeType && <VerifiedBadge type={badgeType} size={badgeSize} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 14,
    fontWeight: '500',
  },
});
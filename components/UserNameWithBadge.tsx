/**
 * UserNameWithBadge Component
 * Displays user name with verification tick and/or admin badge
 * 
 * Badge indicators:
 * - Blue checkmark: Premium/verified members
 * - Gold "Admin" badge: Admin users
 */

import React from 'react';
import { View, Text, StyleSheet, useColorScheme, TextStyle, ViewStyle } from 'react-native';
import { CheckCircle, Shield } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { 
  UserRole, 
  MembershipStatus,
  MembershipTier,
  isPremiumMember, 
  isAdminUser,
  shouldShowVerifiedTick 
} from '../types/userStatus';

export interface UserNameWithBadgeProps {
  // Required (accept both name and fullName for compatibility)
  fullName?: string;
  name?: string; // Legacy prop name
  
  // Status - pull these from user object
  role?: UserRole | string;
  membershipTier?: MembershipTier | string;
  membershipStatus?: MembershipStatus | string;
  
  // Legacy support
  isAdmin?: boolean;
  isPremiumMember?: boolean;
  isVerified?: boolean;
  
  // Display options
  showAdminBadge?: boolean;
  showVerifiedTick?: boolean;
  
  // Typography
  fontSize?: number;
  fontWeight?: 'normal' | '500' | '600' | '700' | 'bold';
  color?: string;
  numberOfLines?: number;
  
  // Style
  style?: ViewStyle;
  nameStyle?: TextStyle;
}

export default function UserNameWithBadge({
  fullName,
  name, // Legacy prop
  role,
  membershipTier,
  membershipStatus,
  isAdmin: isAdminProp,
  isPremiumMember: isPremiumProp,
  isVerified: isVerifiedProp,
  showAdminBadge = true,
  showVerifiedTick = true,
  fontSize = 16,
  fontWeight = '600',
  color,
  numberOfLines = 1,
  style,
  nameStyle,
}: UserNameWithBadgeProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  
  // Support both name and fullName props
  const displayName = fullName || name || 'User';
  
  // Determine status from props (support both new and legacy props)
  const userIsAdmin = isAdminProp ?? isAdminUser(role as UserRole);
  const userIsPremium = isPremiumProp ?? isPremiumMember(
    membershipTier as MembershipTier,
    membershipStatus as MembershipStatus
  );
  const userIsVerified = isVerifiedProp ?? shouldShowVerifiedTick(
    membershipTier as MembershipTier,
    membershipStatus as MembershipStatus
  );
  
  const textColor = color || colors.text;
  const shouldShowTick = showVerifiedTick && (userIsVerified || userIsPremium);
  const shouldShowAdmin = showAdminBadge && userIsAdmin;
  
  // Icon size proportional to font
  const iconSize = Math.round(fontSize * 0.85);
  
  return (
    <View style={[styles.container, style]}>
      <Text
        style={[
          styles.name,
          { fontSize, fontWeight, color: textColor },
          nameStyle,
        ]}
        numberOfLines={numberOfLines}
      >
        {displayName}
      </Text>
      
      {shouldShowTick && (
        <CheckCircle
          size={iconSize}
          color={colors.primary}
          fill={colors.primary}
          strokeWidth={0}
          style={styles.tickIcon}
        />
      )}
      
      {shouldShowAdmin && (
        <View style={[styles.adminBadge, { backgroundColor: '#FFD700' }]}>
          <Shield size={10} color="#000000" />
          <Text style={styles.adminText}>Admin</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  name: {
    flexShrink: 1,
  },
  tickIcon: {
    marginLeft: 4,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  adminText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000000',
  },
});

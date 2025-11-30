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
import { Check } from 'lucide-react-native';
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
  isPartnerOrganization?: boolean;  // NEW - For partner organizations
  
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
  isPartnerOrganization,  // NEW - Add this line
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
  
  // Show tick for admin, partner orgs, or premium (non-admin)
  // Admin gets black tick, partner orgs get golden tick, premium gets blue tick
  const shouldShowTick = showVerifiedTick && (userIsAdmin || isPartnerOrganization || (userIsPremium && !userIsAdmin));
  const isAdminTick = userIsAdmin; // Black tick for admin
  const isPartnerTick = isPartnerOrganization && !userIsAdmin; // Golden tick for partner orgs
  const isPremiumTick = userIsPremium && !userIsAdmin && !isPartnerOrganization; // Blue tick for premium
  
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
        <View
          style={[
            styles.tickContainer,
            {
              width: iconSize,
              height: iconSize,
              borderRadius: iconSize / 2,
              backgroundColor: isAdminTick ? '#000000' : isPartnerTick ? '#FFC107' : colors.primary,
            },
          ]}
        >
          <Check
            size={iconSize * 0.6}
            color="#FFFFFF"
            strokeWidth={3}
          />
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
  tickContainer: {
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

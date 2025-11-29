/**
 * UserAvatar Component
 * Centralized avatar display with membership/admin status styling
 * 
 * Status indicators:
 * - Gold ring: Admin users
 * - Blue ring: Premium members (active membership)
 * - No ring: Regular users
 */

import React from 'react';
import { View, Image, Text, StyleSheet, useColorScheme, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';
import { 
  UserRole, 
  MembershipStatus, 
  MembershipTier,
  isPremiumMember, 
  isAdminUser 
} from '../types/userStatus';

export interface UserAvatarProps {
  // Required
  avatarUrl?: string | null;
  fullName: string;
  
  // Status - pull these from user object
  role?: UserRole | string;
  membershipTier?: MembershipTier | string;
  membershipStatus?: MembershipStatus | string;
  
  // Legacy support - if using old field names
  isAdmin?: boolean;
  isPremiumMember?: boolean;
  isVerified?: boolean;
  
  // Display options
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  showRing?: boolean;
  
  // Style
  style?: ViewStyle;
}

// Size configurations
const SIZES = {
  xs: { container: 24, fontSize: 10, ringWidth: 2, ringGap: 2 },
  sm: { container: 32, fontSize: 12, ringWidth: 2, ringGap: 2 },
  md: { container: 40, fontSize: 16, ringWidth: 2, ringGap: 2 },
  lg: { container: 56, fontSize: 20, ringWidth: 3, ringGap: 2 },
  xl: { container: 80, fontSize: 28, ringWidth: 3, ringGap: 3 },
};

// Ring colors
const RING_COLORS = {
  admin: '#FFD700',      // Gold for admin
  premium: '#2196F3',    // Blue for premium (your brand color)
  none: 'transparent',
};

export default function UserAvatar({
  avatarUrl,
  fullName,
  role,
  membershipTier,
  membershipStatus,
  isAdmin: isAdminProp,
  isPremiumMember: isPremiumProp,
  isVerified,
  size = 'md',
  showRing = true,
  style,
}: UserAvatarProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  
  // Handle numeric size
  const isNumericSize = typeof size === 'number';
  const sizeConfig = isNumericSize 
    ? { 
        container: size, 
        fontSize: size * 0.4, 
        ringWidth: size >= 56 ? 3 : 2, 
        ringGap: size >= 56 ? 3 : 2 
      }
    : SIZES[size];
  
  // Determine status from props (support both new and legacy props)
  const userIsAdmin = isAdminProp ?? isAdminUser(role as UserRole);
  const userIsPremium = isPremiumProp ?? isPremiumMember(
    membershipTier as MembershipTier, 
    membershipStatus as MembershipStatus
  ) ?? isVerified;
  
  // Determine ring color based on status hierarchy
  const getRingColor = (): string => {
    if (!showRing) return RING_COLORS.none;
    if (userIsAdmin) return RING_COLORS.admin;
    if (userIsPremium) return RING_COLORS.premium;
    return RING_COLORS.none;
  };
  
  const ringColor = getRingColor();
  const hasRing = ringColor !== RING_COLORS.none;
  
  // Calculate dimensions
  const totalSize = hasRing 
    ? sizeConfig.container + (sizeConfig.ringWidth + sizeConfig.ringGap) * 2
    : sizeConfig.container;
  
  const avatarSize = sizeConfig.container;
  
  // Get initials for placeholder
  const initials = getInitials(fullName);
  
  return (
    <View
      style={[
        styles.container,
        {
          width: totalSize,
          height: totalSize,
          borderRadius: totalSize / 2,
          borderWidth: hasRing ? sizeConfig.ringWidth : 0,
          borderColor: ringColor,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.avatarContainer,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
          },
        ]}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={[
              styles.avatar,
              {
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
              },
            ]}
          />
        ) : (
          <View
            style={[
              styles.placeholder,
              {
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
                backgroundColor: colors.primary,
              },
            ]}
          >
            <Text style={[styles.initials, { fontSize: sizeConfig.fontSize }]}>
              {initials}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarContainer: {
    overflow: 'hidden',
  },
  avatar: {
    resizeMode: 'cover',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});


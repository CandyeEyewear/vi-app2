/**
 * WebNavigation Component
 * Desktop horizontal navigation bar for web views (width >= 992px)
 * Replaces hamburger menu with persistent navbar like Facebook/LinkedIn
 * File: components/WebNavigation.tsx
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  useColorScheme,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, MessageCircle, Compass, User, Settings, LogOut, Edit3, ChevronDown, Bell } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { useMessaging } from '../contexts/MessagingContext';
import { useAuth } from '../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserAvatar from './UserAvatar';

const NAV_ITEMS = [
  { path: '/(tabs)/feed', segment: '/feed', label: 'Feed', icon: Home },
  { path: '/(tabs)/messages', segment: '/messages', label: 'Messages', icon: MessageCircle },
  { path: '/(tabs)/discover', segment: '/discover', label: 'Discover', icon: Compass },
  { path: '/(tabs)/profile', segment: '/profile', label: 'Profile', icon: User },
];

export default function WebNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { totalUnreadCount } = useMessaging();
  const { user, signOut } = useAuth();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  // Dropdown is closed via a transparent backdrop Pressable (see render)

  const isActive = (segment: string) => {
    return pathname === segment || pathname.startsWith(segment + '/');
  };

  const handleNavigation = (path: string) => {
    router.push(path as any);
  };

  const handleDropdownAction = (action: string) => {
    // Navigate first, then close dropdown — closing first can interrupt the press handler
    switch (action) {
      case 'settings':
        router.push('/settings' as any);
        break;
      case 'edit-profile':
        router.push('/edit-profile' as any);
        break;
      case 'signout':
        signOut();
        break;
    }
    setDropdownOpen(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <View style={styles.headerBar}>
        <View style={styles.headerContent}>
          {/* Left: Logo */}
          <Pressable
            onPress={() => handleNavigation('/(tabs)/feed')}
            style={({ hovered }: any) => [
              styles.logoContainer,
              hovered && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.logo, { color: colors.tint }]}>VIbe</Text>
          </Pressable>

          {/* Center: Nav Items */}
          <View style={styles.navItems}>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.segment);
              const hasBadge = item.label === 'Messages' && totalUnreadCount > 0;

              return (
                <Pressable
                  key={item.path}
                  onPress={() => handleNavigation(item.path)}
                  style={({ hovered }: any) => [
                    styles.navItem,
                    active && styles.navItemActive,
                    active && { borderBottomColor: colors.tint },
                    hovered && !active && { backgroundColor: colors.highlight || 'rgba(0,0,0,0.04)' },
                  ]}
                >
                  <View style={styles.navItemInner}>
                    <View>
                      <Icon
                        size={20}
                        color={active ? colors.tint : colors.tabIconDefault}
                      />
                      {hasBadge && (
                        <View style={[styles.badge, { backgroundColor: colors.error || '#EF4444' }]}>
                          <Text style={styles.badgeText}>
                            {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.navItemLabel,
                        { color: active ? colors.tint : colors.tabIconDefault },
                        active && styles.navItemLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Notifications */}
          <Pressable
            onPress={() => handleNavigation('/notifications')}
            style={({ hovered }: any) => [
              styles.iconButton,
              hovered && { backgroundColor: colors.highlight || 'rgba(0,0,0,0.04)' },
            ]}
          >
            <Bell size={20} color={colors.textSecondary || colors.tabIconDefault} />
          </Pressable>

          {/* Right: User Avatar Dropdown */}
          <View style={styles.userSection}>
            <Pressable
              onPress={() => setDropdownOpen(!dropdownOpen)}
              style={({ hovered }: any) => [
                styles.avatarButton,
                hovered && { backgroundColor: colors.highlight || 'rgba(0,0,0,0.04)' },
              ]}
            >
              <UserAvatar
                avatarUrl={user?.avatarUrl}
                fullName={user?.fullName || 'User'}
                role={user?.role}
                membershipTier={user?.membershipTier}
                membershipStatus={user?.membershipStatus}
                isPartnerOrganization={user?.is_partner_organization}
                size="sm"
                showRing={false}
              />
              <ChevronDown
                size={14}
                color={colors.textSecondary || colors.tabIconDefault}
                style={{ marginLeft: 4 }}
              />
            </Pressable>

            {/* Dropdown Menu */}
            {/* Invisible backdrop to catch clicks outside dropdown */}
            {dropdownOpen && (
              <Pressable
                style={styles.dropdownBackdrop}
                onPress={() => setDropdownOpen(false)}
              />
            )}
            {dropdownOpen && (
              <View
                style={[
                  styles.dropdown,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    ...(Platform.OS === 'web' ? {
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.15,
                      shadowRadius: 12,
                    } : {}),
                  },
                ]}
              >
                {/* User info header */}
                <View style={[styles.dropdownHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.dropdownName, { color: colors.text }]} numberOfLines={1}>
                    {user?.fullName || 'User'}
                  </Text>
                  <Text style={[styles.dropdownEmail, { color: colors.textSecondary || '#888' }]} numberOfLines={1}>
                    {user?.email || ''}
                  </Text>
                </View>

                <DropdownItem
                  icon={Edit3}
                  label="Edit Profile"
                  onPress={() => handleDropdownAction('edit-profile')}
                  colors={colors}
                />
                <DropdownItem
                  icon={Settings}
                  label="Settings"
                  onPress={() => handleDropdownAction('settings')}
                  colors={colors}
                />

                <View style={[styles.dropdownDivider, { backgroundColor: colors.border }]} />

                <DropdownItem
                  icon={LogOut}
                  label="Sign Out"
                  onPress={() => handleDropdownAction('signout')}
                  colors={colors}
                  danger
                />
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

function DropdownItem({
  icon: Icon,
  label,
  onPress,
  colors,
  danger,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  colors: any;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: any) => [
        styles.dropdownItem,
        hovered && { backgroundColor: colors.highlight || 'rgba(0,0,0,0.04)' },
      ]}
    >
      <Icon size={16} color={danger ? (colors.error || '#EF4444') : (colors.textSecondary || '#888')} />
      <Text
        style={[
          styles.dropdownItemLabel,
          { color: danger ? (colors.error || '#EF4444') : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    borderBottomWidth: 1,
  },
  headerBar: {
    width: '100%',
    height: 64,
    justifyContent: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    height: '100%',
  },

  // Logo
  logoContainer: {
    marginRight: 32,
  },
  logo: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Nav Items
  navItems: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    height: '100%',
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    height: '100%',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    borderRadius: 0,
  },
  navItemActive: {
    borderBottomWidth: 3,
  },
  navItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navItemLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  navItemLabelActive: {
    fontWeight: '600',
  },

  // Badge
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },

  // Icon Buttons (notifications, etc.)
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // User Section
  userSection: {
    marginLeft: 8,
    position: 'relative' as any,
  },
  avatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 20,
  },

  // Dropdown
  dropdownBackdrop: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1001,
  },
  dropdown: {
    position: 'absolute' as any,
    top: 48,
    right: 0,
    minWidth: 220,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 1002,
  },
  dropdownHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  dropdownName: {
    fontSize: 15,
    fontWeight: '600',
  },
  dropdownEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownDivider: {
    height: 1,
    marginHorizontal: 12,
  },
});

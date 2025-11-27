/**
 * WebNavigation Component
 * Desktop hamburger menu navigation for web views (width >= 992px)
 * File: components/WebNavigation.tsx
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Animated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Menu, X, Home, MessageCircle, Compass, User } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { useMessaging } from '../contexts/MessagingContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WebNavigation() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { totalUnreadCount } = useMessaging();
  
  const [menuOpen, setMenuOpen] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-300)); // Start off-screen

  const toggleMenu = () => {
    if (menuOpen) {
      // Close menu
      Animated.timing(slideAnim, {
        toValue: -300,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setMenuOpen(false));
    } else {
      // Open menu
      setMenuOpen(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleNavigation = (path: string) => {
    router.push(path as any);
    toggleMenu(); // Close menu after navigation
  };

  const menuItems = [
    { 
      path: '/(tabs)/feed', 
      label: 'Feed', 
      icon: Home,
      badge: null 
    },
    { 
      path: '/(tabs)/messages', 
      label: 'Messages', 
      icon: MessageCircle,
      badge: totalUnreadCount > 0 ? totalUnreadCount : null
    },
    { 
      path: '/(tabs)/discover', 
      label: 'Discover', 
      icon: Compass,
      badge: null 
    },
    { 
      path: '/(tabs)/profile', 
      label: 'Profile', 
      icon: User,
      badge: null 
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <View style={styles.headerContent}>
          <View style={styles.logoContainer}>
            <Text style={[styles.logo, { color: colors.tint }]}>VIbe</Text>
          </View>
          
          <TouchableOpacity
            style={styles.menuButton}
            onPress={toggleMenu}
            activeOpacity={0.7}
          >
            {menuOpen ? (
              <X size={24} color={colors.text} />
            ) : (
              <Menu size={24} color={colors.text} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Overlay when menu is open */}
      {menuOpen && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={toggleMenu}
        />
      )}

      {/* Slide-out Menu */}
      {menuOpen && (
        <Animated.View
          style={[
            styles.menu,
            {
              backgroundColor: colors.card,
              borderRightColor: colors.border,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <View style={styles.menuHeader}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>Navigation</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={toggleMenu}
              activeOpacity={0.7}
            >
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.menuItems}>
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={item.path}
                  style={[styles.menuItem, { borderBottomColor: colors.border }]}
                  onPress={() => handleNavigation(item.path)}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuItemContent}>
                    <Icon size={22} color={colors.text} />
                    <Text style={[styles.menuItemLabel, { color: colors.text }]}>
                      {item.label}
                    </Text>
                  </View>
                  {item.badge !== null && item.badge !== undefined && item.badge > 0 && (
                    <View style={[styles.badge, { backgroundColor: colors.error }]}>
                      <Text style={styles.badgeText}>
                        {item.badge > 99 ? '99+' : item.badge}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    borderBottomWidth: 1,
    ...(Platform.OS === 'web' && {
      display: 'flex',
    }),
  },
  headerBar: {
    width: '100%',
    paddingVertical: 16,
    height: 64,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  logoContainer: {
    flex: 1,
  },
  logo: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 1,
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    position: 'fixed',
    top: 64,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
    ...(Platform.OS === 'web' && {
      display: 'flex',
    }),
  },
  menu: {
    position: 'fixed',
    top: 64,
    right: 0,
    width: 300,
    maxHeight: 'calc(100vh - 64px)',
    borderRightWidth: 1,
    zIndex: 1001,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    ...(Platform.OS === 'web' && {
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 64px)',
    }),
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItems: {
    flex: 1,
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});


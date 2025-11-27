import { Tabs } from 'expo-router';
import { Home, MessageCircle, Compass, User } from 'lucide-react-native';
import React from 'react';
import { useColorScheme, View, Text, StyleSheet } from 'react-native';
import { useMessaging } from '../../contexts/MessagingContext';
import { Colors } from '../../constants/colors';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '../../hooks/useResponsive';
import { isWeb as isWebPlatform } from '../../utils/platform';
import WebNavigation from '../../components/WebNavigation';

export default function TabsLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { totalUnreadCount, refreshConversations } = useMessaging();
  const insets = useSafeAreaInsets();
  const { width } = useResponsive();

  // Refresh when the tab bar becomes focused/visible
  useFocusEffect(
    React.useCallback(() => {
      refreshConversations();
    }, [])
  );

  // Show bottom tabs only on mobile/tablet (< 992px)
  // Show WebNavigation on desktop (>= 992px)
  // Use window dimensions directly for more reliable detection
  const [windowWidth, setWindowWidth] = React.useState(width);
  
  React.useEffect(() => {
    const updateWidth = () => {
      if (isWebPlatform) {
        setWindowWidth(window.innerWidth || width);
      } else {
        setWindowWidth(width);
      }
    };
    
    if (isWebPlatform) {
      updateWidth();
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
  }, [width, isWebPlatform]);
  
  const isDesktop = isWebPlatform && windowWidth >= 992;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: isWebPlatform ? 80 : 85,
          paddingBottom: isWebPlatform ? 16 : 20,
          paddingTop: 8,
          // Hide tab bar on desktop (>= 992px)
          ...(isDesktop && {
            display: 'none',
          }),
          // Web-specific styling for mobile/tablet views
          ...(isWebPlatform && !isDesktop && {
            position: 'fixed' as any,
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            maxWidth: 768,
            alignSelf: 'center',
          }),
        },
        tabBarLabelStyle: {
          fontSize: isWebPlatform ? 11 : 12,
          fontWeight: '600',
        },
        // Add header for desktop with WebNavigation
        header: () => (isDesktop ? <WebNavigation /> : null),
      }}
      sceneContainerStyle={isDesktop ? { paddingTop: 64 } : undefined} as any
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => (
            <View>
              <MessageCircle color={color} size={size} />
              {totalUnreadCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.error }]}>
                  <Text style={styles.badgeText}>
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
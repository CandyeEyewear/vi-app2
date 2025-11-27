/**
 * Root App Layout
 * Wraps the entire app with providers
 */

import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { FeedProvider } from '../contexts/FeedContext';
import { MessagingProvider } from '../contexts/MessagingContext';
import { NetworkProvider } from '../contexts/NetworkContext';
import NetworkStatusBanner from '../components/NetworkStatusBanner';
import WebNavigation from '../components/WebNavigation';
import { logger } from '../utils/logger';
import { setupFCMHandlers } from '../services/fcmNotifications';
import { isWeb } from '../utils/platform';

// Import splash screen with error handling
let SplashScreen: any = null;
try {
  SplashScreen = require('expo-splash-screen');
  SplashScreen.preventAutoHideAsync();
} catch (e) {
  logger.warn('expo-splash-screen not available, splash screen will auto-hide');
}

function AppContent() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const responseListener = useRef<any>(null);
  const { width } = useWindowDimensions();
  
  // Show WebNavigation on desktop (>= 992px) when user is logged in
  const isDesktop = isWeb && width >= 992;
  const showWebNav = isDesktop && !!user;

  useEffect(() => {
    if (!authLoading && SplashScreen) {
      const timer = setTimeout(() => {
        SplashScreen.hideAsync().catch(() => {});
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [authLoading]);

  useEffect(() => {
    setupFCMHandlers((path: string) => {
      if (path.startsWith('/conversation/')) {
        const conversationId = path.replace('/conversation/', '');
        router.push({
          pathname: '/conversation/[id]',
          params: { id: conversationId }
        } as any);
      } else {
        router.push(path as any);
      }
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      if (data.type && data.id) {
        switch (data.type) {
          case 'circle_request':
            router.push(`/profile/${data.id}` as any);
            break;
          case 'announcement':
            router.push('/feed' as any);
            break;
          case 'opportunity':
            router.push(`/opportunity/${data.id}` as any);
            break;
          case 'message':
            router.push({
              pathname: '/conversation/[id]',
              params: { id: data.id }
            } as any);
            break;
          case 'post':
            router.push(`/post/${data.id}` as any);
            break;
          case 'opportunity_submitted':
            router.push(`/(admin)/opportunity-review/${data.id}` as any);
            break;
          case 'opportunity_approved':
          case 'opportunity_rejected':
            router.push(`/opportunity/${data.id}` as any);
            break;
          case 'cause':
            router.push(`/causes/${data.id}` as any);
            break;
          case 'event':
            router.push(`/events/${data.id}` as any);
            break;
        }
      }
    });

    Linking.getInitialURL().then((url) => {
      if (url) {
        logger.info('[DEEP LINK] Initial URL', { url });
        const parsed = Linking.parse(url);
        
        if (parsed.hostname === 'vibe.volunteersinc.org' || parsed.scheme === 'vibe') {
          if (parsed.path === '/invite' || parsed.path?.includes('invite')) {
            const inviteCode = parsed.queryParams?.code || parsed.queryParams?.ref || parsed.queryParams?.invite;
            if (inviteCode) {
              const code = Array.isArray(inviteCode) ? inviteCode[0] : inviteCode;
              logger.info('[DEEP LINK] Navigating to register with invite code', { code });
              router.push(`/register?code=${code}` as any);
              return;
            }
          }
        }
        
        logger.info('[DEEP LINK] Letting expo-router handle', { url });
      }
    });

    return () => {
      if (responseListener.current?.remove) {
        responseListener.current.remove();
      }
    };
  }, []);

  return (
    <>
      <NetworkStatusBanner />
      {showWebNav && <WebNavigation />}
      <View style={showWebNav ? { paddingTop: 64, flex: 1 } : { flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="conversation/[id]" />
          <Stack.Screen name="opportunity/[id]" />
          <Stack.Screen name="profile/[id]" />
          <Stack.Screen name="post/[id]" />
          <Stack.Screen name="propose-opportunity" />
          <Stack.Screen name="membership-features" />
          <Stack.Screen name="membership" />
          <Stack.Screen name="membership/subscribe" />
          <Stack.Screen name="causes/[id]" />
          <Stack.Screen name="causes/[id]/donate" />
        </Stack>
      </View>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NetworkProvider>
        <AuthProvider>
          <FeedProvider>
            <MessagingProvider>
              <View style={isWeb ? webStyles.webContainer : styles.container}>
                <AppContent />
              </View>
            </MessagingProvider>
          </FeedProvider>
        </AuthProvider>
      </NetworkProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

const webStyles = StyleSheet.create({
  webContainer: {
    flex: 1,
    minHeight: '100vh' as any,
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
});
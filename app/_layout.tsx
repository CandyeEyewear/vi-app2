/**
 * Root App Layout
 * Wraps the entire app with providers
 */


import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
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
  const segments = useSegments();
  const pathname = usePathname();
  const { loading: authLoading, user } = useAuth();
  const responseListener = useRef<any>(null);
  const { width } = useWindowDimensions();
  
  // Show WebNavigation on desktop (>= 992px) when user is logged in
  const isDesktop = isWeb && width >= 992;
  const showWebNav = isDesktop && !!user;

  // Define public routes that don't require authentication
  const publicRoutes = ['login', 'register', 'forgot-password', 'reset-password'];
  
  // Get current route to check if it's public
  const currentRoute = segments[0] || pathname?.split('/')[1] || '';
  const normalizedPath = pathname?.toLowerCase() || '';
  const isPublicRoute = 
    publicRoutes.includes(currentRoute) || 
    normalizedPath.includes('/login') || 
    normalizedPath.includes('/register') || 
    normalizedPath.includes('/forgot-password') || 
    normalizedPath.includes('/reset-password') ||
    currentRoute === '' || // Root path
    pathname === '/' || // Root path
    pathname === '';

  // Redirect unauthenticated users to login (except for public routes)
  useEffect(() => {
    if (!authLoading) {
      // If user is not logged in and trying to access a protected route
      if (!user && !isPublicRoute) {
        console.log('[AUTH REDIRECT] User not authenticated, redirecting to login', {
          currentRoute,
          pathname,
          isPublicRoute,
        });
        router.replace('/login');
        return;
      }
      
      // If user is logged in but on login/register page, redirect to feed
      if (user && isPublicRoute && (currentRoute === 'login' || currentRoute === 'register' || normalizedPath.includes('/login') || normalizedPath.includes('/register'))) {
        console.log('[AUTH REDIRECT] User authenticated, redirecting from login/register to feed');
        router.replace('/feed');
        return;
      }
    }
  }, [authLoading, user, isPublicRoute, currentRoute, router, pathname, normalizedPath]);

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
            router.push(`/profile/${data.slug || data.id}` as any);
            break;
          case 'announcement':
            router.push('/feed' as any);
            break;
          case 'opportunity':
            router.push(`/opportunity/${data.slug || data.id}` as any);
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
            router.push(`/opportunity/${data.slug || data.id}` as any);
            break;
          case 'cause':
            router.push(`/causes/${data.slug || data.id}` as any);
            break;
          case 'event':
            router.push(`/events/${data.slug || data.id}` as any);
            break;
        }
      }
    });

    // Handle deep links for payment redirects and other URLs
    const handleDeepLink = (url: string) => {
      if (!url) return;
      
      logger.info('[DEEP LINK] Received URL', { url });
      const parsed = Linking.parse(url);
      
      // Handle payment redirects (vibe://payment/success or vibe://payment/cancel)
      if (parsed.scheme === 'vibe' && parsed.path) {
        if (parsed.path.includes('payment/success')) {
          // Extract returnPath from query params if provided
          const returnPath = parsed.queryParams?.returnPath || parsed.queryParams?.return_path;
          const redirectPath = returnPath && typeof returnPath === 'string' 
            ? returnPath 
            : '/feed';
          logger.info('[DEEP LINK] Payment success redirect detected', { 
            path: parsed.path, 
            returnPath,
            redirectPath 
          });
          router.replace(redirectPath);
          return;
        }
        if (parsed.path.includes('payment/cancel')) {
          // For cancel, also check for returnPath but default to feed
          const returnPath = parsed.queryParams?.returnPath || parsed.queryParams?.return_path;
          const redirectPath = returnPath && typeof returnPath === 'string' 
            ? returnPath 
            : '/feed';
          logger.info('[DEEP LINK] Payment cancel redirect detected', { 
            path: parsed.path,
            returnPath,
            redirectPath 
          });
          router.replace(redirectPath);
          return;
        }
      }
      
      // Handle web URLs
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
    };

    // Handle initial URL
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      if (responseListener.current?.remove) {
        responseListener.current.remove();
      }
      // Clean up deep link subscription
      if (subscription?.remove) {
        subscription.remove();
      }
    };
  }, [router]);

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
          <Stack.Screen name="opportunity/[slug]" />
          <Stack.Screen name="profile/[slug]" />
          <Stack.Screen name="post/[id]" />
          <Stack.Screen name="propose-opportunity" />
          <Stack.Screen name="membership-features" />
          <Stack.Screen name="membership" />
          <Stack.Screen name="membership/subscribe" />
          <Stack.Screen name="causes/[slug]" />
          <Stack.Screen name="causes/[slug]/donate" />
          <Stack.Screen name="events/[slug]" />
          <Stack.Screen name="events/[slug]/register" />
          <Stack.Screen name="(admin)" />
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
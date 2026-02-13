/**
 * Root App Layout
 * Wraps the entire app with providers
 */


import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, usePathname, useRootNavigationState } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, StyleSheet, useWindowDimensions, Image, ActivityIndicator, Platform, Alert, AppState } from 'react-native';
import * as Updates from 'expo-updates';
import * as Sentry from '@sentry/react-native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { FeedProvider } from '../contexts/FeedContext';
import { MessagingProvider } from '../contexts/MessagingContext';
import { NetworkProvider } from '../contexts/NetworkContext';
import NetworkStatusBanner from '../components/NetworkStatusBanner';
import AppDownloadBanner from '../components/AppDownloadBanner';
import WebNavigation from '../components/WebNavigation';
import { MobileWebSafeContainer } from '../components/MobileWebSafeContainer';
import { logger } from '../utils/logger';
import { supabase } from '../services/supabase';
import { setupFCMHandlers } from '../services/fcmNotifications';
import { setupWebNotificationHandler, setWebNotificationHandler } from '../services/webNotifications';
import { useAlert } from '../hooks/useAlert';
import CustomAlert from '../components/CustomAlert';
import { AlertProvider } from '../contexts/AlertContext';
import { isWeb } from '../utils/platform';

Sentry.init({
  dsn: 'https://e3cd7fd70496e616a2ed41f8085eaee3@o4510512782180352.ingest.us.sentry.io/4510512792600576',
  enableInExpoDevelopment: false,
  debug: __DEV__,
});

// Load global CSS fixes on web (safe no-op on native)
if (isWeb) {
  try {
    require('../global.css');
  } catch { }
}

// Import splash screen with error handling
let SplashScreen: any = null;
try {
  SplashScreen = require('expo-splash-screen');
  SplashScreen.preventAutoHideAsync();
} catch (e) {
  logger.warn('expo-splash-screen not available, splash screen will auto-hide');
}

const splashImage = require('../assets/images/splash.png');

function AppContent() {
  const router = useRouter();
  const pathname = usePathname();
  const rootNavigationState = useRootNavigationState();
  const { refreshUser, loading: authLoading, initialAuthComplete, user, needsPasswordSetup, isPasswordRecovery } = useAuth();
  const responseListener = useRef<any>(null);
  const webNotificationCleanup = useRef<(() => void) | null>(null);
  const otaCheckInProgress = useRef(false);
  const otaPromptShown = useRef(false);
  const { width } = useWindowDimensions();
  const { alertProps, showAlert } = useAlert();
  const [forceReady, setForceReady] = useState(false);

  // Check if navigation is ready
  const navigationReady = rootNavigationState?.key != null;

  // Show WebNavigation on desktop (>= 992px) when user is logged in
  const isDesktop = isWeb && width >= 992;
  const showWebNav = isDesktop && !!user;

  const sanitizedPathname = pathname || '/';
  const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/set-password'];
  const publicRoutePrefixes = ['/post/'];
  const isPublicRoute =
    publicRoutes.includes(sanitizedPathname) ||
    publicRoutePrefixes.some((prefix) => sanitizedPathname.startsWith(prefix));

  const isLoginPage = sanitizedPathname === '/login';
  const isRegisterPage = sanitizedPathname === '/register';
  const isSetPasswordPage = sanitizedPathname === '/set-password';
  const isResetPasswordPage = sanitizedPathname === '/reset-password';

  // Determine if we're still initializing (show splash only during initial boot)
  // CRITICAL: Wait for both navigation AND initial auth check to complete
  // This prevents race condition where routing happens before session is loaded
  // forceReady is a safety valve to prevent infinite loading
  const isInitializing = !forceReady && (!navigationReady || !initialAuthComplete || authLoading);

  // Safety timeout: If still initializing after 10 seconds, force ready state
  // This prevents the app from being stuck on splash screen forever
  useEffect(() => {
    if (isInitializing) {
      console.log('[NAV] Initializing state:', { navigationReady, initialAuthComplete, authLoading, forceReady });
      const timeout = setTimeout(() => {
        console.warn('[NAV] ⚠️ Initialization timeout - forcing ready state after 10s');
        console.warn('[NAV] State at timeout:', { navigationReady, initialAuthComplete, authLoading });
        setForceReady(true);
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [isInitializing, navigationReady, initialAuthComplete, authLoading, forceReady]);

  useEffect(() => {
    if (!isInitializing && SplashScreen) {
      const timer = setTimeout(() => {
        SplashScreen.hideAsync().catch(() => { });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isInitializing]);

  // Handle auth redirects in useEffect (not render)
  useEffect(() => {
    if (isInitializing) {
      console.log('[NAV] Still initializing, skipping redirects');
      return;
    }

    console.log('[NAV] Checking redirects...', {
      user: !!user,
      needsPasswordSetup,
      isPasswordRecovery,
      pathname: sanitizedPathname,
      isPublicRoute,
    });

    // Password setup (HubSpot signups) takes highest priority.
    // These users arrive via recovery links but should use /set-password, not /reset-password.
    if (user && needsPasswordSetup && !isSetPasswordPage) {
      console.log('[NAV] Redirecting to set-password (HubSpot signup)');
      router.replace('/set-password');
      return;
    }

    // Password recovery (forgot-password flow) - redirect to reset-password
    if (isPasswordRecovery && !isResetPasswordPage) {
      console.log('[NAV] Password recovery flow - redirecting to reset-password');
      router.replace('/reset-password');
      return;
    }

    // Redirect authenticated users away from login/register (but not if in recovery)
    if (user && !needsPasswordSetup && !isPasswordRecovery && (isLoginPage || isRegisterPage)) {
      console.log('[NAV] Redirecting authenticated user to feed');
      router.replace('/feed');
      return;
    }

    // Redirect unauthenticated users to login (except public routes)
    if (!user && !isPublicRoute) {
      console.log('[NAV] Redirecting to login (not authenticated)');
      router.replace('/login');
      return;
    }
  }, [
    isInitializing,
    user,
    needsPasswordSetup,
    isPasswordRecovery,
    sanitizedPathname,
    isPublicRoute,
    isLoginPage,
    isRegisterPage,
    isSetPasswordPage,
    isResetPasswordPage,
    router,
  ]);

  useEffect(() => {
    if (isWeb || __DEV__) return;

    let mounted = true;

    const checkAndApplyOtaUpdate = async (trigger: 'launch' | 'foreground') => {
      if (!mounted || otaCheckInProgress.current || otaPromptShown.current || !Updates.isEnabled) {
        return;
      }

      otaCheckInProgress.current = true;
      try {
        logger.info('[OTA] Checking for update', {
          trigger,
          runtimeVersion: Updates.runtimeVersion,
          updateId: Updates.updateId,
          channel: (Updates as any).channel ?? 'unknown',
        });

        const update = await Updates.checkForUpdateAsync();
        if (!update.isAvailable) {
          return;
        }

        await Updates.fetchUpdateAsync();
        if (!mounted) return;

        otaPromptShown.current = true;
        Alert.alert(
          'Update Ready',
          'A new version has been downloaded. Restart now to apply it?',
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Restart',
              onPress: () => {
                Updates.reloadAsync().catch((error) => {
                  logger.warn('[OTA] Failed to reload app after update', { error });
                });
              },
            },
          ],
          { cancelable: false }
        );
      } catch (error) {
        logger.warn('[OTA] Update check failed', { trigger, error });
      } finally {
        otaCheckInProgress.current = false;
      }
    };

    checkAndApplyOtaUpdate('launch');

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkAndApplyOtaUpdate('foreground');
      }
    });

    return () => {
      mounted = false;
      appStateSubscription.remove();
    };
  }, []);

  useEffect(() => {
    // Setup web notification handler if on web
    if (isWeb) {
      // Register callback to show custom alerts
      setWebNotificationHandler((config) => {
        showAlert({
          type: config.type,
          title: config.title,
          message: config.message,
          buttons: config.onPress
            ? [
              { text: 'View', style: 'default', onPress: config.onPress },
              { text: 'Dismiss', style: 'cancel' },
            ]
            : [{ text: 'OK', style: 'default' }],
        });
      });

      // Setup web notification handler
      const cleanup = setupWebNotificationHandler((path: string) => {
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

      webNotificationCleanup.current = cleanup;
    }

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

      // Handle email verification redirect (vibe://login?code=... or https://.../login?code=...)
      const isLoginPath = parsed.path === 'login' || parsed.path === '/login';
      if (isLoginPath) {
        const code = parsed.queryParams?.code;
        if (code) {
          const codeStr = Array.isArray(code) ? code[0] : code;
          logger.info('[DEEP LINK] Auth code detected, exchanging for session...');
          supabase.auth.exchangeCodeForSession(codeStr).then(({ data, error }) => {
            if (error) {
              logger.error('[DEEP LINK] Code exchange failed:', error);
              router.replace('/login' as any);
            } else {
              logger.info('[DEEP LINK] Session established via code exchange');
              router.replace('/feed' as any);
            }
          });
          return;
        }
      }

      // Handle payment redirects (vibe://payment/success or vibe://payment/cancel)
      if (parsed.scheme === 'vibe' && parsed.path) {
        if (parsed.path.includes('payment/success')) {
          // Extract query params to pass to success page
          const orderId = parsed.queryParams?.orderId;
          const returnPathRaw = parsed.queryParams?.returnPath || parsed.queryParams?.return_path;
          const returnPath = Array.isArray(returnPathRaw) ? returnPathRaw[0] : returnPathRaw;

          logger.info('[DEEP LINK] Payment success redirect detected - navigating to success page first', {
            path: parsed.path,
            orderId,
            returnPathRaw,
            returnPath
          });

          // Refresh user data to get updated membership status
          if (refreshUser) {
            logger.info('[DEEP LINK] Refreshing user data after payment success...');
            refreshUser().catch((error) => {
              logger.error('[DEEP LINK] Error refreshing user after payment:', error);
            });
          }

          // Navigate to success page first, which will then redirect to returnPath after countdown
          const successParams: any = {};
          if (orderId) {
            const orderIdValue = Array.isArray(orderId) ? orderId[0] : orderId;
            successParams.orderId = orderIdValue;
          }
          if (returnPath) {
            successParams.returnPath = returnPath;
          }

          router.replace({
            pathname: '/payment/success',
            params: successParams
          } as any);
          return;
        }
        if (parsed.path.includes('payment/cancel')) {
          // Show the cancel screen in-app (instead of silently jumping to feed)
          // so the user sees an explicit failure/cancel state and can retry.
          const orderId = parsed.queryParams?.orderId;
          const orderIdValue = Array.isArray(orderId) ? orderId[0] : orderId;
          const returnPathRaw = parsed.queryParams?.returnPath || parsed.queryParams?.return_path;
          const returnPath = Array.isArray(returnPathRaw) ? returnPathRaw[0] : returnPathRaw;

          logger.info('[DEEP LINK] Payment cancel redirect detected', {
            path: parsed.path,
            orderId: orderIdValue,
            returnPathRaw,
            returnPath,
          });
          const cancelParams: any = {};
          if (orderIdValue) cancelParams.orderId = orderIdValue;
          if (returnPath && typeof returnPath === 'string') cancelParams.returnPath = returnPath;
          router.replace({
            pathname: '/payment/cancel',
            params: cancelParams,
          } as any);
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
      // Clean up web notification handler
      if (webNotificationCleanup.current) {
        webNotificationCleanup.current();
        webNotificationCleanup.current = null;
      }
    };
  }, [router, refreshUser, showAlert]);

  // Show splash while initializing
  if (isInitializing) {
    return (
      <View style={styles.splashContainer}>
        <Image source={splashImage} style={styles.splashImage} resizeMode="cover" />
        <ActivityIndicator size="large" color="#FFFFFF" style={styles.splashSpinner} />
      </View>
    );
  }

  return (
    <>
      <NetworkStatusBanner />
      <AppDownloadBanner />
      {showWebNav && <WebNavigation />}
      <View style={showWebNav ? { paddingTop: 64, flex: 1 } : { flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="set-password" />
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
      <CustomAlert {...alertProps} />
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
              <AlertProvider>
                {isWeb ? (
                  <MobileWebSafeContainer>
                    <AppContent />
                  </MobileWebSafeContainer>
                ) : (
                  <View style={styles.container}>
                    <AppContent />
                  </View>
                )}
              </AlertProvider>
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
  splashContainer: {
    flex: 1,
    backgroundColor: '#0944a2',
    ...(Platform.OS === 'web'
      ? {
        position: 'fixed' as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
      }
      : {}),
  },
  splashImage: {
    width: '100%',
    height: '100%',
  },
  splashSpinner: {
    position: 'absolute',
    bottom: 80,
  },
});

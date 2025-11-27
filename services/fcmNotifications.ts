import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

// ⚠️ PLATFORM CHECK: Only import Firebase on mobile
let messaging: any = null;

if (Platform.OS !== 'web') {
  // Only load Firebase on iOS/Android
  try {
    messaging = require('@react-native-firebase/messaging').default;
  } catch (error) {
    console.warn('[FCM] Firebase messaging not available on this platform');
  }
}

// Track if handlers are already set up
let handlersInitialized = false;
let messageUnsubscribe: (() => void) | null = null;
let openedAppUnsubscribe: (() => void) | null = null;

// Request FCM permission and get token
export async function registerForFCMNotifications(): Promise<string | null> {
  // ✅ GUARD: Return null on web
  if (Platform.OS === 'web' || !messaging) {
    console.log('[FCM] ⚠️ FCM not available on web, using Expo push only');
    return null;
  }

  try {
    console.log('[FCM] 📱 Requesting notification permissions...');
    
    const { status: expoStatus } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowAnnouncements: false,
      },
    });
    
    console.log('[FCM] Expo permission status:', expoStatus);
    
    if (expoStatus !== 'granted') {
      console.log('[FCM] ❌ Permission denied');
      return null;
    }
    
    console.log('[FCM] ✅ Permission granted');
    
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log('[FCM] ❌ FCM permission denied');
      return null;
    }

    const fcmToken = await messaging().getToken();
    console.log('[FCM] ✅ FCM Token:', fcmToken ? fcmToken.substring(0, 20) + '...' : 'null');

    return fcmToken;
  } catch (error) {
    console.error('[FCM] ❌ Error:', error);
    return null;
  }
}

/**
 * Handle navigation based on notification data
 */
function handleNotificationNavigation(
  data: FirebaseMessagingTypes.RemoteMessage['data'],
  navigate: (path: string) => void
) {
  if (!data || !data.type || !data.id) {
    console.log('[FCM] ⚠️ Notification missing type or id, skipping navigation');
    return;
  }

  console.log('[FCM] 🧭 Navigating based on notification:', { type: data.type, id: data.id });

  switch (data.type) {
    case 'circle_request':
      navigate(`/profile/${data.id}`);
      break;
    case 'announcement':
      navigate('/(tabs)');
      break;
    case 'opportunity':
      navigate(`/opportunity/${data.id}`);
      break;
    case 'message':
      navigate(`/conversation/${data.id}`);
      break;
    case 'post':
      navigate(`/post/${data.id}`);
      break;
    case 'opportunity_submitted':
      navigate(`/(admin)/opportunity-review/${data.id}`);
      break;
    case 'opportunity_approved':
    case 'opportunity_rejected':
      navigate(`/opportunity/${data.id}`);
      break;
    default:
      console.log('[FCM] ⚠️ Unknown notification type:', data.type);
  }
}

// Set up foreground notification handler (ONCE)
export function setupFCMHandlers(navigate?: (path: string) => void) {
  // ✅ GUARD: Return early on web
  if (Platform.OS === 'web' || !messaging) {
    console.log('[FCM] ⚠️ FCM handlers not available on web');
    return;
  }

  // ✅ GUARD: Prevent multiple setup
  if (handlersInitialized) {
    console.log('[FCM] ⚠️ Handlers already initialized, skipping setup');
    return;
  }

  console.log('[FCM] 🔧 Setting up FCM handlers (ONCE)');
  handlersInitialized = true;

  // Configure how Expo should display notifications
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  // ✅ Single Firebase listener for foreground messages
  messageUnsubscribe = messaging().onMessage(async remoteMessage => {
    console.log('[FCM] 📬 Foreground notification received (SINGLE):', remoteMessage);
    
    // Use Expo to display
    await Notifications.scheduleNotificationAsync({
      content: {
        title: remoteMessage.notification?.title || 'VIbe',
        body: remoteMessage.notification?.body || '',
        data: remoteMessage.data || {},
      },
      trigger: null,
    });
  });

  // Handle notification tap when app was in background
  if (navigate) {
    openedAppUnsubscribe = messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('[FCM] 📱 Notification opened app from background');
      if (remoteMessage.data) {
        handleNotificationNavigation(remoteMessage.data, navigate);
      }
    });

    // Handle notification tap when app was closed
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('[FCM] 📱 Notification opened app from quit state');
          if (remoteMessage.data) {
            setTimeout(() => {
              handleNotificationNavigation(remoteMessage.data, navigate);
            }, 1000);
          }
        }
      });
  }
}

// Cleanup function (optional, for hot reload during dev)
export function cleanupFCMHandlers() {
  if (messageUnsubscribe) {
    messageUnsubscribe();
    messageUnsubscribe = null;
  }
  if (openedAppUnsubscribe) {
    openedAppUnsubscribe();
    openedAppUnsubscribe = null;
  }
  handlersInitialized = false;
  console.log('[FCM] 🧹 Cleaned up FCM handlers');
}

// ✅ GUARD: Only set up background handler on mobile
if (Platform.OS !== 'web' && messaging) {
  // Handle background messages (Android)
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('[FCM] 📭 Background notification received:', remoteMessage);
  });
}
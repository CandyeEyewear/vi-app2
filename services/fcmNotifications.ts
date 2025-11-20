import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

// Request FCM permission and get token
export async function registerForFCMNotifications(): Promise<string | null> {
  try {
    console.log('[FCM] 📱 Requesting notification permissions...');
    
    // First, request Expo Notifications permissions (this shows the native permission dialog)
    console.log('[FCM] 🔐 Requesting Expo Notifications permissions...');
    const { status: expoStatus } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowAnnouncements: false,
      },
    });
    
    console.log('[FCM] Expo Notifications permission status:', expoStatus);
    
    if (expoStatus !== 'granted') {
      console.log('[FCM] ❌ Expo Notifications permission denied');
      return null;
    }
    
    console.log('[FCM] ✅ Expo Notifications permission granted');
    
    // Request FCM permission (iOS/Android 13+)
    console.log('[FCM] 🔐 Requesting FCM permissions...');
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log('[FCM] ❌ FCM permission denied. Status:', authStatus);
      return null;
    }

    console.log('[FCM] ✅ FCM permission granted');

    // Get FCM token
    console.log('[FCM] 🔑 Getting FCM token...');
    const fcmToken = await messaging().getToken();
    console.log('[FCM] ✅ FCM Token received:', fcmToken ? fcmToken.substring(0, 20) + '...' : 'null');

    if (!fcmToken) {
      console.log('[FCM] ⚠️ FCM token is null');
      return null;
    }

    return fcmToken;
  } catch (error) {
    console.error('[FCM] ❌ Error getting FCM token:', error);
    console.error('[FCM] Error details:', JSON.stringify(error, null, 2));
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

// Set up foreground notification handler
export function setupFCMHandlers(navigate?: (path: string) => void) {
  // Configure how notifications are displayed
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  // Handle foreground messages
  messaging().onMessage(async remoteMessage => {
    console.log('[FCM] 📬 Foreground notification received:', remoteMessage);
    
    // Show local notification when app is in foreground
    await Notifications.scheduleNotificationAsync({
      content: {
        title: remoteMessage.notification?.title || 'VIbe',
        body: remoteMessage.notification?.body || '',
        data: remoteMessage.data,
      },
      trigger: null, // Show immediately
    });
  });

  // Handle notification tap when app was in background
  messaging().onNotificationOpenedApp(remoteMessage => {
    console.log('[FCM] 📱 Notification opened app from background:', remoteMessage);
    
    if (navigate && remoteMessage.data) {
      handleNotificationNavigation(remoteMessage.data, navigate);
    }
  });

  // Handle notification tap when app was closed
  messaging()
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage) {
        console.log('[FCM] 📱 Notification opened app from quit state:', remoteMessage);
        
        if (navigate && remoteMessage.data) {
          // Small delay to ensure app is fully initialized
          setTimeout(() => {
            handleNotificationNavigation(remoteMessage.data, navigate);
          }, 1000);
        }
      }
    });
}

// Handle background messages (Android)
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('[FCM] 📭 Background notification received:', remoteMessage);
});


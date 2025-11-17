import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Request FCM permission and get token
export async function registerForFCMNotifications(): Promise<string | null> {
  try {
    console.log('[FCM] 📱 Requesting notification permissions...');
    
    // Request permission (iOS/Android 13+)
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log('[FCM] ❌ Permission denied');
      return null;
    }

    console.log('[FCM] ✅ Permission granted');

    // Get FCM token
    const fcmToken = await messaging().getToken();
    console.log('[FCM] 🔑 FCM Token:', fcmToken);

    return fcmToken;
  } catch (error) {
    console.error('[FCM] ❌ Error getting FCM token:', error);
    return null;
  }
}

// Set up foreground notification handler
export function setupFCMHandlers() {
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
    // Handle navigation here if needed
  });

  // Handle notification tap when app was closed
  messaging()
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage) {
        console.log('[FCM] 📱 Notification opened app from quit state:', remoteMessage);
        // Handle navigation here if needed
      }
    });
}

// Handle background messages (Android)
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('[FCM] 📭 Background notification received:', remoteMessage);
});


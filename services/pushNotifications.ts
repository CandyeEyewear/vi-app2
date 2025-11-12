import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushNotificationData {
  type: 'circle_request' | 'announcement' | 'opportunity' | 'message';
  id: string;
  title: string;
  body: string;
  data?: any;
}

/**
 * Request notification permissions and get push token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  console.log('[PUSH] 🚀 Starting push notification registration...');
  
  try {
    // Check if running on physical device
    console.log('[PUSH] 📱 Checking device type...');
    console.log('[PUSH] Device.isDevice:', Device.isDevice);
    
    if (!Device.isDevice) {
      console.log('[PUSH] ⚠️ Push notifications only work on physical devices');
      return null;
    }
    
    console.log('[PUSH] ✅ Running on physical device');

    // Request permissions
    console.log('[PUSH] 🔐 Checking existing notification permissions...');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('[PUSH] Existing permission status:', existingStatus);
    
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      console.log('[PUSH] 📝 Requesting new notification permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('[PUSH] Permission request result:', status);
    } else {
      console.log('[PUSH] ✅ Permissions already granted');
    }

    if (finalStatus !== 'granted') {
      console.log('[PUSH] ❌ Permission not granted for push notifications. Final status:', finalStatus);
      return null;
    }

    console.log('[PUSH] ✅ Notification permissions granted');

    // Get push token
    console.log('[PUSH] 🔑 Retrieving project ID for push token...');
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    console.log('[PUSH] Project ID:', projectId);
    
    if (!projectId) {
      console.error('[PUSH] ❌ Project ID not found in config');
      console.log('[PUSH] Constants.expoConfig?.extra?.eas:', Constants.expoConfig?.extra?.eas);
      console.log('[PUSH] Constants.easConfig:', Constants.easConfig);
      return null;
    }

    console.log('[PUSH] 🎫 Generating Expo push token...');
    const pushToken = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    console.log('[PUSH] ✅ Push token generated successfully');
    console.log('[PUSH] Token (first 20 chars):', pushToken.data.substring(0, 20) + '...');

    // Android specific setup
    if (Platform.OS === 'android') {
      console.log('[PUSH] 📳 Setting up Android notification channel...');
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2196F3',
      });
      console.log('[PUSH] ✅ Android notification channel configured');
    } else {
      console.log('[PUSH] 📱 iOS - No channel setup needed');
    }

    console.log('[PUSH] 🎉 Push notification registration completed successfully');
    return pushToken.data;
  } catch (error) {
    console.error('[PUSH] ❌ Error during push notification registration:', error);
    console.error('[PUSH] Error details:', JSON.stringify(error, null, 2));
    return null;
  }
}

/**
 * Save push token to database
 */
export async function savePushToken(userId: string, token: string): Promise<boolean> {
  console.log('[PUSH] 💾 Attempting to save push token to database...');
  console.log('[PUSH] User ID:', userId);
  console.log('[PUSH] Token (first 20 chars):', token.substring(0, 20) + '...');
  
  try {
    const timestamp = new Date().toISOString();
    console.log('[PUSH] Timestamp:', timestamp);
    
    const { error } = await supabase
      .from('push_tokens')
      .upsert({
        user_id: userId,
        token: token,
        updated_at: timestamp,
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('[PUSH] ❌ Database error saving push token:', error);
      console.error('[PUSH] Error code:', error.code);
      console.error('[PUSH] Error message:', error.message);
      console.error('[PUSH] Error details:', error.details);
      throw error;
    }
    
    console.log('[PUSH] ✅ Push token saved successfully to database');
    return true;
  } catch (error) {
    console.error('[PUSH] ❌ Exception while saving push token:', error);
    return false;
  }
}

/**
 * Remove push token from database (on logout)
 */
export async function removePushToken(userId: string): Promise<boolean> {
  console.log('[PUSH] 🗑️ Attempting to remove push token from database...');
  console.log('[PUSH] User ID:', userId);
  
  try {
    const { error } = await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('[PUSH] ❌ Database error removing push token:', error);
      console.error('[PUSH] Error code:', error.code);
      console.error('[PUSH] Error message:', error.message);
      throw error;
    }
    
    console.log('[PUSH] ✅ Push token removed successfully from database');
    return true;
  } catch (error) {
    console.error('[PUSH] ❌ Exception while removing push token:', error);
    return false;
  }
}

/**
 * Send push notification via Expo Push API
 */
export async function sendPushNotification(
  expoPushToken: string,
  notification: PushNotificationData
): Promise<boolean> {
  console.log('[PUSH] 📤 Sending push notification...');
  console.log('[PUSH] Token (first 20 chars):', expoPushToken.substring(0, 20) + '...');
  console.log('[PUSH] Notification type:', notification.type);
  console.log('[PUSH] Title:', notification.title);
  console.log('[PUSH] Body:', notification.body);
  
  try {
    const message = {
      to: expoPushToken,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: { 
        type: notification.type,
        id: notification.id,
        ...notification.data 
      },
      priority: 'high',
    };

    console.log('[PUSH] Sending to Expo Push API...');
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log('[PUSH] API Response:', JSON.stringify(result, null, 2));
    
    if (result.data?.status === 'error') {
      console.error('[PUSH] ❌ Push notification API error:', result.data.message);
      return false;
    }

    console.log('[PUSH] ✅ Push notification sent successfully');
    return true;
  } catch (error) {
    console.error('[PUSH] ❌ Error sending push notification:', error);
    return false;
  }
}

/**
 * Send notification to a specific user by their user ID
 */
export async function sendNotificationToUser(
  userId: string,
  notification: PushNotificationData
): Promise<boolean> {
  console.log('[PUSH] 👤 Sending notification to user...');
  console.log('[PUSH] Target user ID:', userId);
  console.log('[PUSH] Notification type:', notification.type);
  
  try {
    // Get user's push token from database
    console.log('[PUSH] 🔍 Fetching user push token from database...');
    const { data, error } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('[PUSH] ❌ Database error fetching push token:', error);
      return false;
    }

    if (!data) {
      console.log('[PUSH] ⚠️ No push token found for user:', userId);
      return false;
    }

    console.log('[PUSH] ✅ Push token found for user');
    console.log('[PUSH] Token (first 20 chars):', data.token.substring(0, 20) + '...');

    // Send the notification
    return await sendPushNotification(data.token, notification);
  } catch (error) {
    console.error('[PUSH] ❌ Error sending notification to user:', error);
    return false;
  }
}
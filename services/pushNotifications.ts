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
      console.log('[PUSH] 🔐 Requesting new notification permissions...');
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
 * Save push token to database (users table)
 * 🛠️ FIXED: Now uses users.push_token column instead of push_tokens table
 */
export async function savePushToken(userId: string, token: string): Promise<boolean> {
  console.log('[PUSH] 💾 Attempting to save push token to database...');
  console.log('[PUSH] User ID:', userId);
  console.log('[PUSH] Token (first 20 chars):', token.substring(0, 20) + '...');
  
  try {
    const timestamp = new Date().toISOString();
    console.log('[PUSH] Timestamp:', timestamp);
    
    // 🛠️ FIXED: Save to users table instead of push_tokens table
    const { error } = await supabase
      .from('users')
      .update({
        push_token: token,
        updated_at: timestamp,
      })
      .eq('id', userId);

    if (error) {
      console.error('[PUSH] ❌ Database error saving push token:', error);
      console.error('[PUSH] Error code:', error.code);
      console.error('[PUSH] Error message:', error.message);
      console.error('[PUSH] Error details:', error.details);
      throw error;
    }
    
    console.log('[PUSH] ✅ Push token saved successfully to users table');
    return true;
  } catch (error) {
    console.error('[PUSH] ❌ Exception while saving push token:', error);
    return false;
  }
}

/**
 * Remove push token from database (on logout)
 * 🛠️ FIXED: Now uses users.push_token column instead of push_tokens table
 */
export async function removePushToken(userId: string): Promise<boolean> {
  console.log('[PUSH] 🗑️ Attempting to remove push token from database...');
  console.log('[PUSH] User ID:', userId);
  
  try {
    // 🛠️ FIXED: Update users table instead of deleting from push_tokens
    const { error } = await supabase
      .from('users')
      .update({ push_token: null })
      .eq('id', userId);

    if (error) {
      console.error('[PUSH] ❌ Database error removing push token:', error);
      console.error('[PUSH] Error code:', error.code);
      console.error('[PUSH] Error message:', error.message);
      throw error;
    }
    
    console.log('[PUSH] ✅ Push token removed successfully from users table');
    return true;
  } catch (error) {
    console.error('[PUSH] ❌ Exception while removing push token:', error);
    return false;
  }
}

/**
 * Send push notification via Expo Push API
 * Supports single token or array of tokens
 */
export async function sendPushNotification(
  expoPushTokens: string | string[],
  notification: Omit<PushNotificationData, 'id'> & { id?: string },
  badge?: number
): Promise<boolean> {
  const tokens = Array.isArray(expoPushTokens) ? expoPushTokens : [expoPushTokens];
  
  console.log('[PUSH] 📤 Sending push notification...');
  console.log('[PUSH] Number of recipients:', tokens.length);
  console.log('[PUSH] Notification type:', notification.type);
  console.log('[PUSH] Title:', notification.title);
  console.log('[PUSH] Body:', notification.body);
  console.log('[PUSH] Badge count:', badge);
  
  try {
    // Build messages for all tokens
    const messages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      badge: badge, // 🔴 ADD BADGE COUNT
      data: { 
        type: notification.type,
        id: notification.id,
        ...notification.data 
      },
      priority: 'high',
    }));

    console.log('[PUSH] 📡 Sending to Expo Push API...');
    console.log('[PUSH] Request URL: https://exp.host/--/api/v2/push/send');
    console.log('[PUSH] Request payload size:', JSON.stringify(messages).length, 'bytes');
    
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    console.log('[PUSH] 📥 API Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      console.error('[PUSH] ❌ API request failed with status:', response.status);
      const errorText = await response.text();
      console.error('[PUSH] ❌ Error response body:', errorText);
      return false;
    }

    const result = await response.json();
    console.log('[PUSH] 📊 API Response:', JSON.stringify(result, null, 2));
    
    // Check for errors in response
    if (result.data) {
      const errors = result.data.filter((r: any) => r.status === 'error');
      if (errors.length > 0) {
        console.error('[PUSH] ❌ Push notification API errors:', errors.length, 'errors found');
        errors.forEach((err: any, index: number) => {
          console.error(`[PUSH] ❌ Error ${index + 1}:`, {
            token: err.expoPushToken?.substring(0, 20) + '...',
            message: err.message,
            details: err.details,
          });
        });
        return false;
      }
      
      // Log success details
      const successes = result.data.filter((r: any) => r.status === 'ok');
      console.log('[PUSH] ✅ Successfully sent to', successes.length, 'recipient(s)');
    }

    console.log('[PUSH] ✅ Push notification sent successfully to', tokens.length, 'recipient(s)');
    return true;
  } catch (error: any) {
    console.error('[PUSH] ❌ Exception sending push notification:', error);
    console.error('[PUSH] ❌ Error message:', error?.message);
    console.error('[PUSH] ❌ Error stack:', error?.stack);
    return false;
  }
}

/**
 * Send notification to a specific user by their user ID
 * 🛠️ FIXED: Now uses users.push_token column via RPC function
 * 🔴 INCLUDES BADGE COUNT for app icon
 */
export async function sendNotificationToUser(
  userId: string,
  notification: Omit<PushNotificationData, 'id'> & { id?: string }
): Promise<boolean> {
  console.log('[PUSH] 👤 Sending notification to user...');
  console.log('[PUSH] Target user ID:', userId);
  console.log('[PUSH] Notification type:', notification.type);
  
  try {
    // 🛠️ FIXED: Use RPC function that bypasses RLS
    console.log('[PUSH] 🔍 Fetching user push token via RPC...');
    const { data: token, error } = await supabase
      .rpc('get_push_token', { p_user_id: userId });

    if (error) {
      console.error('[PUSH] ❌ RPC error fetching push token:', error);
      return false;
    }

    if (!token) {
      console.log('[PUSH] ⚠️ No push token found for user:', userId);
      return false;
    }

    console.log('[PUSH] ✅ Push token found for user');
    console.log('[PUSH] Token (first 20 chars):', token.substring(0, 20) + '...');

    // 🔴 GET UNREAD COUNT FOR BADGE
    console.log('[PUSH] 📊 Fetching unread notification count for badge...');
    const { count: unreadCount, error: badgeError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (badgeError) {
      console.error('[PUSH] ❌ Error fetching badge count:', badgeError);
      console.error('[PUSH] ⚠️ Continuing with badge count 0');
    }

    const badgeCount = (unreadCount || 0) + 1; // +1 for the notification we're about to create
    console.log('[PUSH] 🔴 Badge count:', badgeCount);

    // Send the notification with badge
    console.log('[PUSH] 📤 Calling sendPushNotification...');
    const sendResult = await sendPushNotification(token, notification, badgeCount);
    
    if (sendResult) {
      console.log('[PUSH] ✅ Notification sent successfully to user:', userId.substring(0, 8) + '...');
    } else {
      console.error('[PUSH] ❌ Failed to send notification to user:', userId.substring(0, 8) + '...');
    }
    
    return sendResult;
  } catch (error: any) {
    console.error('[PUSH] ❌ Exception sending notification to user:', userId.substring(0, 8) + '...');
    console.error('[PUSH] ❌ Error message:', error?.message);
    console.error('[PUSH] ❌ Error stack:', error?.stack);
    return false;
  }
}

/**
 * Send notification to multiple users
 * Useful for announcements and opportunities
 */
export async function sendNotificationToUsers(
  userIds: string[],
  notification: Omit<PushNotificationData, 'id'> & { id?: string }
): Promise<{ sent: number; failed: number }> {
  console.log('[PUSH] 👥 Sending notification to multiple users...');
  console.log('[PUSH] Number of users:', userIds.length);
  console.log('[PUSH] Notification type:', notification.type);
  
  try {
    // Fetch all push tokens for these users
    console.log('[PUSH] 🔍 Fetching push tokens for all users...');
    const { data: users, error } = await supabase
      .from('users')
      .select('id, push_token')
      .in('id', userIds);

    if (error) {
      console.error('[PUSH] ❌ Database error fetching push tokens:', error);
      console.error('[PUSH] ❌ Error code:', error.code);
      console.error('[PUSH] ❌ Error message:', error.message);
      console.error('[PUSH] ❌ Error details:', error.details);
      return { sent: 0, failed: userIds.length };
    }

    if (!users || users.length === 0) {
      console.log('[PUSH] ⚠️ No users found in database');
      return { sent: 0, failed: userIds.length };
    }

    // Filter out users without tokens
    const tokensToSend = users
      ?.filter(user => user.push_token)
      .map(user => user.push_token) || [];

    console.log('[PUSH] 📊 Found', tokensToSend.length, 'valid push tokens out of', userIds.length, 'users');
    console.log('[PUSH] 📊 Users without tokens:', userIds.length - tokensToSend.length);

    if (tokensToSend.length === 0) {
      console.log('[PUSH] ⚠️ No users with push tokens found');
      return { sent: 0, failed: userIds.length };
    }

    // 🔴 For bulk notifications, we send badge: 1 to all
    // Individual users will see different counts, but we can't query each individually
    // Badge will auto-update when they open the app
    console.log('[PUSH] 📤 Sending bulk notification to', tokensToSend.length, 'users...');
    const success = await sendPushNotification(tokensToSend, notification, 1);

    if (success) {
      console.log('[PUSH] ✅ Notifications sent to all users with tokens');
      return { sent: tokensToSend.length, failed: userIds.length - tokensToSend.length };
    } else {
      console.error('[PUSH] ❌ Failed to send notifications');
      return { sent: 0, failed: userIds.length };
    }
  } catch (error: any) {
    console.error('[PUSH] ❌ Exception sending notifications to users:', error);
    console.error('[PUSH] ❌ Error message:', error?.message);
    console.error('[PUSH] ❌ Error stack:', error?.stack);
    return { sent: 0, failed: userIds.length };
  }
}

/**
 * Clear badge count (call when user opens app or reads all notifications)
 * This removes the red dot from the app icon
 */
export async function clearBadgeCount(): Promise<void> {
  console.log('[PUSH] 🔴 Clearing badge count...');
  
  try {
    await Notifications.setBadgeCountAsync(0);
    console.log('[PUSH] ✅ Badge count cleared');
  } catch (error) {
    console.error('[PUSH] ❌ Error clearing badge count:', error);
  }
}

/**
 * Update badge count to show current unread notifications
 * Call this when user reads/deletes notifications
 */
export async function updateBadgeCount(userId: string): Promise<void> {
  console.log('[PUSH] 🔴 Updating badge count for user:', userId);
  
  try {
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    const badgeNumber = unreadCount || 0;
    console.log('[PUSH] 📊 Setting badge to:', badgeNumber);
    
    await Notifications.setBadgeCountAsync(badgeNumber);
    console.log('[PUSH] ✅ Badge count updated');
  } catch (error) {
    console.error('[PUSH] ❌ Error updating badge count:', error);
  }
}
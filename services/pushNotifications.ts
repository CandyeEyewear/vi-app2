import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure how notifications are handled when app is in foreground
// On web, this will be overridden by webNotifications.ts to show CustomAlert instead
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export interface PushNotificationData {
  type: 'circle_request' | 'announcement' | 'opportunity' | 'message' | 'cause' | 'event' | 'mention';
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
    // Guard against accidentally storing Expo tokens in the FCM token slot.
    // Expo tokens look like "ExponentPushToken[...]" / "ExpoPushToken[...]" and are not valid for FCM HTTP v1.
    if (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')) {
      console.error('[PUSH] ❌ Refusing to save Expo push token into users.push_token (expected FCM token)');
      return false;
    }

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
 * Send FCM notification via Supabase Edge Function
 */
async function sendFCMNotificationViaEdgeFunction(
  userId: string,
  title: string,
  body: string,
  data?: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('[FCM] ❌ Failed to get session:', sessionError);
      return { success: false, error: sessionError.message };
    }

    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      console.error('[FCM] ❌ No active auth session for Edge Function call');
      return { success: false, error: 'Not authenticated' };
    }

    const { data: result, error } = await supabase.functions.invoke(
      'send-fcm-notification',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: { userId, title, body, data },
      }
    );

    if (error) {
      console.error('[FCM] Error:', error);
      return { success: false, error: error.message };
    }

    // Function returns JSON payload even on failure (always 200)
    if (result?.success === true) {
      console.log('[FCM] ✅ Sent:', result);
      return { success: true };
    }

    const message =
      result?.error ||
      result?.hint ||
      'Failed to send push notification (unknown error)';
    console.error('[FCM] ❌ Failed:', result);
    return { success: false, error: message };
  } catch (error: any) {
    console.error('[FCM] ❌ Error:', error);
    return { success: false, error: error.message };
  }
}

function isUnregisteredFcmError(error?: string): boolean {
  if (!error) return false;
  const normalized = error.toLowerCase();
  return normalized.includes('unregistered') || normalized.includes('requested entity was not found');
}

function isTransientEmailError(error?: string): boolean {
  if (!error) return false;
  const normalized = error.toLowerCase();
  return (
    normalized.includes('non-2xx') ||
    normalized.includes('500') ||
    normalized.includes('502') ||
    normalized.includes('503') ||
    normalized.includes('504') ||
    normalized.includes('timeout') ||
    normalized.includes('network')
  );
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send a test push notification to the current user.
 * Returns a helpful error string if delivery could not be initiated.
 */
export async function sendTestPushToSelf(userId: string): Promise<{ success: boolean; error?: string }> {
  return await sendFCMNotificationViaEdgeFunction(
    userId,
    'Test push notification',
    'If you can read this, push delivery is working.',
    {
      type: 'announcement',
      id: 'self_test',
      source: 'settings_test',
    }
  );
}

/**
 * Send notification to a specific user by their user ID
 * 🔥 UPDATED: Now uses FCM via Supabase Edge Function
 */
export async function sendNotificationToUser(
  userId: string,
  notification: Omit<PushNotificationData, 'id'> & { id?: string }
): Promise<boolean> {
  console.log('[PUSH] 👤 Sending notification to user...');
  console.log('[PUSH] Target user ID:', userId);
  console.log('[PUSH] Notification type:', notification.type);
  
  try {
    // Prepare notification data
    const notificationData = {
      type: notification.type,
      id: notification.id,
      ...notification.data,
    };

    // Send via FCM Edge Function
    const result = await sendFCMNotificationViaEdgeFunction(
      userId,
      notification.title,
      notification.body,
      notificationData
    );

    if (result.success) {
      console.log('[PUSH] ✅ Notification sent successfully to user:', userId.substring(0, 8) + '...');
      return true;
    } else {
      console.error('[PUSH] ❌ Failed to send notification:', result.error);
      if (isUnregisteredFcmError(result.error)) {
        console.warn('[PUSH] Stale FCM token detected; clearing token for user:', userId.substring(0, 8) + '...');
        await removePushToken(userId);
      }
      return false;
    }
  } catch (error: any) {
    console.error('[PUSH] ❌ Exception sending notification to user:', userId.substring(0, 8) + '...');
    console.error('[PUSH] ❌ Error message:', error?.message);
    console.error('[PUSH] ❌ Error stack:', error?.stack);
    return false;
  }
}

/**
 * Send notification to multiple users
 * 🔥 UPDATED: Now uses FCM via Supabase Edge Function (loops through each user)
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
    // Prepare notification data
    const notificationData = {
      type: notification.type,
      id: notification.id,
      ...notification.data,
    };

    let sent = 0;
    let failed = 0;

    // Loop through each user and send FCM notification
    console.log('[PUSH] 📤 Sending FCM notifications to', userIds.length, 'users...');
    
    for (const userId of userIds) {
      try {
        const result = await sendFCMNotificationViaEdgeFunction(
          userId,
          notification.title,
          notification.body,
          notificationData
        );

        if (result.success) {
          sent++;
          console.log(`[PUSH] ✅ Sent to user ${userId.substring(0, 8)}... (${sent}/${userIds.length})`);
        } else {
          failed++;
          console.error(`[PUSH] ❌ Failed for user ${userId.substring(0, 8)}...:`, result.error);
        }
      } catch (error: any) {
        failed++;
        console.error(`[PUSH] ❌ Exception for user ${userId.substring(0, 8)}...:`, error?.message);
      }
    }

    console.log('[PUSH] 📊 Summary:', { sent, failed, total: userIds.length });
    return { sent, failed };
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

/**
 * Send email notification via Supabase Edge Function
 * The Edge Function handles throttling, user preferences, and online status checks
 */
export async function sendEmailNotification(
  recipientUserId: string,
  type: 'message' | 'circle_request' | 'announcement' | 'opportunity' | 'event' | 'cause',
  data: {
    senderName?: string;
    senderAvatarUrl?: string;
    messagePreview?: string;
    conversationId?: string;
    title?: string;
    description?: string;
    slug?: string;
    id?: string;
  }
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  console.log('[EMAIL] 📧 Sending email notification...');
  console.log('[EMAIL] Recipient:', recipientUserId.substring(0, 8) + '...');
  console.log('[EMAIL] Type:', type);

  const invokeOnce = async (): Promise<{ result?: any; errorMessage?: string }> => {
    const { data: result, error } = await supabase.functions.invoke(
      'send-notification-email',
      {
        body: { recipientUserId, type, data },
      }
    );
    if (error) return { errorMessage: error.message };
    return { result };
  };

  try {
    let { result, errorMessage } = await invokeOnce();

    if (errorMessage && isTransientEmailError(errorMessage)) {
      console.warn('[EMAIL] Transient invoke error; retrying once:', errorMessage);
      await delay(750);
      const retry = await invokeOnce();
      result = retry.result;
      errorMessage = retry.errorMessage;
    }

    if (errorMessage) {
      console.warn('[EMAIL] Edge Function invoke failed:', errorMessage);
      return { success: false, error: errorMessage };
    }

    if (result?.success) {
      if (result.skipped) {
        console.log('[EMAIL] ⏭️ Email skipped:', result.reason);
        return { success: true, skipped: true };
      }
      console.log('[EMAIL] ✅ Email notification sent successfully');
      return { success: true };
    }

    const resultError = result?.error || 'Unknown error';
    console.warn('[EMAIL] Email notification not sent:', resultError);
    return { success: false, error: resultError };
  } catch (error: any) {
    console.warn('[EMAIL] Exception sending email notification:', error);
    return { success: false, error: error.message };
  }
}

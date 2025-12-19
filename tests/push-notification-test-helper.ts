/**
 * Push Notification Test Helper
 * 
 * This helper can be used in development to quickly test push notifications.
 * You can import and use these functions in your app (e.g., in Settings screen or a debug menu).
 * 
 * Usage example:
 * ```typescript
 * import { testPushNotifications } from './tests/push-notification-test-helper';
 * 
 * // In your component
 * const handleTest = async () => {
 *   const results = await testPushNotifications(userId);
 *   console.log('Test Results:', results);
 * };
 * ```
 */

import { supabase } from '../services/supabase';
import {
  registerForFCMNotifications,
  savePushToken,
  sendTestPushToSelf,
  clearBadgeCount,
  updateBadgeCount,
} from '../services/pushNotifications';

export interface PushNotificationTestResults {
  registration: {
    success: boolean;
    hasToken: boolean;
    token?: string;
    error?: string;
  };
  database: {
    success: boolean;
    tokenInDb?: string | null;
    error?: string;
  };
  sendTest: {
    success: boolean;
    error?: string;
  };
  badge: {
    success: boolean;
    error?: string;
  };
  overall: boolean;
}

/**
 * Run a complete push notification test
 * Tests registration, database persistence, sending, and badge management
 */
export async function testPushNotifications(userId: string): Promise<PushNotificationTestResults> {
  const results: PushNotificationTestResults = {
    registration: { success: false, hasToken: false },
    database: { success: false },
    sendTest: { success: false },
    badge: { success: false },
    overall: false,
  };

  console.log('🧪 [PUSH TEST] Starting push notification test...');
  console.log('🧪 [PUSH TEST] User ID:', userId);

  // Test 1: Registration
  console.log('🧪 [PUSH TEST] Step 1: Testing FCM registration...');
  try {
    const token = await registerForFCMNotifications();
    if (token) {
      results.registration = {
        success: true,
        hasToken: true,
        token: token.substring(0, 20) + '...', // First 20 chars for logging
      };
      console.log('🧪 [PUSH TEST] ✅ Registration successful');

      // Try to save token
      const saveResult = await savePushToken(userId, token);
      if (saveResult) {
        results.database.success = true;
        results.database.tokenInDb = token.substring(0, 20) + '...';
        console.log('🧪 [PUSH TEST] ✅ Token saved to database');
      } else {
        results.database.error = 'Failed to save token to database';
        console.log('🧪 [PUSH TEST] ❌ Failed to save token');
      }
    } else {
      results.registration.error = 'No token received (may be simulator or permissions denied)';
      console.log('🧪 [PUSH TEST] ⚠️ No token received');
    }
  } catch (error: any) {
    results.registration.error = error?.message || 'Unknown error';
    console.error('🧪 [PUSH TEST] ❌ Registration error:', error);
  }

  // Test 2: Check database
  console.log('🧪 [PUSH TEST] Step 2: Checking database...');
  try {
    const { data, error } = await supabase
      .from('users')
      .select('push_token')
      .eq('id', userId)
      .single();

    if (error) {
      results.database.error = error.message;
      console.log('🧪 [PUSH TEST] ❌ Database error:', error.message);
    } else {
      results.database.tokenInDb = data?.push_token 
        ? data.push_token.substring(0, 20) + '...' 
        : null;
      console.log('🧪 [PUSH TEST] ✅ Database check complete');
    }
  } catch (error: any) {
    results.database.error = error?.message || 'Unknown error';
    console.error('🧪 [PUSH TEST] ❌ Database check error:', error);
  }

  // Test 3: Send test notification
  console.log('🧪 [PUSH TEST] Step 3: Sending test notification...');
  try {
    const testResult = await sendTestPushToSelf(userId);
    results.sendTest.success = testResult.success;
    if (!testResult.success) {
      results.sendTest.error = testResult.error || 'Unknown error';
      console.log('🧪 [PUSH TEST] ❌ Test notification failed:', testResult.error);
    } else {
      console.log('🧪 [PUSH TEST] ✅ Test notification sent successfully');
    }
  } catch (error: any) {
    results.sendTest.error = error?.message || 'Unknown error';
    console.error('🧪 [PUSH TEST] ❌ Test notification error:', error);
  }

  // Test 4: Badge management
  console.log('🧪 [PUSH TEST] Step 4: Testing badge management...');
  try {
    await clearBadgeCount();
    await updateBadgeCount(userId);
    results.badge.success = true;
    console.log('🧪 [PUSH TEST] ✅ Badge management working');
  } catch (error: any) {
    results.badge.error = error?.message || 'Unknown error';
    console.error('🧪 [PUSH TEST] ❌ Badge management error:', error);
  }

  // Overall result
  results.overall =
    results.registration.success &&
    results.database.success &&
    results.sendTest.success &&
    results.badge.success;

  console.log('🧪 [PUSH TEST] ==========================================');
  console.log('🧪 [PUSH TEST] Test Results Summary:');
  console.log('🧪 [PUSH TEST] - Registration:', results.registration.success ? '✅' : '❌');
  console.log('🧪 [PUSH TEST] - Database:', results.database.success ? '✅' : '❌');
  console.log('🧪 [PUSH TEST] - Send Test:', results.sendTest.success ? '✅' : '❌');
  console.log('🧪 [PUSH TEST] - Badge:', results.badge.success ? '✅' : '❌');
  console.log('🧪 [PUSH TEST] - Overall:', results.overall ? '✅ PASS' : '❌ FAIL');
  console.log('🧪 [PUSH TEST] ==========================================');

  return results;
}

/**
 * Quick test: Just check if token exists in database
 */
export async function quickTokenCheck(userId: string): Promise<{
  hasToken: boolean;
  token?: string | null;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('push_token')
      .eq('id', userId)
      .single();

    if (error) {
      return { hasToken: false, error: error.message };
    }

    return {
      hasToken: !!data?.push_token,
      token: data?.push_token ? data.push_token.substring(0, 20) + '...' : null,
    };
  } catch (error: any) {
    return { hasToken: false, error: error?.message || 'Unknown error' };
  }
}

/**
 * Force re-register for push notifications
 * Useful when token seems invalid or needs refresh
 */
export async function forceReregister(userId: string): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  console.log('🔄 [PUSH] Force re-registering for push notifications...');
  
  try {
    const token = await registerForFCMNotifications();
    
    if (!token) {
      return {
        success: false,
        error: 'Failed to get FCM token. Check device and permissions.',
      };
    }

    const saveResult = await savePushToken(userId, token);
    
    if (!saveResult) {
      return {
        success: false,
        error: 'Failed to save token to database',
      };
    }

    console.log('🔄 [PUSH] ✅ Re-registration successful');
    return {
      success: true,
      token: token.substring(0, 20) + '...',
    };
  } catch (error: any) {
    console.error('🔄 [PUSH] ❌ Re-registration error:', error);
    return {
      success: false,
      error: error?.message || 'Unknown error',
    };
  }
}

/**
 * Get detailed push notification status
 */
export async function getPushNotificationStatus(userId: string): Promise<{
  hasToken: boolean;
  token?: string | null;
  tokenAge?: string;
  permissions?: {
    expo?: string;
    fcm?: string;
  };
  error?: string;
}> {
  try {
    // Check database token
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('push_token, updated_at')
      .eq('id', userId)
      .single();

    if (dbError) {
      return { hasToken: false, error: dbError.message };
    }

    const hasToken = !!userData?.push_token;
    let tokenAge: string | undefined;
    
    if (userData?.updated_at) {
      const updatedAt = new Date(userData.updated_at);
      const now = new Date();
      const diffMs = now.getTime() - updatedAt.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      if (diffDays > 0) {
        tokenAge = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      } else if (diffHours > 0) {
        tokenAge = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else {
        tokenAge = 'Just now';
      }
    }

    return {
      hasToken,
      token: userData?.push_token ? userData.push_token.substring(0, 20) + '...' : null,
      tokenAge,
    };
  } catch (error: any) {
    return { hasToken: false, error: error?.message || 'Unknown error' };
  }
}


/**
 * Auth Side Effects Hook
 * Handles post-authentication tasks like push notifications, CRM sync, and emails
 * These are non-blocking and should not affect auth flow if they fail
 */

import { useCallback } from 'react';
import { Platform } from 'react-native';
import type { User } from '../types';
import { logger } from '../utils/logger';

// Import existing services
import { registerForFCMNotifications } from '../services/fcmNotifications';
import { savePushToken, removePushToken } from '../services/pushNotifications';
import { syncContactToHubSpot } from '../services/hubspotService';
import { sendWelcomeEmail } from '../services/resendService';

interface AuthSideEffectsOptions {
  onError?: (error: Error, context: string) => void;
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);

  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error('Unknown error');
  }
}

export function useAuthSideEffects(options: AuthSideEffectsOptions = {}) {
  const { onError } = options;

  const handleError = useCallback(
    (error: unknown, context: string) => {
      const err = toError(error);
      logger.error(`[AUTH SIDE EFFECTS] ${context}`, err);
      onError?.(err, context);
    },
    [onError]
  );

  /**
   * Run side effects after successful sign in
   */
  const onSignIn = useCallback(
    async (user: User) => {
      // Register for push notifications (non-blocking)
      if (Platform.OS !== 'web') {
        try {
          const token = await registerForFCMNotifications();
          if (token) {
            const saved = await savePushToken(user.id, token);
            if (saved) {
              logger.info('[AUTH SIDE EFFECTS] Push token saved');
            } else {
              logger.warn('[AUTH SIDE EFFECTS] Failed to save push token');
            }
          }
        } catch (error) {
          handleError(error, 'Push notification registration');
        }
      }
    },
    [handleError]
  );

  /**
   * Run side effects after successful sign up
   */
  const onSignUp = useCallback(
    async (user: User, isOrganization: boolean = false) => {
      // Register for push notifications (non-blocking)
      if (Platform.OS !== 'web') {
        try {
          const token = await registerForFCMNotifications();
          if (token) {
            const saved = await savePushToken(user.id, token);
            if (saved) {
              logger.info('[AUTH SIDE EFFECTS] Push token saved');
            } else {
              logger.warn('[AUTH SIDE EFFECTS] Failed to save push token');
            }
          }
        } catch (error) {
          handleError(error, 'Push notification registration');
        }
      }

      // Sync to HubSpot (non-blocking)
      try {
        const hubspotResult = await syncContactToHubSpot({
          email: user.email,
          fullName: user.fullName,
          phone: user.phone || undefined,
          location: user.location || undefined,
          bio: user.bio,
          areasOfExpertise: user.areasOfExpertise,
          education: user.education,
        });

        if (hubspotResult.success) {
          logger.info('[AUTH SIDE EFFECTS] HubSpot sync complete');
        } else {
          handleError(
            new Error(hubspotResult.error || 'HubSpot sync failed'),
            'HubSpot sync'
          );
        }
      } catch (error) {
        handleError(error, 'HubSpot sync');
      }

      // Send welcome email (non-blocking)
      try {
        const result = await sendWelcomeEmail(user.email, user.fullName || 'Volunteer');
        if (result.success) {
          logger.info('[AUTH SIDE EFFECTS] Welcome email sent');
        } else {
          handleError(new Error(result.error || 'Welcome email failed'), 'Welcome email');
        }
      } catch (error) {
        handleError(error, 'Welcome email');
      }

      // Note: isOrganization is accepted for future parity, but the current
      // HubSpot sync function doesn’t support an accountType field.
      void isOrganization;
    },
    [handleError]
  );

  /**
   * Clean up side effects on sign out
   */
  const onSignOut = useCallback(
    async (userId: string) => {
      // Remove push token (non-blocking)
      if (Platform.OS !== 'web') {
        try {
          const removed = await removePushToken(userId);
          if (removed) {
            logger.info('[AUTH SIDE EFFECTS] Push token removed');
          } else {
            logger.warn('[AUTH SIDE EFFECTS] Failed to remove push token');
          }
        } catch (error) {
          handleError(error, 'Push token removal');
        }
      }
    },
    [handleError]
  );

  return {
    onSignIn,
    onSignUp,
    onSignOut,
  };
}

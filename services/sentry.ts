/**
 * Sentry Error Tracking Service
 * Captures crashes and errors in production
 * File: services/sentry.ts
 */

import * as Sentry from '@sentry/react-native';

// Only enable Sentry in production builds
const IS_PRODUCTION = !__DEV__;

// Sentry DSN
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || 'https://e3cd7fd70496e616a2ed41f8085eaee3@o4510512782180352.ingest.us.sentry.io/4510512792600576';

/**
 * Initialize Sentry
 * Call this early in your app startup (e.g., in _layout.tsx)
 */
export function initSentry(): void {
  if (!IS_PRODUCTION) {
    console.log('[Sentry] Skipping initialization in development mode');
    return;
  }

  if (!SENTRY_DSN) {
    console.warn('[Sentry] No DSN configured - error tracking disabled');
    return;
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: IS_PRODUCTION ? 'production' : 'development',
      tracesSampleRate: 0.2,
      enabled: IS_PRODUCTION,
      
      beforeSend(event) {
        // Remove sensitive data before sending
        if (event.request?.data) {
          delete event.request.data;
        }
        return event;
      },
      
      ignoreErrors: [
        'Network request failed',
        'Failed to fetch',
        'AbortError',
        'User cancelled',
        'cancelled',
      ],
    });

    console.log('[Sentry] Initialized successfully');
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error);
  }
}

/**
 * Capture an exception
 */
export function captureException(
  error: Error | unknown,
  context?: Record<string, any>
): void {
  if (!IS_PRODUCTION) {
    console.error('[Sentry] Would capture exception:', error, context);
    return;
  }

  try {
    if (context) {
      Sentry.withScope((scope) => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  } catch (sentryError) {
    console.error('[Sentry] Failed to capture exception:', sentryError);
  }
}

/**
 * Capture a message
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
): void {
  if (!IS_PRODUCTION) {
    console.log(`[Sentry] Would capture message (${level}):`, message, context);
    return;
  }

  try {
    if (context) {
      Sentry.withScope((scope) => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
        Sentry.captureMessage(message, level);
      });
    } else {
      Sentry.captureMessage(message, level);
    }
  } catch (sentryError) {
    console.error('[Sentry] Failed to capture message:', sentryError);
  }
}

/**
 * Set user context (call after login)
 */
export function setUser(userId: string | null, accountType?: string): void {
  if (!IS_PRODUCTION) {
    console.log('[Sentry] Would set user:', userId);
    return;
  }

  try {
    if (userId) {
      Sentry.setUser({
        id: userId,
        ...(accountType && { accountType }),
      });
    } else {
      Sentry.setUser(null);
    }
  } catch (error) {
    console.error('[Sentry] Failed to set user:', error);
  }
}

/**
 * Clear user context (call on logout)
 */
export function clearUser(): void {
  setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, any>,
  level: 'info' | 'warning' | 'error' = 'info'
): void {
  if (!IS_PRODUCTION) return;

  try {
    Sentry.addBreadcrumb({
      category,
      message,
      data,
      level,
    });
  } catch (error) {
    // Silently fail
  }
}

export { Sentry };

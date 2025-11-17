/**
 * Sentry Error Tracking
 * 
 * To enable Sentry:
 * 1. Install: npm install @sentry/react-native
 * 2. Get your DSN from https://sentry.io
 * 3. Uncomment the code below and add your DSN
 * 4. Update app/_layout.tsx to initialize Sentry
 */

// Uncomment when ready to use Sentry:
/*
import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || 'YOUR_SENTRY_DSN_HERE';

export function initSentry() {
  if (!SENTRY_DSN || SENTRY_DSN === 'YOUR_SENTRY_DSN_HERE') {
    console.warn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    enableInExpoDevelopment: false, // Disable in development
    debug: __DEV__, // Enable debug mode in development
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 1.0, // Adjust based on your needs (0.0 to 1.0)
    beforeSend(event, hint) {
      // Filter out sensitive data
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers?.Authorization;
      }
      return event;
    },
  });
}

export { Sentry };
*/

// Placeholder exports for when Sentry is not enabled
export const initSentry = () => {
  // No-op when Sentry is not configured
};

export const Sentry = {
  captureException: (error: any, context?: any) => {
    if (__DEV__) {
      console.error('Sentry not configured. Error:', error, context);
    }
  },
  captureMessage: (message: string, level?: any) => {
    if (__DEV__) {
      console.log('Sentry not configured. Message:', message, level);
    }
  },
};


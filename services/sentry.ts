import { Platform } from 'react-native';

type SentryModule = typeof import('@sentry/react-native');

// Sentry React Native doesn't work on web
const IS_WEB = Platform.OS === 'web';
const IS_PRODUCTION = !__DEV__;
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || '';

let sentryModule: SentryModule | null = null;
let hasInitialized = false;

function getSentry(): SentryModule | null {
  if (IS_WEB) {
    return null;
  }

  if (sentryModule) {
    return sentryModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sentryModule = require('@sentry/react-native');
  } catch (error) {
    console.warn('[Sentry] Module not available. Did you install @sentry/react-native?', error);
    sentryModule = null;
  }

  return sentryModule;
}

export function initSentry(): void {
  // Skip on web - @sentry/react-native doesn't support web
  if (IS_WEB) {
    console.log('[Sentry] Skipping initialization on web platform');
    return;
  }

  if (!IS_PRODUCTION) {
    console.log('[Sentry] Skipping initialization in development mode');
    return;
  }

  if (hasInitialized) {
    return;
  }

  if (!SENTRY_DSN) {
    console.warn('[Sentry] Missing DSN. Error tracking disabled.');
    return;
  }

  const sentry = getSentry();
  if (!sentry) {
    return;
  }

  sentry.init({
    dsn: SENTRY_DSN,
    enableInExpoDevelopment: false,
    environment: 'production',
    tracesSampleRate: 1.0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers?.Authorization;
      }
      return event;
    },
  });

  hasInitialized = true;
}

export function captureException(
  error: Error | unknown,
  context?: Record<string, any>
): void {
  if (IS_WEB || !IS_PRODUCTION) {
    console.error('[Sentry] Would capture exception:', error, context);
    return;
  }

  const sentry = getSentry();
  if (!sentry || !hasInitialized) {
    return;
  }

  const exception = error instanceof Error ? error : new Error(String(error));
  sentry.captureException(exception, context ? { extra: context } : undefined);
}

export function captureMessage(
  message: string,
  level?: Parameters<SentryModule['captureMessage']>[1]
): void {
  if (IS_WEB || !IS_PRODUCTION) {
    console.log('[Sentry] Would capture message:', message, level);
    return;
  }

  const sentry = getSentry();
  if (!sentry || !hasInitialized) {
    return;
  }

  sentry.captureMessage(message, level);
}

export const Sentry = {
  captureException,
  captureMessage,
};


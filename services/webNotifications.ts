/**
 * Web Notification Service
 * Intercepts notifications on web and displays them as CustomAlert instead of native browser notifications
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { AlertType } from '../components/CustomAlert';

// Global state for web notification alerts
let webNotificationCallback: ((config: {
  type: AlertType;
  title: string;
  message: string;
  onPress?: () => void;
}) => void) | null = null;

/**
 * Register callback to show custom alerts for web notifications
 */
export function setWebNotificationHandler(
  callback: (config: {
    type: AlertType;
    title: string;
    message: string;
    onPress?: () => void;
  }) => void
) {
  webNotificationCallback = callback;
}

/**
 * Setup web notification handler to intercept and display as CustomAlert
 */
export function setupWebNotificationHandler(
  navigate?: (path: string) => void
) {
  // Only setup on web
  if (Platform.OS !== 'web') {
    return;
  }

  console.log('[WEB NOTIFICATIONS] 🔧 Setting up web notification handler');

  // Override notification handler to prevent native browser notifications
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      // Return config that prevents native browser notification
      return {
        shouldShowAlert: false, // Don't show native alert
        shouldPlaySound: true, // Still play sound
        shouldSetBadge: true, // Still update badge
      };
    },
  });

  // Listen for incoming notifications
  const subscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('[WEB NOTIFICATIONS] 📬 Notification received:', notification);

      if (!webNotificationCallback) {
        console.warn('[WEB NOTIFICATIONS] ⚠️ No callback registered for web notifications');
        return;
      }

      const { title, body, data } = notification.request.content;
      
      // Determine alert type based on notification data or default to 'info'
      let alertType: AlertType = 'info';
      if (data?.type) {
        // Map notification types to alert types
        switch (data.type) {
          case 'circle_request':
          case 'message':
          case 'announcement':
            alertType = 'info';
            break;
          case 'opportunity_approved':
          case 'opportunity_submitted':
            alertType = 'success';
            break;
          case 'opportunity_rejected':
            alertType = 'error';
            break;
          default:
            alertType = 'info';
        }
      }

      // Create navigation handler if navigate function is provided
      const onPress = navigate && data?.type && data?.id
        ? () => {
            handleNotificationNavigation(data, navigate);
          }
        : undefined;

      // Show custom alert
      webNotificationCallback({
        type: alertType,
        title: title || 'VIbe',
        message: body || '',
        onPress,
      });
    }
  );

  console.log('[WEB NOTIFICATIONS] ✅ Web notification handler setup complete');

  return () => {
    subscription.remove();
  };
}

/**
 * Handle navigation based on notification data
 */
function handleNotificationNavigation(
  data: any,
  navigate: (path: string) => void
) {
  if (!data.type || !data.id) {
    return;
  }

  switch (data.type) {
    case 'circle_request':
      navigate(`/profile/${data.slug || data.id}`);
      break;
    case 'announcement':
      navigate('/feed');
      break;
    case 'opportunity':
      navigate(`/opportunity/${data.slug || data.id}`);
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
      navigate(`/opportunity/${data.slug || data.id}`);
      break;
    case 'cause':
      navigate(`/causes/${data.slug || data.id}`);
      break;
    case 'event':
      navigate(`/events/${data.slug || data.id}`);
      break;
    default:
      console.log('[WEB NOTIFICATIONS] ⚠️ Unknown notification type:', data.type);
  }
}


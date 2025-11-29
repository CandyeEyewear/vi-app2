import { Alert, Platform, ToastAndroid } from 'react-native';

type ToastType = 'success' | 'error' | 'warning' | 'info';

const TITLE_MAP: Record<ToastType, string> = {
  success: 'Success',
  error: 'Error',
  warning: 'Warning',
  info: 'Notice',
};

/**
 * Lightweight cross-platform toast helper. Uses native toasts on Android,
 * alerts on iOS, and console logs on web as a graceful fallback.
 */
export function showToast(message: string, type: ToastType = 'info') {
  const title = TITLE_MAP[type] ?? TITLE_MAP.info;

  if (Platform.OS === 'android') {
    ToastAndroid.showWithGravity(
      message,
      ToastAndroid.SHORT,
      ToastAndroid.BOTTOM
    );
    return;
  }

  if (Platform.OS === 'web') {
    console.log(`[${title}] ${message}`);
    return;
  }

  Alert.alert(title, message);
}

export default showToast;

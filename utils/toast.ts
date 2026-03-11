import { Platform } from 'react-native';

export type ToastType = 'success' | 'error' | 'warning';

type ToastListener = (message: string, type: ToastType) => void;

const listeners: ToastListener[] = [];

export function subscribeToToast(listener: ToastListener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

export const showToast = (message: string, type: ToastType): void => {
  console.log(`${type.toUpperCase()}: ${message}`);
  if (listeners.length > 0) {
    listeners.forEach(l => l(message, type));
  } else {
    // Fallback if Toast component not mounted yet
    if (Platform.OS === 'web') {
      console.warn('Toast not mounted, message:', message);
    }
  }
};

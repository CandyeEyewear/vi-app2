/**
 * useAlert Hook
 * Easy-to-use hook for showing custom alerts
 * Usage: const { showAlert } = useAlert();
 */

import { useState, useCallback } from 'react';
import { AlertType, AlertButton } from '../components/CustomAlert';

interface AlertConfig {
  type?: AlertType;
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

export function useAlert() {
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
  const [visible, setVisible] = useState(false);

  const showAlert = useCallback((config: AlertConfig) => {
    setAlertConfig(config);
    setVisible(true);
  }, []);

  const hideAlert = useCallback(() => {
    setVisible(false);
    // Clear config after animation
    setTimeout(() => setAlertConfig(null), 300);
  }, []);

  return {
    alertProps: {
      visible,
      type: alertConfig?.type || 'info',
      title: alertConfig?.title || '',
      message: alertConfig?.message,
      buttons: alertConfig?.buttons,
      onClose: hideAlert,
    },
    showAlert,
    hideAlert,
  };
}

// Convenience functions that match Alert.alert() API
export const showSuccessAlert = (
  title: string,
  message?: string,
  buttons?: AlertButton[]
) => ({
  type: 'success' as AlertType,
  title,
  message,
  buttons: buttons || [{ text: 'OK', style: 'default' as const }],
});

export const showErrorAlert = (
  title: string,
  message?: string,
  buttons?: AlertButton[]
) => ({
  type: 'error' as AlertType,
  title,
  message,
  buttons: buttons || [{ text: 'OK', style: 'default' as const }],
});

export const showWarningAlert = (
  title: string,
  message?: string,
  buttons?: AlertButton[]
) => ({
  type: 'warning' as AlertType,
  title,
  message,
  buttons: buttons || [{ text: 'OK', style: 'default' as const }],
});

export const showInfoAlert = (
  title: string,
  message?: string,
  buttons?: AlertButton[]
) => ({
  type: 'info' as AlertType,
  title,
  message,
  buttons: buttons || [{ text: 'OK', style: 'default' as const }],
});

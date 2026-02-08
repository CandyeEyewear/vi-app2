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

import { useAlertContext } from '../contexts/AlertContext';

export function useAlert() {
  return useAlertContext();
}

// ---- Standardized helpers (consistent titles + default buttons) ----
const normalizeTitle = (title?: string, fallback: string = 'Notice') => {
  const t = (title || '').trim();
  return t.length ? t : fallback;
};

export const alertSuccess = (message: string, title: string = 'Success', buttons?: AlertButton[]) => ({
  type: 'success' as AlertType,
  title: normalizeTitle(title, 'Success'),
  message,
  buttons: buttons || [{ text: 'OK', style: 'default' as const }],
});

export const alertError = (message: string, title: string = 'Error', buttons?: AlertButton[]) => ({
  type: 'error' as AlertType,
  title: normalizeTitle(title, 'Error'),
  message,
  buttons: buttons || [{ text: 'OK', style: 'default' as const }],
});

export const alertWarning = (message: string, title: string = 'Warning', buttons?: AlertButton[]) => ({
  type: 'warning' as AlertType,
  title: normalizeTitle(title, 'Warning'),
  message,
  buttons: buttons || [{ text: 'OK', style: 'default' as const }],
});

export const alertInfo = (message: string, title: string = 'Notice', buttons?: AlertButton[]) => ({
  type: 'info' as AlertType,
  title: normalizeTitle(title, 'Notice'),
  message,
  buttons: buttons || [{ text: 'OK', style: 'default' as const }],
});

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

/**
 * Custom Alert Component
 * Themed alert modal to replace native Alert.alert()
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react-native';
import { Colors } from '../constants/colors';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertProps {
  visible: boolean;
  type?: AlertType;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  onClose: () => void;
  onConfirm?: () => void; // NEW
  showCancel?: boolean; // NEW
}

export default function CustomAlert({
  visible,
  type = 'info',
  title,
  message,
  buttons,
  onClose,
  onConfirm, // NEW
  showCancel = false, // NEW
}: CustomAlertProps) {
  // Avoid noisy logs on every render (especially when hidden)
  if (__DEV__ && visible) {
    console.log('[CUSTOM ALERT] Rendering:', { visible, title, message });
  }

  // NEW: Build buttons based on props
  const finalButtons: AlertButton[] = buttons || (
    showCancel && onConfirm
      ? [
          { text: 'Cancel', style: 'cancel', onPress: onClose },
          { text: 'Confirm', style: type === 'error' ? 'destructive' : 'default', onPress: onConfirm },
        ]
      : [{ text: 'OK', style: 'default', onPress: onClose }]
  );
  
  const getIcon = () => {
    const iconSize = 48;
    switch (type) {
      case 'success':
        return <CheckCircle size={iconSize} color={Colors.light.success} />;
      case 'error':
        return <XCircle size={iconSize} color={Colors.light.error} />;
      case 'warning':
        return <AlertCircle size={iconSize} color="#FF9800" />;
      case 'info':
      default:
        return <Info size={iconSize} color={Colors.light.primary} />;
    }
  };

  const handleButtonPress = (button: AlertButton) => {
    if (button.onPress) {
      button.onPress();
    }
    // Don't auto-close if button has its own onPress
    if (!button.onPress) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.alertBox}>
              {/* Icon */}
              <View style={styles.iconContainer}>
                {getIcon()}
              </View>

              {/* Title */}
              <Text style={styles.title}>{String(title)}</Text>

              {/* Message */}
              {message && (
                <Text style={styles.message}>{String(message)}</Text>
              )}

              {/* Buttons */}
              <View style={styles.buttonsContainer}>
                {finalButtons.map((button, index) => {
                  const isDestructive = button.style === 'destructive';
                  const isCancel = button.style === 'cancel';
                  const isLast = index === finalButtons.length - 1;

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.button,
                        isDestructive && styles.buttonDestructive,
                        isCancel && styles.buttonCancel,
                        !isLast && styles.buttonMargin,
                      ]}
                      onPress={() => handleButtonPress(button)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          isDestructive && styles.buttonTextDestructive,
                          isCancel && styles.buttonTextCancel,
                        ]}
                      >
                        {String(button.text)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertBox: {
    backgroundColor: Colors.light.background,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonsContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonMargin: {
    marginRight: 0,
  },
  buttonCancel: {
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  buttonDestructive: {
    backgroundColor: Colors.light.error,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonTextCancel: {
    color: Colors.light.text,
  },
  buttonTextDestructive: {
    color: '#FFFFFF',
  },
});
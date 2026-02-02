/**
 * Profile Action Sheet Component
 * Shows popup menu with "View Profile" and "Send Message" options
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { User as LucideUser, MessageCircle, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { useMessaging } from '../contexts/MessagingContext';
import CustomAlert from './CustomAlert';
import { useAlert, showErrorAlert } from '../hooks/useAlert';

interface ProfileActionSheetProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

export default function ProfileActionSheet({
  visible,
  onClose,
  userId,
  userName,
}: ProfileActionSheetProps) {
  const router = useRouter();
  const { getOrCreateConversation } = useMessaging();
  const { alertProps, showAlert } = useAlert();

  const handleViewProfile = () => {
    onClose();
    // Use href for dynamic routes - more reliable than push
    router.push({
      pathname: '/profile/[id]',
      params: { id: userId }
    } as any);
  };

  const handleSendMessage = async () => {
    try {
      // Get or create conversation with this user
      const response = await getOrCreateConversation(userId);

      if (response.success && response.data) {
        // Close modal first, then navigate
        onClose();
        // Small delay to ensure modal is closed before navigation
        setTimeout(() => {
          router.push({
            pathname: '/conversation/[id]',
            params: { id: response.data!.id }
          } as any);
        }, 100);
      } else {
        // Show error while modal is still open
        showAlert(showErrorAlert('Error', response.error || 'Failed to start conversation'));
      }
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      showAlert(showErrorAlert('Error', error?.message || 'Failed to start conversation'));
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
            <View style={styles.sheet}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>{userName}</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <X size={24} color={Colors.light.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Actions */}
              <TouchableOpacity style={styles.actionButton} onPress={handleViewProfile}>
                <View style={styles.actionIcon}>
                  <LucideUser size={22} color={Colors.light.primary} />
                </View>
                <Text style={styles.actionText}>View Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={handleSendMessage}>
                <View style={styles.actionIcon}>
                  <MessageCircle size={22} color={Colors.light.primary} />
                </View>
                <Text style={styles.actionText}>Send Message</Text>
              </TouchableOpacity>

              {/* Cancel */}
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>

      {/* Custom Alert */}
      <CustomAlert {...alertProps} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  closeButton: {
    padding: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
});
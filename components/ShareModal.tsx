/**
 * Share Modal Component
 * Provides options to share posts internally or externally
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { Share2, Users, X } from 'lucide-react-native';
import { Colors } from '../constants/colors';

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  onShareToFeed: () => void;
  onShareExternal: () => void;
  postAuthorName: string;
}

export default function ShareModal({
  visible,
  onClose,
  onShareToFeed,
  onShareExternal,
  postAuthorName,
}: ShareModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Share Post</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Share Options */}
          <View style={styles.optionsContainer}>
            {/* Share to Feed */}
            <TouchableOpacity 
              style={styles.optionButton}
              onPress={() => {
                onShareToFeed();
                onClose();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, styles.internalIcon]}>
                <Users size={24} color={Colors.light.primary} />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Share to My Feed</Text>
                <Text style={styles.optionDescription}>
                  Post this to your profile for your circle to see
                </Text>
              </View>
            </TouchableOpacity>

            {/* Share External */}
            <TouchableOpacity 
              style={styles.optionButton}
              onPress={() => {
                onShareExternal();
                onClose();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, styles.externalIcon]}>
                <Share2 size={24} color={Colors.light.primary} />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Share Externally</Text>
                <Text style={styles.optionDescription}>
                  Share via WhatsApp, Facebook, SMS, and more
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  closeButton: {
    padding: 4,
  },
  optionsContainer: {
    padding: 20,
    gap: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  internalIcon: {
    backgroundColor: Colors.light.primary + '15',
  },
  externalIcon: {
    backgroundColor: Colors.light.primary + '15',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  cancelButton: {
    marginHorizontal: 20,
    marginTop: 8,
    padding: 16,
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
});

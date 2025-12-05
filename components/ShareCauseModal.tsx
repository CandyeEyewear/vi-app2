/**
 * Share Cause Modal Component
 * Allows users to add an optional comment and choose visibility when sharing a cause to their feed
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  TextInput,
  ScrollView,
  Keyboard,
  Share,
} from 'react-native';
import { X, Send, Users, Globe, Share2 } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { Cause } from '../types';
import SharedCauseCard from './SharedCauseCard';
import { getCauseProgress } from '../services/causesService';

interface ShareCauseModalProps {
  visible: boolean;
  onClose: () => void;
  onShare: (comment?: string, visibility?: 'public' | 'circle') => void;
  cause: Cause;
  sharing: boolean;
}

export default function ShareCauseModal({
  visible,
  onClose,
  onShare,
  cause,
  sharing,
}: ShareCauseModalProps) {
  const [comment, setComment] = useState('');
  const [shareType, setShareType] = useState<'public' | 'circle' | 'external'>('public');

  const handleShare = (type: 'public' | 'circle' | 'external') => {
    Keyboard.dismiss();
    
    if (type === 'external') {
      handleExternalShare();
    } else {
      onShare(comment.trim() || undefined, type);
    setComment('');
      setShareType('public');
      onClose();
    }
  };

  const handleClose = () => {
    setComment('');
    setShareType('public');
    onClose();
  };

  const handleExternalShare = async () => {
    try {
      const progress = getCauseProgress(cause);
      const shareUrl = `https://vibe.volunteersinc.org/causes/${cause.slug}`;
      const message = `Support "${cause.title}" - ${Math.round(progress)}% funded!\n\n${cause.description.substring(0, 150)}...\n\nDonate now: ${shareUrl}`;
      
      await Share.share({
        message,
        title: `Support: ${cause.title}`,
        url: shareUrl,
      });
      setComment('');
      setShareType('public');
      onClose();
    } catch (error) {
      console.error('Error sharing externally:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Share Cause</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent}>
            {/* Comment Input */}
            <View style={styles.commentSection}>
              <Text style={styles.label}>Add a comment (optional)</Text>
              <TextInput
                style={styles.commentInput}
                placeholder="Say something about this cause..."
                placeholderTextColor={Colors.light.textSecondary}
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={3}
                maxLength={500}
              />
              <Text style={styles.charCount}>{comment.length}/500</Text>
            </View>

            {/* Share to Selection */}
            <View style={styles.visibilitySection}>
              <Text style={styles.label}>Share to:</Text>
              <View style={styles.visibilityOptions}>
                <TouchableOpacity
                  style={[
                    styles.visibilityOption,
                    shareType === 'public' && styles.visibilityOptionActive,
                  ]}
                  onPress={() => handleShare('public')}
                  activeOpacity={0.7}
                  disabled={sharing}
                >
                  <Globe size={20} color={shareType === 'public' ? Colors.light.primary : Colors.light.textSecondary} />
                  <View style={styles.visibilityOptionText}>
                    <Text
                      style={[
                        styles.visibilityOptionTitle,
                        shareType === 'public' && styles.visibilityOptionTitleActive,
                      ]}
                    >
                      General Feed
                    </Text>
                    <Text style={styles.visibilityOptionSubtitle}>
                      Everyone can see this
                    </Text>
                  </View>
                  {shareType === 'public' && <View style={styles.radioActive} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.visibilityOption,
                    shareType === 'circle' && styles.visibilityOptionActive,
                  ]}
                  onPress={() => handleShare('circle')}
                  activeOpacity={0.7}
                  disabled={sharing}
                >
                  <Users size={20} color={shareType === 'circle' ? Colors.light.primary : Colors.light.textSecondary} />
                  <View style={styles.visibilityOptionText}>
                    <Text
                      style={[
                        styles.visibilityOptionTitle,
                        shareType === 'circle' && styles.visibilityOptionTitleActive,
                      ]}
                    >
                      My Circle
                    </Text>
                    <Text style={styles.visibilityOptionSubtitle}>
                      Only your circle can see this
                    </Text>
                  </View>
                  {shareType === 'circle' && <View style={styles.radioActive} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.visibilityOption,
                    shareType === 'external' && styles.visibilityOptionActive,
                  ]}
                  onPress={() => handleShare('external')}
                  activeOpacity={0.7}
                >
                  <Share2 size={20} color={shareType === 'external' ? Colors.light.primary : Colors.light.textSecondary} />
                  <View style={styles.visibilityOptionText}>
                    <Text
                      style={[
                        styles.visibilityOptionTitle,
                        shareType === 'external' && styles.visibilityOptionTitleActive,
                      ]}
                    >
                      External
                    </Text>
                    <Text style={styles.visibilityOptionSubtitle}>
                      Share via other apps
                    </Text>
                  </View>
                  {shareType === 'external' && <View style={styles.radioActive} />}
                </TouchableOpacity>
              </View>
            </View>

            {/* Preview Label */}
            <Text style={styles.previewLabel}>Sharing:</Text>

            {/* Cause Preview */}
            <SharedCauseCard cause={cause} />
          </ScrollView>
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
    maxHeight: '90%',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    maxHeight: '70%',
  },
  commentSection: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  commentInput: {
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: Colors.light.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'right',
    marginTop: 4,
  },
  visibilitySection: {
    padding: 16,
    paddingTop: 0,
  },
  visibilityOptions: {
    gap: 12,
  },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.border,
    gap: 12,
  },
  visibilityOptionActive: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primary + '10',
  },
  visibilityOptionText: {
    flex: 1,
  },
  visibilityOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  visibilityOptionTitleActive: {
    color: Colors.light.primary,
  },
  visibilityOptionSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  radioActive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.light.primary,
    borderWidth: 4,
    borderColor: Colors.light.background,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginLeft: 16,
    marginBottom: 8,
  },
});


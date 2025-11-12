/**
 * Share Comment Modal Component
 * Allows users to add an optional comment when sharing a post to their feed
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
} from 'react-native';
import { X, Send } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { Post } from '../types';
import SharedPostCard from './SharedPostCard';

interface ShareCommentModalProps {
  visible: boolean;
  onClose: () => void;
  onShare: (comment?: string) => void;
  originalPost: Post;
  sharing: boolean;
}

export default function ShareCommentModal({
  visible,
  onClose,
  onShare,
  originalPost,
  sharing,
}: ShareCommentModalProps) {
  const [comment, setComment] = useState('');

  const handleShare = () => {
    Keyboard.dismiss();
    onShare(comment.trim() || undefined);
    setComment(''); // Reset for next time
  };

  const handleClose = () => {
    setComment('');
    onClose();
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
            <Text style={styles.title}>Share to Your Feed</Text>
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
                placeholder="Say something about this..."
                placeholderTextColor={Colors.light.textSecondary}
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={3}
                maxLength={500}
              />
              <Text style={styles.charCount}>{comment.length}/500</Text>
            </View>

            {/* Preview Label */}
            <Text style={styles.previewLabel}>Sharing:</Text>

            {/* Original Post Preview */}
            <SharedPostCard originalPost={originalPost} />
          </ScrollView>

          {/* Share Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.shareButton, sharing && styles.shareButtonDisabled]}
              onPress={handleShare}
              disabled={sharing}
              activeOpacity={0.7}
            >
              <Send size={20} color="#FFFFFF" />
              <Text style={styles.shareButtonText}>
                {sharing ? 'Sharing...' : 'Share to Feed'}
              </Text>
            </TouchableOpacity>
          </View>
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
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginLeft: 16,
    marginBottom: 8,
  },
  buttonContainer: {
    padding: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.primary,
    padding: 16,
    borderRadius: 12,
  },
  shareButtonDisabled: {
    opacity: 0.6,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

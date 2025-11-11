/**
 * Reaction Picker Component
 * Modal to select a reaction (❤️ 👍 👏 🔥 ⭐)
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Heart, ThumbsUp, Flame, Star } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { ReactionType } from '../types';

interface ReactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectReaction: (reaction: ReactionType) => void;
  currentReaction?: ReactionType;
}

const REACTIONS = [
  { type: 'heart' as ReactionType, icon: Heart, color: '#E91E63', label: 'Love' },
  { type: 'thumbsup' as ReactionType, icon: ThumbsUp, color: '#2196F3', label: 'Like' },
  { type: 'clap' as ReactionType, icon: '👏', color: '#FFC107', label: 'Applause' },
  { type: 'fire' as ReactionType, icon: Flame, color: '#FF5722', label: 'Fire' },
  { type: 'star' as ReactionType, icon: Star, color: '#FFD700', label: 'Favorite' },
];

export default function ReactionPicker({
  visible,
  onClose,
  onSelectReaction,
  currentReaction,
}: ReactionPickerProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const handleReactionPress = (reactionType: ReactionType) => {
    onSelectReaction(reactionType);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Choose a reaction</Text>
          </View>

          <View style={styles.reactions}>
            {REACTIONS.map((reaction) => {
              const isSelected = currentReaction === reaction.type;
              const IconComponent = typeof reaction.icon === 'string' ? null : reaction.icon;

              return (
                <TouchableOpacity
                  key={reaction.type}
                  style={[
                    styles.reactionButton,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    isSelected && { borderColor: reaction.color, borderWidth: 2 },
                  ]}
                  onPress={() => handleReactionPress(reaction.type)}
                  activeOpacity={0.7}
                >
                  {typeof reaction.icon === 'string' ? (
                    <Text style={styles.reactionEmoji}>{reaction.icon}</Text>
                  ) : (
                    <IconComponent size={32} color={reaction.color} />
                  )}
                  <Text style={[styles.reactionLabel, { color: colors.text }]}>
                    {reaction.label}
                  </Text>
                  {isSelected && (
                    <View style={[styles.selectedBadge, { backgroundColor: reaction.color }]}>
                      <Text style={styles.selectedText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.removeButton, { backgroundColor: colors.background }]}
            onPress={() => {
              onSelectReaction(currentReaction!); // Same reaction = remove
              onClose();
            }}
          >
            <Text style={[styles.removeButtonText, { color: colors.error }]}>
              {currentReaction ? 'Remove Reaction' : 'Cancel'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
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
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  reactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 12,
    marginBottom: 20,
  },
  reactionButton: {
    width: '28%',
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  reactionEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  reactionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  selectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  removeButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

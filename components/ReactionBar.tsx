/**
 * Reaction Bar Component
 * Shows reaction counts and handles adding reactions
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Heart, ThumbsUp, Flame, Star } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { ReactionType, ReactionSummary } from '../types';

interface ReactionBarProps {
  reactionSummary: ReactionSummary;
  onReactionPress: () => void;
  onReactionCountPress?: () => void;
}

const REACTION_ICONS: Record<ReactionType, { icon: any; color: string }> = {
  heart: { icon: Heart, color: '#E91E63' },
  thumbsup: { icon: ThumbsUp, color: '#2196F3' },
  clap: { icon: '👏', color: '#FFC107' },
  fire: { icon: Flame, color: '#FF5722' },
  star: { icon: Star, color: '#FFD700' },
};

export default function ReactionBar({
  reactionSummary,
  onReactionPress,
  onReactionCountPress,
}: ReactionBarProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  // Get top 3 reactions
  const topReactions = Object.entries(reactionSummary)
    .filter(([key]) => key !== 'total' && key !== 'userReaction')
    .map(([type, count]) => ({ type: type as ReactionType, count: count as number }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const hasReactions = reactionSummary.total > 0;
  const userReaction = reactionSummary.userReaction;

  return (
    <View style={styles.container}>
      {/* Reaction Summary */}
      {hasReactions && (
        <TouchableOpacity
          style={styles.reactionSummary}
          onPress={onReactionCountPress}
          activeOpacity={0.7}
        >
          <View style={styles.reactionIcons}>
            {topReactions.map((reaction, index) => {
              const reactionConfig = REACTION_ICONS[reaction.type];
              const IconComponent = typeof reactionConfig.icon === 'string' ? null : reactionConfig.icon;

              return (
                <View
                  key={reaction.type}
                  style={[
                    styles.reactionIconContainer,
                    { backgroundColor: colors.card, borderColor: colors.background },
                    index > 0 && styles.reactionIconOverlap,
                  ]}
                >
                  {typeof reactionConfig.icon === 'string' ? (
                    <Text style={styles.reactionEmoji}>{reactionConfig.icon}</Text>
                  ) : (
                    <IconComponent size={14} color={reactionConfig.color} />
                  )}
                </View>
              );
            })}
          </View>
          <Text style={[styles.reactionCount, { color: colors.textSecondary }]}>
            {reactionSummary.total}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.spacer} />

      {/* Add Reaction Button */}
      <TouchableOpacity
        style={[
          styles.addReactionButton,
          { backgroundColor: colors.background, borderColor: colors.border },
          userReaction && { borderColor: REACTION_ICONS[userReaction].color, borderWidth: 2 },
        ]}
        onPress={onReactionPress}
        activeOpacity={0.7}
      >
        {userReaction ? (
          <>
            {typeof REACTION_ICONS[userReaction].icon === 'string' ? (
              <Text style={styles.addReactionEmoji}>{REACTION_ICONS[userReaction].icon}</Text>
            ) : (
              React.createElement(REACTION_ICONS[userReaction].icon, {
                size: 18,
                color: REACTION_ICONS[userReaction].color,
              })
            )}
          </>
        ) : (
          <>
            <Heart size={18} color={colors.textSecondary} />
            <Text style={[styles.addReactionText, { color: colors.textSecondary }]}>
              React
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  reactionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reactionIcons: {
    flexDirection: 'row',
  },
  reactionIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  reactionIconOverlap: {
    marginLeft: -8,
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  spacer: {
    flex: 1,
  },
  addReactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  addReactionEmoji: {
    fontSize: 18,
  },
  addReactionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

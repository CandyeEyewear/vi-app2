/**
 * Monthly Streak Badge Component
 * Shows current volunteer streak (months)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getCurrentStreakBadge, STREAK_MILESTONES } from '../types';

interface StreakBadgeProps {
  currentStreak: number;
  longestStreak?: number;
  size?: 'small' | 'medium' | 'large';
}

export default function StreakBadge({ 
  currentStreak, 
  longestStreak,
  size = 'medium' 
}: StreakBadgeProps) {
  
  if (currentStreak === 0) return null;

  const badge = getCurrentStreakBadge(currentStreak);
  const nextMilestone = STREAK_MILESTONES.find(m => m.months > currentStreak);

  const getSizes = () => {
    switch (size) {
      case 'small':
        return { container: 60, emoji: 20, number: 18, label: 10 };
      case 'large':
        return { container: 100, emoji: 32, number: 28, label: 14 };
      default:
        return { container: 80, emoji: 24, number: 22, label: 12 };
    }
  };

  const sizes = getSizes();
  const badgeColor = badge?.color || '#FF6B35';

  return (
    <View style={styles.container}>
      {/* Main Streak Display */}
      <View style={[
        styles.badge,
        { 
          width: sizes.container, 
          height: sizes.container,
          borderColor: badgeColor,
        }
      ]}>
        <Text style={[styles.emoji, { fontSize: sizes.emoji }]}>
          {badge ? badge.emoji : '🔥'}
        </Text>
        <Text style={[styles.number, { fontSize: sizes.number, color: badgeColor }]}>
          {currentStreak}
        </Text>
        <Text style={[styles.label, { fontSize: sizes.label }]}>
          month{currentStreak !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Streak Info */}
      <View style={styles.info}>
        <Text style={styles.infoTitle}>Current Streak</Text>
        
        {/* Next Milestone */}
        {nextMilestone && (
          <Text style={styles.nextMilestone}>
            {nextMilestone.months - currentStreak} more month{nextMilestone.months - currentStreak !== 1 ? 's' : ''} to {nextMilestone.emoji}
          </Text>
        )}
        
        {/* Longest Streak */}
        {longestStreak && longestStreak > currentStreak && (
          <Text style={styles.longestStreak}>
            Best: {longestStreak} month{longestStreak !== 1 ? 's' : ''} 🏆
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 16,
  },
  badge: {
    borderRadius: 40,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emoji: {
    marginBottom: 4,
  },
  number: {
    fontWeight: 'bold',
  },
  label: {
    color: '#666',
    fontWeight: '600',
  },
  info: {
    marginTop: 12,
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  nextMilestone: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: '500',
  },
  longestStreak: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});

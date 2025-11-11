/**
 * Monthly Streak Celebration Modal
 * Shows when user hits a monthly streak milestone
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { X } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { STREAK_MILESTONES } from '../types';

interface StreakCelebrationProps {
  visible: boolean;
  streakMonths: number;
  onClose: () => void;
}

export default function StreakCelebration({ 
  visible, 
  streakMonths, 
  onClose 
}: StreakCelebrationProps) {
  const [scaleAnim] = useState(new Animated.Value(0));
  const [rotateAnim] = useState(new Animated.Value(0));

  const milestone = STREAK_MILESTONES.find(m => m.months === streakMonths);

  useEffect(() => {
    if (visible && milestone) {
      // Animate in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      rotateAnim.setValue(0);
    }
  }, [visible]);

  if (!milestone) return null;

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.container,
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color={Colors.light.textSecondary} />
          </TouchableOpacity>

          {/* Emoji */}
          <Animated.Text 
            style={[
              styles.emoji,
              { transform: [{ rotate }] }
            ]}
          >
            {milestone.emoji}
          </Animated.Text>

          {/* Title */}
          <Text style={styles.title}>Streak Milestone!</Text>
          
          {/* Message */}
          <Text style={styles.message}>
            You've volunteered for {streakMonths} month{streakMonths !== 1 ? 's' : ''} in a row!
          </Text>

          {/* Badge Label */}
          <View style={[styles.badge, { backgroundColor: milestone.color }]}>
            <Text style={styles.badgeText}>{milestone.label}</Text>
          </View>

          {/* Encouragement */}
          <Text style={styles.encouragement}>
            Your consistent impact is making a difference! 💪
          </Text>

          {/* Button */}
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: milestone.color }]}
            onPress={onClose}
          >
            <Text style={styles.buttonText}>Awesome!</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  badge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  encouragement: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 200,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

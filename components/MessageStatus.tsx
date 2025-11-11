/**
 * Message Status Component
 * Shows ✓ sent, ✓✓ delivered, ✓✓ read (blue)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Check, CheckCheck } from 'lucide-react-native';
import { Colors } from '../constants/colors';

interface MessageStatusProps {
  status: 'sent' | 'delivered' | 'read';
  size?: number;
}

export default function MessageStatus({ status, size = 16 }: MessageStatusProps) {
  if (status === 'sent') {
    return (
      <View style={styles.container}>
        <Check size={size} color="rgba(255, 255, 255, 0.6)" />
      </View>
    );
  }

  if (status === 'delivered') {
    return (
      <View style={styles.container}>
        <CheckCheck size={size} color="rgba(255, 255, 255, 0.6)" />
      </View>
    );
  }

  if (status === 'read') {
    return (
      <View style={styles.container}>
        <CheckCheck size={size} color={Colors.light.primary} />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    marginLeft: 4,
  },
});

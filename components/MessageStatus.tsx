/**
 * Message Status Component
 * Shows ✓ sent, ✓✓ delivered, ✓✓ read (green)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Check, CheckCheck } from 'lucide-react-native';

const GREEN_TICK = '#25D366'; // WhatsApp green for ticks

interface MessageStatusProps {
  status: 'sent' | 'delivered' | 'read';
  size?: number;
}

export default function MessageStatus({ status, size = 16 }: MessageStatusProps) {
  if (status === 'sent') {
    return (
      <View style={styles.container}>
        <Check size={size} color={GREEN_TICK} />
      </View>
    );
  }

  if (status === 'delivered') {
    return (
      <View style={styles.container}>
        <CheckCheck size={size} color={GREEN_TICK} />
      </View>
    );
  }

  if (status === 'read') {
    return (
      <View style={styles.container}>
        <CheckCheck size={size} color={GREEN_TICK} />
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

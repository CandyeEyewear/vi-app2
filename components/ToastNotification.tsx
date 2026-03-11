import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, Platform } from 'react-native';
import { subscribeToToast, ToastType } from '../utils/toast';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

const COLORS: Record<ToastType, { bg: string; text: string; border: string }> = {
  success: { bg: '#F0FDF4', text: '#166534', border: '#86EFAC' },
  error:   { bg: '#FEF2F2', text: '#991B1B', border: '#FCA5A5' },
  warning: { bg: '#FFFBEB', text: '#92400E', border: '#FCD34D' },
};

let nextId = 0;

export default function ToastNotification() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsub = subscribeToToast((message, type) => {
      const id = nextId++;
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3500);
    });
    return unsub;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </View>
  );
}

function ToastItem({ toast }: { toast: ToastItem }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    const fadeOut = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -10, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 3000);

    return () => clearTimeout(fadeOut);
  }, []);

  const colors = COLORS[toast.type];

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Text style={[styles.message, { color: colors.text }]}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 60,
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
    gap: 8,
  },
  toast: {
    width: '100%',
    maxWidth: 500,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.12)' } as any,
    }),
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});

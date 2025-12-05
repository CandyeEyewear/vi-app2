import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { CheckCircle } from 'lucide-react-native';
import { useColorScheme } from 'react-native';
import { Colors } from '../../constants/colors';

export default function PaymentSuccessScreen() {
  const { orderId, returnPath } = useLocalSearchParams();
  const [countdown, setCountdown] = useState(5);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Redirect to returnPath if provided, otherwise default to feed
          const redirectPath = returnPath && typeof returnPath === 'string' 
            ? returnPath 
            : '/feed';
          router.replace(redirectPath);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [returnPath, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.iconContainer}>
          <CheckCircle size={80} color="#10B981" />
        </View>
        <Text style={[styles.title, { color: '#10B981' }]}>Payment Successful!</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          Thank you for your payment. Your transaction has been completed successfully.
        </Text>
        {orderId && (
          <Text style={[styles.orderId, { color: colors.textSecondary }]}>Order ID: {orderId}</Text>
        )}
        <Text style={[styles.redirect, { color: '#38B6FF' }]}>
          Redirecting in {countdown} seconds...
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    maxWidth: 400,
    width: '100%',
    borderWidth: 1,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  orderId: {
    fontSize: 14,
    marginBottom: 20,
  },
  redirect: {
    fontSize: 14,
    marginTop: 10,
  },
});


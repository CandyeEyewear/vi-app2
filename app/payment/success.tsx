import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { CheckCircle } from 'lucide-react-native';
import { useColorScheme } from 'react-native';
import { Colors } from '../../constants/colors';

const APP_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
  ? 'https://vibe.volunteersinc.org'
  : 'https://vibe.volunteersinc.org';

export default function PaymentSuccessScreen() {
  const params = useLocalSearchParams();
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const returnPathRaw = params.returnPath || params.return_path;
  const platformParam = params.platform;
  const returnPath = Array.isArray(returnPathRaw) ? returnPathRaw[0] : returnPathRaw;
  const isAppPlatform = platformParam === 'app' || (!Platform.OS || Platform.OS !== 'web');

  const [countdown, setCountdown] = useState(5);
  const [redirectAttempted, setRedirectAttempted] = useState(false);
  const [confirming, setConfirming] = useState(!!orderId);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const confirmCalled = useRef(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  // Confirm the payment on mount
  useEffect(() => {
    if (!orderId || confirmCalled.current) return;
    confirmCalled.current = true;

    const confirmPayment = async () => {
      try {
        console.log('[PAYMENT SUCCESS] Confirming payment for orderId:', orderId);
        const response = await fetch(`${APP_URL}/api/ezee/confirm-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId }),
        });

        const data = await response.json();

        if (data.success) {
          console.log('[PAYMENT SUCCESS] Payment confirmed:', data.message);
          setConfirmed(true);
        } else {
          console.warn('[PAYMENT SUCCESS] Confirmation response:', data);
          setConfirmError(data.error || 'Could not confirm payment');
        }
      } catch (err: any) {
        console.error('[PAYMENT SUCCESS] Confirmation error:', err);
        setConfirmError(err.message || 'Network error confirming payment');
      } finally {
        setConfirming(false);
      }
    };

    confirmPayment();
  }, [orderId]);

  // Mobile deep-link redirect + countdown
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(window.navigator.userAgent);
      const isInApp = window.navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

      if (isMobile && !isInApp && !redirectAttempted) {
        setRedirectAttempted(true);
        const deepLinkParams = new URLSearchParams();
        if (orderId) deepLinkParams.append('orderId', orderId);
        if (returnPath) deepLinkParams.append('returnPath', returnPath);

        const deepLink = `vibe://payment/success?${deepLinkParams.toString()}`;
        console.log('[PAYMENT SUCCESS] Attempting to redirect to app:', deepLink);
        window.location.href = deepLink;

        setTimeout(() => {
          console.log('[PAYMENT SUCCESS] App redirect failed, showing web page');
        }, 2000);
      }
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          const redirectPath = returnPath && typeof returnPath === 'string'
            ? returnPath
            : '/feed';
          console.log('[PAYMENT SUCCESS] Redirecting to:', redirectPath);
          router.replace(redirectPath);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [returnPath, router, orderId, redirectAttempted]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {confirming ? (
          <>
            <ActivityIndicator size="large" color="#38B6FF" style={styles.iconContainer} />
            <Text style={[styles.title, { color: '#38B6FF' }]}>Confirming Payment...</Text>
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              Please wait while we confirm your transaction.
            </Text>
          </>
        ) : (
          <>
            <View style={styles.iconContainer}>
              <CheckCircle size={80} color="#10B981" />
            </View>
            <Text style={[styles.title, { color: '#10B981' }]}>
              {confirmed ? 'Payment Confirmed!' : 'Payment Successful!'}
            </Text>
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              {confirmed
                ? 'Your transaction has been confirmed and your registration is complete.'
                : 'Thank you for your payment. Your transaction has been completed successfully.'}
            </Text>
          </>
        )}
        {orderId ? (
          <Text style={[styles.orderId, { color: colors.textSecondary }]}>Order ID: {orderId}</Text>
        ) : null}
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

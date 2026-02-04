import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { CheckCircle } from 'lucide-react-native';
import { useColorScheme } from 'react-native';
import { Colors } from '../../constants/colors';
import { supabase } from '../../services/supabase';

export default function PaymentSuccessScreen() {
  const params = useLocalSearchParams();
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const returnPathRaw = params.returnPath || params.return_path;
  const platformParam = params.platform;
  // Handle both string and array formats from useLocalSearchParams
  const returnPathFromParams = Array.isArray(returnPathRaw) ? returnPathRaw[0] : returnPathRaw;
  const isAppPlatform = platformParam === 'app' || (!Platform.OS || Platform.OS !== 'web');

  const [countdown, setCountdown] = useState(5);
  const [redirectAttempted, setRedirectAttempted] = useState(false);
  const [returnPath, setReturnPath] = useState<string | undefined>(returnPathFromParams);
  const [loading, setLoading] = useState(!returnPathFromParams && !!orderId);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  // Fetch returnPath from transaction metadata if not in URL params
  useEffect(() => {
    async function fetchReturnPath() {
      if (returnPathFromParams || !orderId) {
        setLoading(false);
        return;
      }

      try {
        console.log('[PAYMENT SUCCESS] Fetching returnPath from transaction for orderId:', orderId);
        const { data, error } = await supabase
          .from('payment_transactions')
          .select('metadata, order_type')
          .eq('order_id', orderId)
          .single();

        if (error) {
          console.error('[PAYMENT SUCCESS] Error fetching transaction:', error);
        } else if (data?.metadata?.return_path) {
          console.log('[PAYMENT SUCCESS] Found returnPath in metadata:', data.metadata.return_path);
          setReturnPath(data.metadata.return_path);
        } else {
          // Fallback: construct returnPath based on order_type
          console.log('[PAYMENT SUCCESS] No returnPath in metadata, using order_type fallback:', data?.order_type);
          if (data?.order_type === 'event_registration' && data?.metadata?.event_id) {
            // We don't have the slug, so redirect to events list
            setReturnPath('/events');
          } else if (data?.order_type === 'donation') {
            setReturnPath('/causes');
          }
        }
      } catch (err) {
        console.error('[PAYMENT SUCCESS] Error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchReturnPath();
  }, [orderId, returnPathFromParams]);

  useEffect(() => {
    // If this is opened in a mobile browser (not in the app), try to redirect to the app
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(window.navigator.userAgent);
      const isInApp = window.navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

      // If on mobile browser (not in app), try to open the app
      if (isMobile && !isInApp && !redirectAttempted) {
        setRedirectAttempted(true);
        const deepLinkParams = new URLSearchParams();
        if (orderId) deepLinkParams.append('orderId', orderId);
        if (returnPath) deepLinkParams.append('returnPath', returnPath);

        const deepLink = `vibe://payment/success?${deepLinkParams.toString()}`;
        console.log('[PAYMENT SUCCESS] Attempting to redirect to app:', deepLink);

        // Try to open the app
        window.location.href = deepLink;

        // Fallback: if app doesn't open within 2 seconds, show the page
        setTimeout(() => {
          // If we're still here, the app didn't open, so continue with normal flow
          console.log('[PAYMENT SUCCESS] App redirect failed, showing web page');
        }, 2000);
      }
    }

    // Wait for returnPath to be loaded before starting countdown
    if (loading) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Redirect to returnPath if provided, otherwise default to feed
          const redirectPath = returnPath && typeof returnPath === 'string'
            ? returnPath
            : '/feed';
          console.log('[PAYMENT SUCCESS] Redirecting to:', redirectPath, 'from returnPath:', returnPath);
          router.replace(redirectPath);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [returnPath, router, orderId, redirectAttempted, loading]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#38B6FF" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading...
        </Text>
      </View>
    );
  }

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
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
});


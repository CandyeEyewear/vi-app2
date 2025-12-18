import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { XCircle } from 'lucide-react-native';
import { useColorScheme } from 'react-native';
import { Colors } from '../../constants/colors';

export default function PaymentCancelScreen() {
  const params = useLocalSearchParams();
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const returnPathRaw = params.returnPath || params.return_path;
  const platformParam = params.platform;
  const returnPath = Array.isArray(returnPathRaw) ? returnPathRaw[0] : returnPathRaw;
  const [redirectAttempted, setRedirectAttempted] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

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
        
        const deepLink = `vibe://payment/cancel?${deepLinkParams.toString()}`;
        console.log('[PAYMENT CANCEL] Attempting to redirect to app:', deepLink);
        
        // Try to open the app
        window.location.href = deepLink;
        
        // Fallback: if app doesn't open within 2 seconds, show the page
        setTimeout(() => {
          // If we're still here, the app didn't open, so continue with normal flow
          console.log('[PAYMENT CANCEL] App redirect failed, showing web page');
        }, 2000);
      }
    }
  }, [orderId, returnPath, redirectAttempted]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.iconContainer}>
          <XCircle size={80} color="#EF4444" />
        </View>
        <Text style={[styles.title, { color: '#EF4444' }]}>Payment Cancelled</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          Your payment was cancelled. No charges have been made to your account.
        </Text>
        {orderId && (
          <Text style={[styles.orderId, { color: colors.textSecondary }]}>Order ID: {orderId}</Text>
        )}
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: '#38B6FF' }]}
          onPress={() => {
            const redirectPath = returnPath && typeof returnPath === 'string' ? returnPath : '/feed';
            router.replace(redirectPath);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Return Home</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={[styles.retryButtonText, { color: '#38B6FF' }]}>Try Again</Text>
        </TouchableOpacity>
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
  button: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 10,
    width: '100%',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 10,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});


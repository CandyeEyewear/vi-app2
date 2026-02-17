/**
 * Partner Layout
 * File: app/(partner)/_layout.tsx
 * Protects all partner routes with authentication + partner org check
 */

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { useColorScheme } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { AnimatedPressable } from '../../components/AnimatedPressable';

export default function PartnerLayout() {
  const { user, isPartner, isPartnerActive, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  useEffect(() => {
    if (!loading) {
      if (!user) {
        console.log('[PARTNER LAYOUT] User not authenticated, redirecting to login');
        router.replace('/login');
        return;
      }

      if (!isPartner) {
        console.log('[PARTNER LAYOUT] User not partner org, redirecting to profile');
        router.replace('/(tabs)/profile');
        return;
      }
    }
  }, [user, isPartner, loading, segments, router]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  if (!user || !isPartner) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>
          Access Denied
        </Text>
        <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
          Partner organization access required
        </Text>
      </View>
    );
  }

  // Partner org exists but membership is not active — show renewal prompt
  if (!isPartnerActive) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AlertTriangle size={48} color="#F59E0B" />
        <Text style={[styles.errorText, { color: colors.text, marginTop: 16 }]}>
          Subscription Inactive
        </Text>
        <Text style={[styles.errorSubtext, { color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 }]}>
          Your organization's subscription has {user.membershipStatus === 'cancelled' ? 'been cancelled' : 'expired'}. Renew to access the Partner Dashboard.
        </Text>
        <AnimatedPressable
          style={styles.renewButton}
          onPress={() => router.push('/(organization)/subscribe')}
        >
          <Text style={styles.renewButtonText}>Renew Subscription</Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={styles.backLink}
          onPress={() => router.back()}
        >
          <Text style={[styles.backLinkText, { color: colors.textSecondary }]}>Go Back</Text>
        </AnimatedPressable>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
  },
  renewButton: {
    marginTop: 24,
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  renewButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backLink: {
    marginTop: 16,
    padding: 8,
  },
  backLinkText: {
    fontSize: 15,
  },
});

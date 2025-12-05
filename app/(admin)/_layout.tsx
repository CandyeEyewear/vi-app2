/**
 * Admin Layout
 * File: app/(admin)/_layout.tsx
 * Protects all admin routes with authentication
 */

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { useColorScheme } from 'react-native';

export default function AdminLayout() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  useEffect(() => {
    if (!loading) {
      // Check if user is authenticated
      if (!user) {
        // Redirect to login if not authenticated
        console.log('[ADMIN LAYOUT] User not authenticated, redirecting to login');
        router.replace('/login');
        return;
      }
      
      // Check if user is admin
      if (!isAdmin) {
        // Redirect to profile if not admin
        console.log('[ADMIN LAYOUT] User not admin, redirecting to profile');
        router.replace('/(tabs)/profile');
        return;
      }
    }
  }, [user, isAdmin, loading, segments, router]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#38B6FF" />
      </View>
    );
  }

  // Show access denied if not admin
  if (!user || !isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>
          Access Denied
        </Text>
        <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
          Admin access required
        </Text>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
  },
});

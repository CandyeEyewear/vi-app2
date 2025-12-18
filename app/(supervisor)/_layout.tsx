/**
 * Supervisor Layout
 * File: app/(supervisor)/_layout.tsx
 * Protects all supervisor routes with authentication
 */

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { useColorScheme } from 'react-native';

export default function SupervisorLayout() {
  const { user, isSup, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  useEffect(() => {
    if (!loading) {
      // Check if user is authenticated
      if (!user) {
        // Redirect to login if not authenticated
        console.log('[SUPERVISOR LAYOUT] User not authenticated, redirecting to login');
        router.replace('/login');
        return;
      }
      
      // Check if user is supervisor
      if (!isSup) {
        // Redirect to profile if not supervisor
        console.log('[SUPERVISOR LAYOUT] User not supervisor, redirecting to profile');
        router.replace('/(tabs)/profile');
        return;
      }
    }
  }, [user, isSup, loading, segments, router]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  // Show access denied if not supervisor
  if (!user || !isSup) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>
          Access Denied
        </Text>
        <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
          Supervisor access required
        </Text>
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
});


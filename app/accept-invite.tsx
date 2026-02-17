/**
 * Accept Partner Invite Screen
 * Handles invite token from email link, calls server-side RPC to accept
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { Colors } from '../constants/colors';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { CheckCircle, XCircle, LogIn } from 'lucide-react-native';

export default function AcceptInviteScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user, loading: authLoading, refreshUser } = useAuth();

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'login_required'>('loading');
  const [message, setMessage] = useState('');
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!token) {
      setStatus('error');
      setMessage('Invalid invite link. No token found.');
      return;
    }

    if (!user) {
      setStatus('login_required');
      return;
    }

    acceptInvite();
  }, [authLoading, user, token]);

  const acceptInvite = async () => {
    try {
      setStatus('loading');

      const { data, error } = await supabase.rpc('accept_partner_invite', {
        invite_token: token,
      });

      if (error) {
        console.error('[ACCEPT INVITE] RPC error:', error);
        setStatus('error');
        setMessage(error.message || 'Failed to accept invite');
        return;
      }

      if (data?.success) {
        setStatus('success');
        setOrgName(data.organization_name || 'the organization');

        // Refresh user profile to pick up new partner_org_id
        await refreshUser();

        // Auto-redirect after 3 seconds
        setTimeout(() => {
          router.replace('/(tabs)/feed');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(data?.error || 'Failed to accept invite');
      }
    } catch (error: any) {
      console.error('[ACCEPT INVITE] Exception:', error);
      setStatus('error');
      setMessage(error.message || 'Something went wrong');
    }
  };

  // Loading
  if (status === 'loading' || authLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={styles.loadingText}>Processing your invitation...</Text>
      </View>
    );
  }

  // Login required
  if (status === 'login_required') {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <LogIn size={48} color="#F59E0B" />
          <Text style={styles.cardTitle}>Sign In Required</Text>
          <Text style={styles.cardMessage}>
            Please sign in or create an account to accept this invitation.
          </Text>

          <AnimatedPressable
            style={[styles.primaryButton, { backgroundColor: '#F59E0B' }]}
            onPress={() => router.replace(`/login?returnTo=/accept-invite?token=${token}`)}
          >
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </AnimatedPressable>

          <AnimatedPressable
            style={styles.secondaryButton}
            onPress={() => router.replace(`/register?invite=${token}`)}
          >
            <Text style={[styles.secondaryButtonText, { color: '#F59E0B' }]}>
              Create Account
            </Text>
          </AnimatedPressable>
        </View>
      </View>
    );
  }

  // Success
  if (status === 'success') {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <CheckCircle size={64} color="#10B981" />
          <Text style={[styles.cardTitle, { color: '#10B981' }]}>Welcome to the Team!</Text>
          <Text style={styles.cardMessage}>
            You've successfully joined {orgName}. Redirecting...
          </Text>
          <ActivityIndicator size="small" color="#10B981" style={{ marginTop: 16 }} />
        </View>
      </View>
    );
  }

  // Error
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <XCircle size={64} color="#EF4444" />
        <Text style={[styles.cardTitle, { color: '#EF4444' }]}>Invite Problem</Text>
        <Text style={styles.cardMessage}>{message}</Text>

        <AnimatedPressable
          style={[styles.primaryButton, { backgroundColor: Colors.light.primary }]}
          onPress={() => router.replace('/(tabs)/feed')}
        >
          <Text style={styles.primaryButtonText}>Go to Home</Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  card: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  cardMessage: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  primaryButton: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

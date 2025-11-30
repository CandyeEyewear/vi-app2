/**
 * Organization Payment Banner Component
 * Displays a prominent banner for approved organizations who haven't paid yet
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { Crown, ChevronRight, AlertCircle } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';

export default function OrganizationPaymentBanner() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { user } = useAuth();

  // Only show for organizations that are approved but haven't paid
  if (!user) return null;
  if (user.account_type !== 'organization') return null;
  if (user.approval_status !== 'approved') return null;
  if (user.is_partner_organization) return null; // Already paid

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: '#FFF9E6', borderColor: '#FFC107' }]}
      onPress={() => router.push('/(organization)/subscribe')}
      activeOpacity={0.7}
    >
      {/* Icon */}
      <View style={styles.iconContainer}>
        <Crown size={32} color="#FFC107" />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <AlertCircle size={16} color="#F57F17" />
          <Text style={styles.badgeText}>ACTION REQUIRED</Text>
        </View>
        <Text style={styles.title}>Complete Your Payment</Text>
        <Text style={styles.subtitle}>
          Your organization application was approved! Complete payment to activate your golden badge and unlock full platform access.
        </Text>
      </View>

      {/* Arrow */}
      <ChevronRight size={24} color="#F57F17" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F57F17',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
});
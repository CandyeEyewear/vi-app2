/**
 * Event Summary Screen (Admin)
 * Shows detailed summary for a specific event
 * File: app/(admin)/events/[id]/summary.tsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Users,
  DollarSign,
  RefreshCw,
  Calendar,
} from 'lucide-react-native';
import { Colors } from '../../../../constants/colors';
import { Event, EventRegistration } from '../../../../types';
import { supabase } from '../../../../services/supabase';
import { getEventById, formatCurrency } from '../../../../services/eventsService';
import { useAuth } from '../../../../contexts/AuthContext';

export default function EventSummaryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user, isAdmin } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  // State
  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalParticipants: 0,
    totalFundsPaid: 0,
    totalRefunds: 0,
  });

  // Fetch event and registrations
  const fetchData = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);

      // Fetch event
      const eventResponse = await getEventById(id);
      if (eventResponse.success && eventResponse.data) {
        setEvent(eventResponse.data);
      }

      // Fetch all registrations for this event
      const { data: registrationsData, error: registrationsError } = await supabase
        .from('event_registrations')
        .select(`
          *,
          user:users(id, full_name, avatar_url, email)
        `)
        .eq('event_id', id)
        .order('registered_at', { ascending: false });

      if (registrationsError) {
        console.error('Error fetching registrations:', registrationsError);
      } else if (registrationsData) {
        const transformedRegistrations: EventRegistration[] = registrationsData.map((row: any) => ({
          id: row.id,
          eventId: row.event_id,
          userId: row.user_id,
          user: row.user ? {
            id: row.user.id,
            fullName: row.user.full_name,
            avatarUrl: row.user.avatar_url,
            email: row.user.email,
          } : undefined,
          status: row.status,
          ticketCount: row.ticket_count || 1,
          paymentStatus: row.payment_status,
          transactionNumber: row.transaction_number,
          amountPaid: row.amount_paid ? parseFloat(row.amount_paid) : undefined,
          registeredAt: row.registered_at,
          cancelledAt: row.cancelled_at,
          attendedAt: row.attended_at,
        }));

        setRegistrations(transformedRegistrations);

        // Calculate stats
        const totalParticipants = transformedRegistrations.filter(
          (r) => r.status === 'registered' || r.status === 'attended'
        ).length;

        const totalFundsPaid = transformedRegistrations
          .filter((r) => r.paymentStatus === 'paid' && r.amountPaid)
          .reduce((sum, r) => sum + (r.amountPaid || 0), 0);

        const totalRefunds = transformedRegistrations
          .filter((r) => r.paymentStatus === 'refunded' && r.amountPaid)
          .reduce((sum, r) => sum + (r.amountPaid || 0), 0);

        setStats({
          totalParticipants,
          totalFundsPaid,
          totalRefunds,
        });
      }
    } catch (error) {
      console.error('Error fetching event details:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (!isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Event Summary</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>Access Denied</Text>
        </View>
      </View>
    );
  }

  if (loading && !event) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38B6FF" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Event Summary</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>Event not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {event.title} - Summary
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#38B6FF" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Cards */}
        <View style={styles.summarySection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Summary</Text>

          {/* Total Participants */}
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.statIconContainer, { backgroundColor: '#38B6FF20' }]}>
              <Users size={24} color="#38B6FF" />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Participants</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.totalParticipants} {stats.totalParticipants === 1 ? 'participant' : 'participants'}
              </Text>
            </View>
          </View>

          {/* Total Funds Paid */}
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.statIconContainer, { backgroundColor: '#4CAF5020' }]}>
              <DollarSign size={24} color="#4CAF50" />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Funds Paid (Confirmed)</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatCurrency(stats.totalFundsPaid)}
              </Text>
            </View>
          </View>

          {/* Total Refunds */}
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.statIconContainer, { backgroundColor: '#F4433620' }]}>
              <RefreshCw size={24} color="#F44336" />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Refunds</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatCurrency(stats.totalRefunds)}
              </Text>
            </View>
          </View>
        </View>

        {/* Event Info */}
        <View style={styles.infoSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Event Information</Text>
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {event.eventDate && (
              <View style={styles.infoRow}>
                <Calendar size={16} color={colors.textSecondary} />
                <Text style={[styles.infoText, { color: colors.text }]}>
                  {new Date(event.eventDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </View>
            )}
            {event.location && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoText, { color: colors.text }]}>{event.location}</Text>
              </View>
            )}
            {event.capacity && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Capacity: {event.spotsRemaining || event.capacity}/{event.capacity} spots
                </Text>
              </View>
            )}
            {!event.isFree && event.ticketPrice && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Ticket Price: {formatCurrency(event.ticketPrice)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerSpacer: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
  },
  summarySection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  infoSection: {
    marginBottom: 24,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
  },
});


/**
 * Admin Event Registrations Screen
 * View and manage registrations for a specific event
 * File: app/(admin)/events/[id]/registrations.tsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Users,
  UserX,
  DollarSign,
  Mail,
  Phone,
  Calendar,
  CheckCircle,
  XCircle,
  RefreshCw,
  QrCode,
} from 'lucide-react-native';
import { Colors } from '../../../../constants/colors';
import { EventRegistration, EventRegistrationStatus } from '../../../../types';
import {
  getEventRegistrations,
  deregisterUser,
  getEventById,
  formatCurrency,
  formatEventDate,
} from '../../../../services/eventsService';
import { useAuth } from '../../../../contexts/AuthContext';
import { supabase } from '../../../../services/supabase';
import QRScanner from '../../../../components/QRScanner';
import { checkInTicket, getCheckInStats } from '../../../../services/eventTicketsService';
import { showToast } from '../../../../utils/toast';

// Web-compatible alert
const showAlert = (title: string, message: string, onOk?: () => void) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    if (onOk) onOk();
  } else {
    Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
  }
};

const showConfirm = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    } else if (onCancel) {
      onCancel();
    }
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      { text: 'OK', onPress: onConfirm },
    ]);
  }
};

interface RegistrationItemProps {
  registration: EventRegistration;
  colors: any;
  onDeregister: (id: string, processRefund: boolean) => void;
  eventIsFree: boolean;
  checkInStats?: { totalTickets: number; checkedInCount: number };
}

function RegistrationItem({
  registration,
  colors,
  onDeregister,
  eventIsFree,
  checkInStats,
}: RegistrationItemProps) {
  const [loading, setLoading] = useState(false);
  
  const statusConfigs: Record<string, { label: string; color: string; bgColor: string }> = {
    registered: { label: 'Registered', color: '#2196F3', bgColor: '#E3F2FD' },
    attended: { label: 'Attended', color: '#4CAF50', bgColor: '#E8F5E9' },
    cancelled: { label: 'Cancelled', color: '#9E9E9E', bgColor: '#FAFAFA' },
    no_show: { label: 'No Show', color: '#F44336', bgColor: '#FFEBEE' },
  };
  
  const statusConfig = statusConfigs[registration.status] || statusConfigs.registered;

  const handleDeregister = (withRefund: boolean) => {
    const refundText = withRefund && !eventIsFree ? ' and process refund' : '';
    showConfirm(
      'Deregister User',
      `Are you sure you want to deregister ${registration.user?.fullName || 'this user'}${refundText}?`,
      () => {
        setLoading(true);
        onDeregister(registration.id, withRefund);
      }
    );
  };

  return (
    <View style={[styles.registrationItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.registrationHeader}>
        <View style={styles.userInfo}>
          <View style={[styles.avatar, { backgroundColor: colors.border }]}>
            <Text style={[styles.avatarText, { color: colors.text }]}>
              {registration.user?.fullName?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={[styles.userName, { color: colors.text }]}>
              {registration.user?.fullName || 'Unknown User'}
            </Text>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
              {registration.user?.email || 'No email'}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      <View style={styles.registrationDetails}>
        <View style={styles.detailRow}>
          <Calendar size={14} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            Registered: {new Date(registration.registeredAt).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Users size={14} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {registration.ticketCount} ticket{registration.ticketCount !== 1 ? 's' : ''}
          </Text>
        </View>
        {checkInStats && checkInStats.totalTickets > 0 && (
          <View style={styles.detailRow}>
            <CheckCircle size={14} color={checkInStats.checkedInCount === checkInStats.totalTickets ? colors.success : colors.warning} />
            <Text style={[styles.detailText, { color: checkInStats.checkedInCount === checkInStats.totalTickets ? colors.success : colors.warning }]}>
              {checkInStats.checkedInCount}/{checkInStats.totalTickets} checked in
            </Text>
          </View>
        )}
        {registration.user?.phone && (
          <View style={styles.detailRow}>
            <Phone size={14} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {registration.user.phone}
            </Text>
          </View>
        )}
        {registration.amountPaid && registration.amountPaid > 0 && (
          <View style={styles.detailRow}>
            <DollarSign size={14} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              Paid: {formatCurrency(registration.amountPaid)}
            </Text>
          </View>
        )}
        {registration.paymentStatus && (
          <View style={styles.detailRow}>
            <CheckCircle size={14} color={registration.paymentStatus === 'completed' ? '#4CAF50' : colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              Payment: {registration.paymentStatus}
            </Text>
          </View>
        )}
      </View>

      {registration.status === 'registered' && (
        <View style={[styles.actionsRow, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#F44336' }]}
            onPress={() => handleDeregister(false)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <UserX size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Deregister</Text>
              </>
            )}
          </TouchableOpacity>
          {!eventIsFree &&
           registration.paymentStatus === 'completed' &&
           registration.amountPaid && 
           registration.amountPaid > 0 && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
              onPress={() => handleDeregister(true)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <RefreshCw size={16} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Deregister & Refund</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

export default function EventRegistrationsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { isAdmin, user } = useAuth();

  // State
  const [event, setEvent] = useState<any>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<EventRegistrationStatus | 'all'>('all');
  const [qrScannerVisible, setQrScannerVisible] = useState(false);
  const [checkInStats, setCheckInStats] = useState<Record<string, { totalTickets: number; checkedInCount: number }>>({});

  // Check admin access
  useEffect(() => {
    if (!isAdmin) {
      showAlert('Access Denied', 'Admin access required');
      router.back();
    }
  }, [isAdmin, router]);

  // Fetch event and registrations
  const fetchData = useCallback(async () => {
    if (!id) return;

    try {
      // Fetch event
      const eventResponse = await getEventById(id);
      if (eventResponse.success && eventResponse.data) {
        setEvent(eventResponse.data);
      }

      // Fetch registrations
      const regResponse = await getEventRegistrations(id, {
        status: statusFilter === 'all' ? undefined : statusFilter,
      });

      if (regResponse.success && regResponse.data) {
        // Fetch payment information and check-in stats for each registration
        const registrationsWithPayments = await Promise.all(
          regResponse.data.map(async (reg) => {
            const { data: transaction } = await supabase
              .from('payment_transactions')
              .select('amount, status, transaction_number')
              .eq('reference_id', reg.id)
              .eq('order_type', 'event_registration')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            // Get check-in stats
            const stats = await getCheckInStats(reg.id);

            return {
              ...reg,
              amountPaid: transaction?.amount || 0,
              // Prefer event_registrations.payment_status, fallback to transaction status
              paymentStatus: reg.payment_status || transaction?.status || undefined,
              transactionNumber: transaction?.transaction_number || undefined,
            };
          })
        );

        setRegistrations(registrationsWithPayments);

        // Update check-in stats state
        const statsMap: Record<string, { totalTickets: number; checkedInCount: number }> = {};
        for (const reg of regResponse.data) {
          const stats = await getCheckInStats(reg.id);
          statsMap[reg.id] = stats;
        }
        setCheckInStats(statsMap);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showAlert('Error', 'Failed to load registrations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Handle deregister
  const handleDeregister = useCallback(async (registrationId: string, processRefund: boolean) => {
    const response = await deregisterUser(registrationId, processRefund);

    if (response.success) {
      if (processRefund && response.data?.refundProcessed) {
        showAlert('Success', 'User deregistered and refund processed successfully', () => {
          fetchData();
        });
      } else if (processRefund && response.data?.refundError) {
        showAlert(
          'Partial Success',
          `User deregistered but refund failed: ${response.data.refundError}`,
          () => {
            fetchData();
          }
        );
      } else {
        showAlert('Success', 'User deregistered successfully', () => {
          fetchData();
        });
      }
    } else {
      showAlert('Error', response.error || 'Failed to deregister user');
    }
  }, [fetchData]);

  // Handle QR scan for check-in
  const handleQRScan = useCallback(async (qrCode: string) => {
    if (!user?.id) {
      showAlert('Error', 'User not authenticated');
      return;
    }

    setQrScannerVisible(false);

    try {
      const result = await checkInTicket(qrCode, user.id);

      if (result.success && result.data) {
        showAlert(
          'Check-In Successful',
          `${result.data.attendeeName} - Ticket #${result.data.ticketNumber} checked in`,
          () => {
            fetchData(); // Refresh to update stats
          }
        );
        if (Platform.OS !== 'web') {
          showToast('Ticket checked in successfully', 'success');
        }
      } else {
        showAlert('Error', result.error || 'Failed to check in ticket');
        if (Platform.OS !== 'web') {
          showToast(result.error || 'Failed to check in ticket', 'error');
        }
      }
    } catch (error) {
      console.error('Error checking in ticket:', error);
      showAlert('Error', 'Failed to check in ticket');
      if (Platform.OS !== 'web') {
        showToast('Failed to check in ticket', 'error');
      }
    }
  }, [user?.id, fetchData]);

  // Render registration item
  const renderRegistrationItem = useCallback(
    ({ item }: { item: EventRegistration }) => (
      <RegistrationItem
        registration={item}
        colors={colors}
        onDeregister={handleDeregister}
        eventIsFree={event?.isFree || false}
        checkInStats={checkInStats[item.id]}
      />
    ),
    [colors, handleDeregister, event, checkInStats]
  );

  // Filter options
  const statusFilters: { value: EventRegistrationStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'registered', label: 'Registered' },
    { value: 'attended', label: 'Attended' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'no_show', label: 'No Show' },
  ];

  const filteredRegistrations = statusFilter === 'all'
    ? registrations
    : registrations.filter((r) => r.status === statusFilter);

  if (loading && !event) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38B6FF" />
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
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {event?.title || 'Registrations'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {filteredRegistrations.length} registration{filteredRegistrations.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Status Filter */}
      <View style={[styles.filterContainer, { borderBottomColor: colors.border }]}>
        <FlatList
          horizontal
          data={statusFilters}
          keyExtractor={(item) => item.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterTab,
                statusFilter === item.value && { backgroundColor: '#38B6FF' },
                statusFilter !== item.value && { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => setStatusFilter(item.value)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  { color: statusFilter === item.value ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Registrations List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38B6FF" />
        </View>
      ) : filteredRegistrations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Users size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No registrations found
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {statusFilter === 'all'
              ? 'No one has registered for this event yet'
              : `No ${statusFilter} registrations`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRegistrations}
          renderItem={renderRegistrationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#38B6FF"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Scan Button */}
      <TouchableOpacity
        style={[
          styles.scanButton,
          { backgroundColor: colors.primary, bottom: 24 + insets.bottom }
        ]}
        onPress={() => setQrScannerVisible(true)}
        activeOpacity={0.8}
      >
        <QrCode size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* QR Scanner Modal */}
      <QRScanner
        visible={qrScannerVisible}
        onClose={() => setQrScannerVisible(false)}
        onScan={handleQRScan}
      />
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
  headerContent: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  filterContainer: {
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  registrationItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  registrationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  registrationDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  scanButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});


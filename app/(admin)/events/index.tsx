/**
 * Admin Events List Screen
 * Manage all events - view, edit, delete
 * File: app/admin/events/index.tsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  useColorScheme,
  RefreshControl,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Plus,
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  Edit3,
  Trash2,
  Eye,
  MoreVertical,
  Star,
  List,
  BarChart3,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Ticket,
  RefreshCw,
} from 'lucide-react-native';
import { Colors } from '../../../constants/colors';
import { Event, EventStatus } from '../../../types';
import {
  getEvents,
  deleteEvent,
  formatEventDate,
  formatEventTime,
  getEventRegistrations,
} from '../../../services/eventsService';
import { supabase } from '../../../services/supabase';
import { formatCurrency } from '../../../services/causesService';
import { useAuth } from '../../../contexts/AuthContext';
import CustomAlert from '../../../components/CustomAlert';
import { ShimmerSkeleton } from '../../../components/ShimmerSkeleton';

// Responsive System
const getResponsiveValues = () => {
  const width = Dimensions.get('window').width;
  const isSmallMobile = width < 380;
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;
  
  return {
    isSmallMobile, isMobile, isTablet, isDesktop,
    spacing: {
      xs: isSmallMobile ? 4 : 6,
      sm: isSmallMobile ? 8 : 10,
      md: isSmallMobile ? 12 : 16,
      lg: isSmallMobile ? 16 : 20,
      xl: isSmallMobile ? 20 : 24,
    },
    fontSize: {
      xs: isSmallMobile ? 10 : 11,
      sm: isSmallMobile ? 12 : 13,
      md: isSmallMobile ? 14 : 15,
      lg: isSmallMobile ? 16 : 17,
      xl: isSmallMobile ? 18 : 20,
      header: isSmallMobile ? 22 : isTablet ? 28 : 26,
    },
  };
};

// Modern Loading Skeleton
function EventsLoadingSkeleton({ colors }: { colors: any }) {
  return (
    <ScrollView style={styles.listContent}>
      {[...Array(5)].map((_, index) => (
        <View 
          key={`skeleton-${index}`}
          style={[styles.eventItem, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <ShimmerSkeleton colors={colors} style={{ width: '70%', height: 20, borderRadius: 8 }} />
            <ShimmerSkeleton colors={colors} style={{ width: 24, height: 24, borderRadius: 12 }} />
          </View>
          
          {/* Status Badge */}
          <ShimmerSkeleton colors={colors} style={{ width: 80, height: 24, borderRadius: 12, marginBottom: 12 }} />
          
          {/* Details */}
          <View style={{ gap: 8 }}>
            <ShimmerSkeleton colors={colors} style={{ width: '60%', height: 14, borderRadius: 6 }} />
            <ShimmerSkeleton colors={colors} style={{ width: '50%', height: 14, borderRadius: 6 }} />
            <ShimmerSkeleton colors={colors} style={{ width: '70%', height: 14, borderRadius: 6 }} />
            <ShimmerSkeleton colors={colors} style={{ width: '45%', height: 14, borderRadius: 6 }} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// Status badge colors - using theme colors
const getStatusConfig = (colorScheme: 'light' | 'dark'): Record<EventStatus, { label: string; color: string; bgColor: string }> => {
  const colors = Colors[colorScheme];
  return {
    draft: { label: 'Draft', color: colors.textSecondary, bgColor: colors.surfaceElevated },
    upcoming: { label: 'Upcoming', color: colors.primary, bgColor: colors.primarySoft },
    ongoing: { label: 'Ongoing', color: colors.success, bgColor: colors.successSoft },
    completed: { label: 'Completed', color: colors.textTertiary, bgColor: colors.surfaceElevated },
    cancelled: { label: 'Cancelled', color: colors.error, bgColor: colors.errorSoft },
  };
};

// Filter tabs
const STATUS_FILTERS: { value: EventStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'draft', label: 'Drafts' },
  { value: 'completed', label: 'Completed' },
];

interface EventSummaryCardProps {
  event: Event;
  colors: any;
}

function EventSummaryCard({ event, colors }: EventSummaryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    totalPersons: number;
    totalTickets: number;
    totalAmount: number;
    totalRefunds: number;
    registrations: Array<{
      id: string;
      userName: string;
      ticketCount: number;
      amountPaid: number;
      refundAmount: number;
      paymentStatus?: string;
      transactionNumber?: string;
    }>;
  } | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!expanded || summaryData) return; // Don't refetch if already loaded
    
    setLoading(true);
    try {
      const regResponse = await getEventRegistrations(event.id);
      
      if (regResponse.success && regResponse.data) {
        const activeRegistrations = regResponse.data.filter(
          (reg) => reg.status !== 'cancelled'
        );

        // Fetch payment and refund data for each registration
        // Use EXACT same logic as event summary screen
        const registrationsWithPayments = await Promise.all(
          activeRegistrations.map(async (reg: any) => {
            // Get the latest completed transaction for this registration (EXACT same query as summary screen)
            const { data: transaction } = await supabase
              .from('payment_transactions')
              .select('amount, status, transaction_number')
              .eq('reference_id', reg.id)
              .eq('order_type', 'event_registration')
              .eq('status', 'completed')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            // Get all transactions for refund calculation
            const { data: allPayments } = await supabase
              .from('payment_transactions')
              .select('amount, status, transaction_number, transaction_type')
              .eq('reference_id', reg.id)
              .eq('order_type', 'event_registration')
              .order('created_at', { ascending: false });

            // Set payment status (EXACT same logic as summary screen)
            // reg comes from transformRegistration which uses camelCase
            const paymentStatus = transaction?.status === 'completed' ? 'Completed' : reg.paymentStatus;
            
            // Get amount paid (EXACT same logic as summary screen)
            // reg comes from transformRegistration which uses camelCase
            const amountPaid = transaction?.amount ? parseFloat(transaction.amount) : (reg.amountPaid ? parseFloat(reg.amountPaid) : undefined);
            
            // Calculate refunds from refund transactions
            const refundTransactions = allPayments?.filter(p => 
              p.status === 'completed' && p.transaction_type === 'refund'
            ) || [];
            const refundAmount = refundTransactions.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

            return {
              id: reg.id,
              userName: reg.user?.fullName || reg.user?.email || 'Unknown User',
              ticketCount: reg.ticketCount || 1,
              amountPaid: amountPaid || 0,
              refundAmount,
              paymentStatus,
              transactionNumber: transaction?.transaction_number || reg.transactionNumber,
            };
          })
        );

        // Filter for paid registrations (EXACT same logic as summary screen)
        const paidRegistrations = registrationsWithPayments.filter(
          (r) => r.paymentStatus === 'Completed' && r.amountPaid && r.amountPaid > 0
        );

        const totalPersons = registrationsWithPayments.length;
        const totalTickets = registrationsWithPayments.reduce((sum, r) => sum + r.ticketCount, 0);
        // Only count amounts from paid registrations (EXACT same logic as summary screen)
        const totalAmount = paidRegistrations.reduce((sum, r) => sum + (r.amountPaid || 0), 0);
        const totalRefunds = registrationsWithPayments.reduce((sum, r) => sum + (r.refundAmount || 0), 0);

        setSummaryData({
          totalPersons,
          totalTickets,
          totalAmount,
          totalRefunds,
          registrations: registrationsWithPayments,
        });
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
    }
  }, [event.id, expanded, summaryData]);

  useEffect(() => {
    if (expanded) {
      fetchSummary();
    }
  }, [expanded, fetchSummary]);

  return (
    <Pressable
      style={[styles.summaryCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
      onPress={(e) => e.stopPropagation()}
    >
      <Pressable
        style={({ pressed }) => [
          styles.summaryHeader,
          { opacity: pressed ? 0.7 : 1 }
        ]}
        onPress={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
      >
        <View style={styles.summaryHeaderLeft}>
          <BarChart3 size={18} color={colors.primary} />
          <Text style={[styles.summaryTitle, { color: colors.text }]}>
            Registration Summary
          </Text>
        </View>
        {expanded ? (
          <ChevronUp size={20} color={colors.textSecondary} />
        ) : (
          <ChevronDown size={20} color={colors.textSecondary} />
        )}
      </Pressable>

      {expanded && (
        <View style={styles.summaryContent}>
          {loading ? (
            <View style={styles.summaryLoading}>
              <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                Loading summary...
              </Text>
            </View>
          ) : summaryData ? (
            <>
              {/* Summary Stats */}
              <View style={styles.summaryStats}>
                <View style={[styles.summaryStatItem, { backgroundColor: colors.card }]}>
                  <Users size={20} color={colors.primary} />
                  <Text style={[styles.summaryStatValue, { color: colors.text }]}>
                    {summaryData.totalPersons}
                  </Text>
                  <Text style={[styles.summaryStatLabel, { color: colors.textSecondary }]}>
                    Persons
                  </Text>
                </View>
                <View style={[styles.summaryStatItem, { backgroundColor: colors.card }]}>
                  <Ticket size={20} color={colors.primary} />
                  <Text style={[styles.summaryStatValue, { color: colors.text }]}>
                    {summaryData.totalTickets}
                  </Text>
                  <Text style={[styles.summaryStatLabel, { color: colors.textSecondary }]}>
                    Tickets
                  </Text>
                </View>
                <View style={[styles.summaryStatItem, { backgroundColor: colors.card }]}>
                  <DollarSign size={20} color={colors.success} />
                  <Text style={[styles.summaryStatValue, { color: colors.success }]}>
                    {formatCurrency(summaryData.totalAmount)}
                  </Text>
                  <Text style={[styles.summaryStatLabel, { color: colors.textSecondary }]}>
                    Total Paid
                  </Text>
                </View>
                {summaryData.totalRefunds > 0 && (
                  <View style={[styles.summaryStatItem, { backgroundColor: colors.card }]}>
                    <RefreshCw size={20} color={colors.error} />
                    <Text style={[styles.summaryStatValue, { color: colors.error }]}>
                      {formatCurrency(summaryData.totalRefunds)}
                    </Text>
                    <Text style={[styles.summaryStatLabel, { color: colors.textSecondary }]}>
                      Refunded
                    </Text>
                  </View>
                )}
              </View>

              {/* Net Amount */}
              <View style={[styles.netAmountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.netAmountLabel, { color: colors.textSecondary }]}>
                  Net Amount
                </Text>
                <Text style={[styles.netAmountValue, { color: colors.text }]}>
                  {formatCurrency(summaryData.totalAmount - summaryData.totalRefunds)}
                </Text>
              </View>

              {/* Registrations List */}
              {summaryData.registrations.length > 0 ? (
                <View style={styles.registrationsList}>
                  <Text style={[styles.registrationsListTitle, { color: colors.text }]}>
                    Registrations
                  </Text>
                  {summaryData.registrations.map((reg, index) => (
                    <View
                      key={reg.id}
                      style={[
                        styles.registrationItem,
                        { 
                          backgroundColor: colors.card,
                          borderBottomColor: index < summaryData.registrations.length - 1 ? colors.border : 'transparent'
                        }
                      ]}
                    >
                      <View style={styles.registrationItemLeft}>
                        <Text style={[styles.registrationName, { color: colors.text }]}>
                          {reg.userName}
                        </Text>
                        <View style={styles.registrationDetails}>
                          <Text style={[styles.registrationDetail, { color: colors.textSecondary }]}>
                            {reg.ticketCount} {reg.ticketCount === 1 ? 'ticket' : 'tickets'}
                          </Text>
                          {reg.transactionNumber && (
                            <Text style={[styles.registrationDetail, { color: colors.textTertiary }]}>
                              #{reg.transactionNumber}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.registrationItemRight}>
                        {reg.amountPaid > 0 && (
                          <Text style={[styles.registrationAmount, { color: colors.success }]}>
                            {formatCurrency(reg.amountPaid)}
                          </Text>
                        )}
                        {reg.refundAmount > 0 && (
                          <Text style={[styles.registrationRefund, { color: colors.error }]}>
                            -{formatCurrency(reg.refundAmount)}
                          </Text>
                        )}
                        {reg.amountPaid === 0 && reg.refundAmount === 0 && (
                          <Text style={[styles.registrationAmount, { color: colors.textTertiary }]}>
                            Free
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.noRegistrations}>
                  <Text style={[styles.noRegistrationsText, { color: colors.textSecondary }]}>
                    No registrations yet
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.summaryLoading}>
              <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                No data available
              </Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

interface EventItemProps {
  event: Event;
  colors: any;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRegistrations: () => void;
  onSummary: () => void;
}

function EventItem({ event, colors, onView, onEdit, onDelete, onRegistrations, onSummary }: EventItemProps) {
  const [showActions, setShowActions] = useState(false);
  const colorScheme = useColorScheme();
  const STATUS_CONFIG = getStatusConfig(colorScheme === 'dark' ? 'dark' : 'light');
  const statusConfig = STATUS_CONFIG[event.status] || STATUS_CONFIG.draft;
  const responsive = getResponsiveValues();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.eventItem, 
        { 
          backgroundColor: pressed ? colors.surfacePressed : colors.card, 
          borderColor: colors.border,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        }
      ]}
      onPress={onView}
    >
      <View style={styles.eventHeader}>
        <View style={styles.eventTitleRow}>
          <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
            {event.title}
          </Text>
          {event.isFeatured && (
            <Star size={16} color={colors.star} fill={colors.star} />
          )}
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.moreButton,
            { opacity: pressed ? 0.6 : 1 }
          ]}
          onPress={() => setShowActions(!showActions)}
        >
          <MoreVertical size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Status Badge */}
      <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
        <Text style={[styles.statusText, { color: statusConfig.color }]}>
          {statusConfig.label}
        </Text>
      </View>

      {/* Event Details */}
      <View style={styles.eventDetails}>
        <View style={styles.detailRow}>
          <Calendar size={14} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {event.eventDate ? formatEventDate(event.eventDate) : 'Date TBA'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Clock size={14} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {event.startTime ? formatEventTime(event.startTime) : 'Time TBA'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          {event.isVirtual ? (
            <Video size={14} color={colors.primary} />
          ) : (
            <MapPin size={14} color={colors.textSecondary} />
          )}
          <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
            {event.isVirtual ? 'Virtual' : (event.location || 'Location TBA')}
          </Text>
        </View>
        {event.capacity && (
          <View style={styles.detailRow}>
            <Users size={14} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {event.spotsRemaining}/{event.capacity} spots
            </Text>
          </View>
        )}
      </View>

      {/* Summary Card */}
      <EventSummaryCard event={event} colors={colors} />

      {/* Actions Dropdown */}
      {showActions && (
        <View style={[styles.actionsDropdown, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Pressable 
            style={({ pressed }) => [
              styles.actionItem,
              { backgroundColor: pressed ? colors.surfacePressed : 'transparent' }
            ]}
            onPress={onView}
          >
            <Eye size={18} color={colors.text} />
            <Text style={[styles.actionText, { color: colors.text }]}>View</Text>
          </Pressable>
          
          <Pressable 
            style={({ pressed }) => [
              styles.actionItem,
              { backgroundColor: pressed ? colors.surfacePressed : 'transparent' }
            ]}
            onPress={onRegistrations}
          >
            <List size={18} color={colors.community} />
            <Text style={[styles.actionText, { color: colors.community }]}>Registrations</Text>
          </Pressable>
          
          <Pressable 
            style={({ pressed }) => [
              styles.actionItem,
              { backgroundColor: pressed ? colors.surfacePressed : 'transparent' }
            ]}
            onPress={onSummary}
          >
            <BarChart3 size={18} color="#9C27B0" />
            <Text style={[styles.actionText, { color: '#9C27B0' }]}>Summary</Text>
          </Pressable>
          
          <Pressable 
            style={({ pressed }) => [
              styles.actionItem,
              { backgroundColor: pressed ? colors.surfacePressed : 'transparent' }
            ]}
            onPress={onEdit}
          >
            <Edit3 size={18} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text>
          </Pressable>
          
          <Pressable 
            style={({ pressed }) => [
              styles.actionItem,
              { backgroundColor: pressed ? colors.surfacePressed : 'transparent' }
            ]}
            onPress={onDelete}
          >
            <Trash2 size={18} color={colors.error} />
            <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

export default function AdminEventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user } = useAuth();
  const responsive = getResponsiveValues();

  // State
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<EventStatus | 'all'>('all');

  // Custom Alert State
  const [alertProps, setAlertProps] = useState({
    visible: false,
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
    title: '',
    message: '',
    onConfirm: undefined as (() => void) | undefined,
    showCancel: false,
  });

  // Show alert helper
  const showAlert = useCallback(
    (
      type: 'success' | 'error' | 'warning' | 'info',
      title: string,
      message: string,
      onConfirm?: () => void,
      showCancel: boolean = false
    ) => {
      setAlertProps({
        visible: true,
        type,
        title,
        message,
        onConfirm,
        showCancel,
      });
    },
    []
  );

  // Close alert
  const closeAlert = useCallback(() => {
    setAlertProps((prev) => ({ ...prev, visible: false }));
  }, []);

  // Check admin access
  useEffect(() => {
    if (user && user.role !== 'admin') {
      showAlert('error', 'Access Denied', 'Admin access required', () => {
        closeAlert();
        router.back();
      });
    }
  }, [user, router, showAlert, closeAlert]);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    try {
      const response = await getEvents({
        status: selectedStatus === 'all' ? undefined : selectedStatus,
        limit: 50,
        userId: user?.id, // Pass userId so admin can see all events
      });

      if (response.success && response.data) {
        setEvents(response.data);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus, user?.id]);

  useEffect(() => {
    setLoading(true);
    fetchEvents();
  }, [selectedStatus]);

  // Pull to refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEvents();
  }, [fetchEvents]);

  // Handle view (public detail page)
  const handleView = useCallback((event: Event) => {
    router.push(`/events/${event.slug}`);
  }, [router]);

  // Handle edit
  const handleEdit = useCallback((event: Event) => {
    router.push(`/events/edit/${event.id}`);
  }, [router]);

  // Handle registrations
  const handleRegistrations = useCallback((event: Event) => {
    router.push(`/(admin)/events/${event.id}/registrations`);
  }, [router]);

  // Handle summary
  const handleSummary = useCallback((event: Event) => {
    router.push(`/(admin)/events/${event.id}/summary`);
  }, [router]);

  // Handle delete
  const handleDelete = useCallback((event: Event) => {
    const performDelete = async () => {
      closeAlert();
      const response = await deleteEvent(event.id);
      if (response.success) {
        setEvents(prev => prev.filter(e => e.id !== event.id));
        showAlert('success', 'Deleted', 'Event has been deleted');
      } else {
        showAlert('error', 'Error', response.error || 'Failed to delete event');
      }
    };

    showAlert(
      'error',
      'Delete Event',
      `Are you sure you want to delete "${event.title}"? This cannot be undone.`,
      performDelete,
      true
    );
  }, [showAlert, closeAlert]);

  // Render event item
  const renderEventItem = useCallback(({ item }: { item: Event }) => (
    <EventItem
      event={item}
      colors={colors}
      onView={() => handleView(item)}
      onEdit={() => handleEdit(item)}
      onDelete={() => handleDelete(item)}
      onRegistrations={() => handleRegistrations(item)}
      onSummary={() => handleSummary(item)}
    />
  ), [colors, handleView, handleEdit, handleDelete, handleRegistrations, handleSummary]);

  // Render empty state
  const renderEmptyComponent = useCallback(() => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Calendar size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No events found
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          Create your first event to get started
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.createButtonEmpty, 
            { 
              backgroundColor: colors.primary,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            }
          ]}
          onPress={() => router.push('/events/create')}
        >
          <Plus size={20} color={colors.textOnPrimary} />
          <Text style={[styles.createButtonEmptyText, { color: colors.textOnPrimary }]}>Create Event</Text>
        </Pressable>
      </View>
    );
  }, [loading, colors, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
        <Pressable 
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.6 : 1 }
          ]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text, fontSize: responsive.fontSize.xl }]}>Manage Events</Text>
        <Pressable
          style={({ pressed }) => [
            styles.addButton, 
            { 
              backgroundColor: colors.primary,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            }
          ]}
          onPress={() => router.push('/events/create')}
        >
          <Plus size={20} color={colors.textOnPrimary} />
        </Pressable>
      </View>

      {/* Status Filter Tabs */}
      <View style={[styles.filterContainer, { borderBottomColor: colors.border }]}>
        <FlatList
          horizontal
          data={STATUS_FILTERS}
          keyExtractor={(item) => item.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.filterTab,
                selectedStatus === item.value && { backgroundColor: colors.primary },
                selectedStatus !== item.value && { backgroundColor: colors.card, borderColor: colors.border },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
              onPress={() => setSelectedStatus(item.value)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  { 
                    color: selectedStatus === item.value ? colors.textOnPrimary : colors.textSecondary,
                    fontSize: responsive.fontSize.sm,
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {/* Events Count */}
      {!loading && events.length > 0 && (
        <View style={styles.countContainer}>
          <Text style={[styles.countText, { color: colors.textSecondary }]}>
            {events.length} {events.length === 1 ? 'event' : 'events'}
          </Text>
        </View>
      )}

      {/* Events List */}
      {loading ? (
        <EventsLoadingSkeleton colors={colors} />
      ) : (
        <FlatList
          data={events}
          renderItem={renderEventItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyComponent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Custom Alert */}
      <CustomAlert
        visible={alertProps.visible}
        type={alertProps.type}
        title={alertProps.title}
        message={alertProps.message}
        onClose={closeAlert}
        onConfirm={alertProps.onConfirm}
        showCancel={alertProps.showCancel}
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
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
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
  countContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  countText: {
    fontSize: 13,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  moreButton: {
    padding: 4,
    marginRight: -4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  eventDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    flex: 1,
  },
  actionsDropdown: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
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
    marginBottom: 24,
  },
  createButtonEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  createButtonEmptyText: {
    fontSize: 15,
    fontWeight: '700',
  },
  // Summary Card Styles
  summaryCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  summaryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryContent: {
    padding: 12,
    paddingTop: 0,
  },
  summaryLoading: {
    padding: 16,
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 13,
  },
  summaryStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  summaryStatItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  summaryStatValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  summaryStatLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  netAmountCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  netAmountLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  netAmountValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  registrationsList: {
    marginTop: 8,
  },
  registrationsListTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  registrationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  registrationItemLeft: {
    flex: 1,
  },
  registrationName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  registrationDetails: {
    flexDirection: 'row',
    gap: 8,
  },
  registrationDetail: {
    fontSize: 11,
  },
  registrationItemRight: {
    alignItems: 'flex-end',
  },
  registrationAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  registrationRefund: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  noRegistrations: {
    padding: 16,
    alignItems: 'center',
  },
  noRegistrationsText: {
    fontSize: 13,
  },
});

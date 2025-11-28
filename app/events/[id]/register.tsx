/**
 * Event Registration Screen
 * For paid event ticket purchase
 * File: app/events/[id]/register.tsx
 * FIXED: Web-compatible alerts
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  Alert,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Video,
  Ticket,
  CreditCard,
  Shield,
  Users,
  Info,
} from 'lucide-react-native';
import { Colors } from '../../../constants/colors';
import { Event } from '../../../types';
import {
  getEventById,
  registerForEvent,
  formatEventDate,
  formatEventTime,
  formatCurrency,
} from '../../../services/eventsService';
import { useAuth } from '../../../contexts/AuthContext';
import WebContainer from '../../../components/WebContainer';
import { processPayment } from '../../../services/paymentService';

const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 380;

// ============================================
// WEB-COMPATIBLE ALERT HELPERS
// ============================================
const showAlert = (title: string, message: string, onOk?: () => void) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    if (onOk) onOk();
  } else {
    Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
  }
};

const showConfirm = (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
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

export default function EventRegisterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user } = useAuth();

  // State
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // Only 1 ticket per purchase - users can register again for more tickets
  const ticketCount = 1;

  // Calculate total
  const ticketPrice = event?.ticketPrice || 0;
  const totalAmount = ticketPrice; // Always 1 ticket
  const spotsLeft = event?.spotsRemaining ?? event?.capacity ?? 999;

  // Fetch event
  useEffect(() => {
    async function fetchEvent() {
      if (!id) return;

      try {
        const response = await getEventById(id);
        if (response.success && response.data) {
          setEvent(response.data);
        } else {
          showAlert('Error', 'Failed to load event');
          router.back();
        }
      } catch (error) {
        console.error('Error fetching event:', error);
        router.back();
      } finally {
        setLoading(false);
      }
    }

    fetchEvent();
  }, [id, router]);


  // Handle purchase
  const handlePurchase = useCallback(async () => {
    console.log('=== PAY BUTTON CLICKED ===');
    console.log('Event:', event?.title);
    console.log('User:', user?.email);
    console.log('Event ID:', id);

    if (!event || !id) {
      console.log('ERROR: No event or id');
      showAlert('Error', 'Event not loaded properly');
      return;
    }

    if (!user) {
      console.log('ERROR: No user - not logged in');
      showConfirm(
        'Sign In Required',
        'Please sign in to purchase tickets',
        () => router.push('/login')
      );
      return;
    }

    console.log('Starting payment process...');
    setSubmitting(true);

    try {
      // For free events, register directly
      if (event.isFree) {
        console.log('Free event - registering directly');
        const response = await registerForEvent({
          eventId: id,
          userId: user.id,
          ticketCount,
        });

        if (response.success) {
          showAlert('Registered! 🎉', `You're now registered for ${event.title}`, () => router.back());
        } else {
          showAlert('Error', response.error || 'Failed to register');
        }
        setSubmitting(false);
        return;
      }

      // For paid events, process payment through eZeePayments
      // First, create a pending registration
      console.log('Paid event - creating registration...');
      const registrationResponse = await registerForEvent({
        eventId: id,
        userId: user.id,
        ticketCount,
      });

      console.log('Registration response:', registrationResponse);

      if (!registrationResponse.success || !registrationResponse.data) {
        showAlert('Error', registrationResponse.error || 'Failed to register for event');
        setSubmitting(false);
        return;
      }

      const registration = registrationResponse.data;
      console.log('Registration created:', registration.id);

      // Generate order ID for payment
      const orderId = `EVT_${registration.id}_${Date.now()}`;

      // Process payment
      console.log('Calling processPayment...');
      const paymentResult = await processPayment({
        amount: totalAmount,
        orderId,
        orderType: 'event_registration',
        referenceId: registration.id,
        userId: user.id,
        customerEmail: user.email || '',
        customerName: user.fullName,
        description: `Event registration: ${event.title} - ${ticketCount} ticket(s)`,
      });

      console.log('Payment result:', paymentResult);

      if (!paymentResult.success) {
        showAlert('Payment Error', paymentResult.error || 'Failed to process payment. Please try again.');
        setSubmitting(false);
        return;
      }

      showAlert(
        'Payment Processing! 🎉',
        `Your registration for "${event.title}" is being processed. You will receive a confirmation once payment is complete.`,
        () => router.back()
      );
    } catch (error) {
      console.error('Purchase error:', error);
      showAlert('Error', error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [event, id, user, router, totalAmount, ticketCount]);

  // Loading state
  if (loading || !event) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Get Tickets</Text>
          <View style={styles.headerSpacer} />
        </View>
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
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => {
            console.log('Back button pressed');
            router.back();
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {event.isFree ? 'Register' : 'Get Tickets'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <WebContainer>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
            showsVerticalScrollIndicator={false}
          >
          {/* Event Info Card */}
          <View style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={2}>
              {event.title}
            </Text>

            <View style={styles.eventDetails}>
              <View style={styles.eventDetailRow}>
                <Calendar size={16} color={colors.textSecondary} />
                <Text style={[styles.eventDetailText, { color: colors.textSecondary }]}>
                  {formatEventDate(event.eventDate)}
                </Text>
              </View>

              <View style={styles.eventDetailRow}>
                <Clock size={16} color={colors.textSecondary} />
                <Text style={[styles.eventDetailText, { color: colors.textSecondary }]}>
                  {formatEventTime(event.startTime)}
                  {event.endTime && ` - ${formatEventTime(event.endTime)}`}
                </Text>
              </View>

              <View style={styles.eventDetailRow}>
                {event.isVirtual ? (
                  <>
                    <Video size={16} color="#38B6FF" />
                    <Text style={[styles.eventDetailText, { color: '#38B6FF' }]}>
                      Virtual Event
                    </Text>
                  </>
                ) : (
                  <>
                    <MapPin size={16} color={colors.textSecondary} />
                    <Text style={[styles.eventDetailText, { color: colors.textSecondary }]} numberOfLines={1}>
                      {event.location}
                    </Text>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Ticket Selection */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {event.isFree ? 'Registration' : 'Ticket'}
            </Text>

            <View style={[styles.ticketCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.ticketInfo}>
                <Ticket size={24} color="#38B6FF" />
                <View style={styles.ticketDetails}>
                  <Text style={[styles.ticketType, { color: colors.text }]}>
                    {event.isFree ? 'Free Registration' : 'General Admission'}
                  </Text>
                  <Text style={[styles.ticketPrice, { color: event.isFree ? '#4CAF50' : colors.text }]}>
                    {event.isFree ? 'FREE' : formatCurrency(ticketPrice)}
                  </Text>
                </View>
              </View>
              <View style={styles.ticketCountDisplay}>
                <Text style={styles.ticketCountText}>1</Text>
              </View>
            </View>

            {!event.isFree && (
              <View style={[styles.infoNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Info size={16} color={colors.textSecondary} />
                <Text style={[styles.infoNoteText, { color: colors.textSecondary }]}>
                  Only 1 ticket per purchase. Need more tickets? Complete this purchase and register again.
                </Text>
              </View>
            )}

            {spotsLeft < 10 && spotsLeft > 0 && (
              <View style={styles.spotsWarning}>
                <Users size={16} color="#FF9800" />
                <Text style={styles.spotsWarningText}>
                  Only {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left!
                </Text>
              </View>
            )}
          </View>

          {/* Order Summary */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Order Summary</Text>

            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                  {event.isFree ? 'Registration' : '1 Ticket'}
                </Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {event.isFree ? 'FREE' : formatCurrency(ticketPrice)}
                </Text>
              </View>

              {!event.isFree && (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                      Service Fee
                    </Text>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>
                      $0
                    </Text>
                  </View>

                  <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />

                  <View style={styles.summaryRow}>
                    <Text style={[styles.totalLabel, { color: colors.text }]}>
                      Total
                    </Text>
                    <Text style={[styles.totalValue, { color: '#38B6FF' }]}>
                      {formatCurrency(totalAmount)}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Security Note */}
          {!event.isFree && (
            <View style={styles.securityNote}>
              <Shield size={16} color={colors.textSecondary} />
              <Text style={[styles.securityText, { color: colors.textSecondary }]}>
                Secure payment powered by eZeePayments
              </Text>
            </View>
          )}

          </ScrollView>
        </WebContainer>
      </KeyboardAvoidingView>

      {/* Bottom Button */}
      <View style={[styles.bottomBar, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.purchaseButton, { backgroundColor: '#38B6FF' }, submitting && styles.purchaseButtonDisabled]}
          onPress={handlePurchase}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              {event.isFree ? (
                <>
                  <Ticket size={22} color="#FFFFFF" />
                  <Text style={styles.purchaseButtonText}>
                    Complete Registration
                  </Text>
                </>
              ) : (
                <>
                  <CreditCard size={22} color="#FFFFFF" />
                  <Text style={styles.purchaseButtonText}>
                    Pay {formatCurrency(ticketPrice)}
                  </Text>
                </>
              )}
            </>
          )}
        </TouchableOpacity>
      </View>
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
    zIndex: 1000,
    position: 'relative',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
    zIndex: 1001,
    minWidth: 44,
    minHeight: 44,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 44,
  },
  keyboardView: {
    flex: 1,
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
  },
  eventCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  eventDetails: {
    gap: 8,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eventDetailText: {
    fontSize: 14,
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  ticketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  ticketInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  ticketDetails: {
    flex: 1,
  },
  ticketType: {
    fontSize: 15,
    fontWeight: '600',
  },
  ticketPrice: {
    fontSize: 14,
    marginTop: 2,
  },
  ticketCountDisplay: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 182, 255, 0.1)',
  },
  ticketCountText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#38B6FF',
  },
  infoNote: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoNoteText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  spotsWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  spotsWarningText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
  },
  summaryCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryDivider: {
    height: 1,
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  securityText: {
    fontSize: 13,
  },
  bottomBar: {
    position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
    zIndex: 1000,
    elevation: 8,
  },
  purchaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  purchaseButtonDisabled: {
    opacity: 0.7,
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
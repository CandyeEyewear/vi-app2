/**
 * Optimized Event Registration Screen
 * Modern payment flow with professional UI/UX, form validation, and accessibility
 * File: app/events/[slug]/register.tsx
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Animated,
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
  Plus,
  Minus,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react-native';
import { Colors } from '../../../constants/colors';
import { Event } from '../../../types';
import {
  getEventBySlug,
  registerForEvent,
  formatEventDate,
  formatEventTime,
  formatCurrency,
} from '../../../services/eventsService';
import { useAuth } from '../../../contexts/AuthContext';
import { processPayment } from '../../../services/paymentService';
import { generateTicketsForRegistration } from '../../../services/eventTicketsService';
import { sendEventConfirmationEmail } from '../../../services/resendService';
import { showToast } from '../../../utils/toast';
import { goBack } from '../../../utils/navigation';
import ErrorBoundary from '../../../components/ErrorBoundary';
import Card from '../../../components/Card';
import Button from '../../../components/Button';

const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 380;

// Modern Typography Scale
const Typography = {
  title1: { fontSize: 32, fontWeight: '800' as const, lineHeight: 38 },
  title2: { fontSize: 26, fontWeight: '700' as const, lineHeight: 32 },
  title3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  body1: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  body2: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
};

// Modern Spacing System
const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Custom Hook for Event Data
function useEventRegistration(eventSlug: string | undefined) {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvent = useCallback(async () => {
    if (!eventSlug) return;

    try {
      setLoading(true);
      setError(null);

      const response = await getEventBySlug(eventSlug);
      if (response.success && response.data) {
        setEvent(response.data);
      } else {
        throw new Error('Failed to load event details');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [eventSlug]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  return { event, loading, error, refetch: fetchEvent };
}

// Modern Header Component
function RegistrationHeader({ 
  onBack, 
  isFree, 
  colors 
}: { 
  onBack: () => void; 
  isFree: boolean;
  colors: any;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[
      styles.header, 
      { 
        paddingTop: insets.top + Spacing.lg,
        backgroundColor: colors.background,
        borderBottomColor: colors.border,
      }
    ]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onBack();
        }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        accessibilityHint="Returns to event details"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <ArrowLeft size={24} color={colors.text} />
      </TouchableOpacity>
      
      <Text style={[styles.headerTitle, { color: colors.text }]}>
        {isFree ? 'Register' : 'Get Tickets'}
      </Text>
      
      <View style={styles.headerSpacer} />
    </View>
  );
}

// Event Summary Card Component
function EventSummaryCard({ 
  event, 
  colors 
}: { 
  event: Event; 
  colors: any;
}) {
  return (
    <Card style={styles.eventCard}>
      <View style={styles.eventCardContent}>
        <Text style={[styles.eventTitle, { color: colors.text }]}>
          {event.title}
        </Text>
        
        <View style={styles.eventDetails}>
          <View style={styles.eventDetailRow}>
            <Calendar size={16} color={colors.textSecondary} />
            <Text style={[styles.eventDetailText, { color: colors.textSecondary }]}>
              {event.eventDate ? formatEventDate(event.eventDate) : 'Date TBA'}
            </Text>
          </View>

          <View style={styles.eventDetailRow}>
            <Clock size={16} color={colors.textSecondary} />
            <Text style={[styles.eventDetailText, { color: colors.textSecondary }]}>
              {event.startTime ? formatEventTime(event.startTime) : 'Time TBA'}
              {event.endTime && event.startTime && ` - ${formatEventTime(event.endTime)}`}
            </Text>
          </View>
          
          <View style={styles.eventDetailRow}>
            {event.isVirtual ? (
              <Video size={16} color={colors.textSecondary} />
            ) : (
              <MapPin size={16} color={colors.textSecondary} />
            )}
            <Text style={[styles.eventDetailText, { color: colors.textSecondary }]}>
              {event.isVirtual ? 'Virtual Event' : event.location}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

// Ticket Selector Component
function TicketSelector({
  event,
  ticketCount,
  setTicketCount,
  spotsLeft,
  availableSpots,
  colors,
}: {
  event: Event;
  ticketCount: number;
  setTicketCount: (count: number) => void;
  spotsLeft: number; // Original spots remaining (for max calculation)
  availableSpots: number; // Spots remaining after user's selection (for display)
  colors: any;
}) {
  const maxTickets = Math.min(spotsLeft, 10);
  const canDecrease = ticketCount > 1;
  const canIncrease = ticketCount < maxTickets;

  const handleDecrease = useCallback(() => {
    if (canDecrease) {
      // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTicketCount(ticketCount - 1);
    }
  }, [canDecrease, ticketCount, setTicketCount]);

  const handleIncrease = useCallback(() => {
    if (canIncrease) {
      // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTicketCount(ticketCount + 1);
    }
  }, [canIncrease, ticketCount, setTicketCount]);

  return (
    <Card style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Tickets
      </Text>
      
      <View style={[styles.ticketCard, { 
        backgroundColor: colors.cardSecondary,
        borderColor: colors.border,
      }]}>
        <View style={styles.ticketInfo}>
          <Ticket size={20} color="#38B6FF" />
          <View style={styles.ticketDetails}>
            <Text style={[styles.ticketType, { color: colors.text }]}>
              {event.isFree ? 'Free Admission' : 'General Admission'}
            </Text>
            <Text style={[styles.ticketPrice, { color: colors.textSecondary }]}>
              {event.isFree ? 'No charge' : `${formatCurrency(event.ticketPrice)} each`}
            </Text>
          </View>
        </View>
        
        <View style={styles.quantitySelector}>
          <TouchableOpacity
            style={[
              styles.quantityButton,
              { borderColor: colors.border },
              !canDecrease && styles.quantityButtonDisabled,
            ]}
            onPress={handleDecrease}
            disabled={!canDecrease}
            accessibilityRole="button"
            accessibilityLabel="Decrease quantity"
            accessibilityState={{ disabled: !canDecrease }}
          >
            <Minus size={16} color={canDecrease ? colors.text : colors.textSecondary} />
          </TouchableOpacity>
          
          <View style={[styles.quantityDisplay, { backgroundColor: colors.card }]}>
            <Text style={[styles.quantityText, { color: '#38B6FF' }]}>
              {ticketCount}
            </Text>
          </View>
          
          <TouchableOpacity
            style={[
              styles.quantityButton,
              { borderColor: colors.border },
              !canIncrease && styles.quantityButtonDisabled,
            ]}
            onPress={handleIncrease}
            disabled={!canIncrease}
            accessibilityRole="button"
            accessibilityLabel="Increase quantity"
            accessibilityState={{ disabled: !canIncrease }}
          >
            <Plus size={16} color={canIncrease ? colors.text : colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.spotsInfo}>
        <Text style={[styles.spotsInfoText, { color: colors.textSecondary }]}>
          {availableSpots} spot{availableSpots !== 1 ? 's' : ''} remaining
        </Text>
      </View>

      {/* Info Note for Paid Events */}
      {!event.isFree && (
        <View style={[styles.infoNote, { 
          backgroundColor: colors.cardSecondary,
          borderColor: colors.border,
        }]}>
          <Info size={16} color="#38B6FF" />
          <Text style={[styles.infoNoteText, { color: colors.textSecondary }]}>
            Tickets are non-refundable. You'll receive a confirmation email after purchase.
          </Text>
        </View>
      )}

      {/* Spots Warning */}
      {availableSpots <= 5 && availableSpots > 0 && (
        <View style={styles.spotsWarning}>
          <AlertTriangle size={16} color="#FF9800" />
          <Text style={styles.spotsWarningText}>
            Only {availableSpots} spot{availableSpots !== 1 ? 's' : ''} left!
          </Text>
        </View>
      )}
    </Card>
  );
}

// Order Summary Component
function OrderSummary({
  event,
  ticketCount,
  totalAmount,
  colors,
}: {
  event: Event;
  ticketCount: number;
  totalAmount: number;
  colors: any;
}) {
  if (event.isFree) {
    return (
      <Card style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Summary
        </Text>
        
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.text }]}>
            Free Registration
          </Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {ticketCount} {ticketCount === 1 ? 'person' : 'people'}
          </Text>
        </View>
      </Card>
    );
  }

  const subtotal = event.ticketPrice * ticketCount;
  const processingFee = Math.max(135, subtotal * 0.03); // eZeePayments fee structure
  const total = subtotal + processingFee;

  return (
    <Card style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Order Summary
      </Text>
      
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, { color: colors.text }]}>
          {ticketCount} × {formatCurrency(event.ticketPrice)}
        </Text>
        <Text style={[styles.summaryValue, { color: colors.text }]}>
          {formatCurrency(subtotal)}
        </Text>
      </View>
      
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, { color: colors.text }]}>
          Processing Fee
        </Text>
        <Text style={[styles.summaryValue, { color: colors.text }]}>
          {formatCurrency(processingFee)}
        </Text>
      </View>
      
      <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
      
      <View style={styles.summaryRow}>
        <Text style={[styles.totalLabel, { color: colors.text }]}>
          Total
        </Text>
        <Text style={[styles.totalValue, { color: '#38B6FF' }]}>
          {formatCurrency(total)}
        </Text>
      </View>
    </Card>
  );
}

// Security Notice Component
function SecurityNotice({ colors }: { colors: any }) {
  return (
    <View style={styles.securityNote}>
      <Shield size={16} color={colors.textSecondary} />
      <Text style={[styles.securityText, { color: colors.textSecondary }]}>
        Secure payment powered by eZeePayments
      </Text>
    </View>
  );
}

// Error Screen Component
function ErrorScreen({ 
  onRetry, 
  colors 
}: { 
  onRetry: () => void; 
  colors: any;
}) {
  return (
    <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
      <AlertTriangle size={48} color={colors.textSecondary} />
      <Text style={[styles.errorTitle, { color: colors.text }]}>
        Could not load event
      </Text>
      <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
        We couldn't load the event details. Please try again.
      </Text>
      <Button
        variant="primary"
        onPress={onRetry}
        style={styles.retryButton}
      >
        Try Again
      </Button>
    </View>
  );
}

// Success Animation Component (optional enhancement)
function SuccessAnimation({ visible }: { visible: boolean }) {
  const [scaleValue] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [visible, scaleValue]);

  if (!visible) return null;

  return (
    <Animated.View style={[
      styles.successOverlay,
      { transform: [{ scale: scaleValue }] }
    ]}>
      <CheckCircle size={64} color="#4CAF50" />
      <Text style={styles.successText}>Registration Successful! 🎉</Text>
    </Animated.View>
  );
}

// Main Component
export default function EventRegisterScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const fallbackRoute = slug ? `/events/${slug}` : '/(tabs)/discover';
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const { event, loading, error, refetch } = useEventRegistration(slug);
  
  const [submitting, setSubmitting] = useState(false);
  const [ticketCount, setTicketCount] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);

  // Memoized calculations
  const { ticketPrice, totalAmount, spotsLeft, availableSpots, maxTickets } = useMemo(() => {
    if (!event) return { ticketPrice: 0, totalAmount: 0, spotsLeft: 0, availableSpots: 0, maxTickets: 0 };
    
    const price = event.ticketPrice || 0;
    const spots = event.spotsRemaining ?? event.capacity ?? 999;
    // Available spots after subtracting selected tickets
    const available = Math.max(0, spots - ticketCount);
    const max = Math.min(spots, 10);
    
    // Calculate total with processing fee for paid events
    let total = price * ticketCount;
    if (!event.isFree) {
      const processingFee = Math.max(135, total * 0.03);
      total += processingFee;
    }
    
    return {
      ticketPrice: price,
      totalAmount: total,
      spotsLeft: spots, // Original spots remaining (for validation)
      availableSpots: available, // Spots remaining after user's selection (for display)
      maxTickets: max,
    };
  }, [event, ticketCount]);

  // Validation
  const canPurchase = useMemo(() => {
    if (!event || submitting) return false;
    if (ticketCount < 1 || ticketCount > spotsLeft) return false;
    if (!event.isFree && totalAmount < 1000) return false; // eZeePayments minimum
    return true;
  }, [event, submitting, ticketCount, spotsLeft, totalAmount]);

  // Handle purchase with comprehensive validation and feedback
  const handlePurchase = useCallback(async () => {
    if (!event || !canPurchase) return;

    if (!user) {
      showToast('Please sign in to register', 'warning');
      router.push('/login');
      return;
    }

    // Validation with user feedback
    if (ticketCount > spotsLeft) {
      showToast(`Only ${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} available`, 'error');
      return;
    }

    if (ticketCount < 1) {
      showToast('Please select at least 1 ticket', 'error');
      return;
    }

    if (!event.isFree && totalAmount < 1000) {
      showToast(`Minimum payment of ${formatCurrency(1000)} required`, 'error');
      return;
    }

    // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);

    try {
      // For free events, register directly and generate tickets
      if (event.isFree) {
        const response = await registerForEvent({
          eventId: event.id,
          userId: user.id,
          ticketCount,
        });

        if (response.success && response.data) {
          // Generate tickets for free events immediately after registration
          const registrationId = response.data.id;
          const eventId = event.id;
          
          if (registrationId && eventId) {
            try {
              const ticketsResponse = await generateTicketsForRegistration(
                registrationId,
                ticketCount,
                eventId
              );
              
              if (ticketsResponse.success) {
                console.log(`✅ Generated ${ticketCount} ticket(s) for registration ${registrationId}`);
              } else {
                console.error('⚠️ Failed to generate tickets for free event:', ticketsResponse.error);
                // Note: Registration succeeded but ticket generation failed
                // Don't block the user, but log the error
              }
            } catch (ticketError) {
              console.error('❌ Error generating tickets for free event:', ticketError);
              // Don't fail registration if ticket generation fails
            }
          }

          // Send event confirmation email (non-blocking)
          console.log('[EVENT REGISTER] 📧 Sending event confirmation email...');
          sendEventConfirmationEmail(
            user.email || '',
            user.fullName,
            event.title,
            formatEventDate(event.startDate),
            event.location || 'Online'
          )
            .then((result) => {
              if (result.success) {
                console.log('[EVENT REGISTER] ✅ Event confirmation email sent');
              } else {
                console.error('[EVENT REGISTER] ⚠️ Event confirmation email failed:', result.error);
              }
            })
            .catch((error) => {
              console.error('[EVENT REGISTER] ⚠️ Event confirmation email error:', error);
            });

          // Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setShowSuccess(true);
          showToast('Successfully registered! 🎉', 'success');
          
          // Delayed navigation to show success animation
          setTimeout(() => {
            goBack(fallbackRoute);
          }, 2000);
        } else {
          throw new Error(response.error || 'Registration failed');
        }
        return;
      }

      // For paid events, DO NOT create registration yet - wait for payment confirmation
      // Store event info in transaction metadata, webhook will create registration after payment
      const orderId = `EVT_${event.id}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      
      // Process payment through eZeePayments
      // Registration will be created in webhook when payment is confirmed
      const returnPath = `/events/${slug}`;
      console.log('[EVENT REGISTER] Processing payment with returnPath:', returnPath, 'slug:', slug);
      console.log('[EVENT REGISTER] Registration will be created after payment confirmation');
      
      const paymentResult = await processPayment({
        amount: totalAmount,
        orderId,
        orderType: 'event_registration',
        // Don't pass referenceId - registration doesn't exist yet
        // Store event info in metadata instead (will be handled in create-token.ts)
        userId: user.id,
        customerEmail: user.email || '',
        customerName: user.fullName,
        description: `${event.title} - ${ticketCount} ticket${ticketCount !== 1 ? 's' : ''}`,
        platform: Platform.OS === 'web' ? 'web' : 'app',
        returnPath, // Return to event page after payment
      });

      if (!paymentResult.success) {
        throw new Error(paymentResult.error || 'Payment processing failed');
      }

      // Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Payment processing! You\'ll receive confirmation soon.', 'success');
      goBack(fallbackRoute);

    } catch (error) {
      console.error('Registration/Purchase error:', error);
      // Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
      showToast(errorMessage, 'error');
    } finally {
      setSubmitting(false);
    }
  }, [event, user, router, totalAmount, ticketCount, spotsLeft, canPurchase]);

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <RegistrationHeader 
          onBack={() => goBack(fallbackRoute)} 
          isFree={false}
          colors={colors} 
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38B6FF" />
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <RegistrationHeader 
          onBack={() => goBack(fallbackRoute)} 
          isFree={false}
          colors={colors} 
        />
        <ErrorBoundary>
          <ErrorScreen onRetry={refetch} colors={colors} />
        </ErrorBoundary>
      </SafeAreaView>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />

        <RegistrationHeader 
          onBack={() => goBack(fallbackRoute)} 
          isFree={event.isFree}
          colors={colors} 
        />

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.select({ ios: 'padding', android: 'height' })}
          keyboardVerticalOffset={Platform.select({ ios: 0, android: 20 })}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Platform.OS === 'web' ? 100 : 100 }
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
            {/* Event Summary */}
            <EventSummaryCard event={event} colors={colors} />

            {/* Ticket Selector */}
            <TicketSelector
              event={event}
              ticketCount={ticketCount}
              setTicketCount={setTicketCount}
              spotsLeft={spotsLeft}
              availableSpots={availableSpots}
              colors={colors}
            />

            {/* Order Summary */}
            <OrderSummary
              event={event}
              ticketCount={ticketCount}
              totalAmount={totalAmount}
              colors={colors}
            />

            {/* Security Notice for Paid Events */}
            {!event.isFree && <SecurityNotice colors={colors} />}

          </ScrollView>
        </KeyboardAvoidingView>

        {/* Bottom Action Button */}
        <View style={[
          styles.bottomBar, 
          { 
            backgroundColor: colors.background,
            paddingBottom: insets.bottom + Spacing.lg,
            borderTopColor: colors.border,
          }
        ]}>
          <Button
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={!canPurchase}
            onPress={handlePurchase}
            style={styles.purchaseButton}
            icon={event.isFree ? 
              <Ticket size={20} color="#FFFFFF" /> : 
              <CreditCard size={20} color="#FFFFFF" />
            }
          >
            {submitting ? 'Processing...' :
             event.isFree ? 'Complete Registration' : 
             `Pay ${formatCurrency(totalAmount)}`}
          </Button>
        </View>

        {/* Success Animation */}
        <SuccessAnimation visible={showSuccess} />
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...Platform.select({
      web: {
        overflow: 'auto' as any,
        height: '100vh' as any,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -Spacing.sm,
  },
  headerTitle: {
    ...Typography.title3,
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
    padding: Spacing.lg,
    paddingBottom: 100, // Space for bottom button
  },
  eventCard: {
    marginBottom: Spacing.xl,
  },
  eventCardContent: {
    padding: Spacing.lg,
  },
  eventTitle: {
    ...Typography.title3,
    marginBottom: Spacing.md,
  },
  eventDetails: {
    gap: Spacing.sm,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  eventDetailText: {
    ...Typography.body2,
    flex: 1,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.body1,
    fontWeight: '600',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  ticketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: Spacing.lg,
  },
  ticketInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  ticketDetails: {
    flex: 1,
  },
  ticketType: {
    ...Typography.body1,
    fontWeight: '600',
  },
  ticketPrice: {
    ...Typography.body2,
    marginTop: 2,
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityDisplay: {
    minWidth: 50,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 18,
    fontWeight: '700',
  },
  spotsInfo: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  spotsInfoText: {
    ...Typography.caption,
  },
  infoNote: {
    marginTop: Spacing.md,
    marginHorizontal: Spacing.lg,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  infoNoteText: {
    ...Typography.caption,
    flex: 1,
    lineHeight: 18,
  },
  spotsWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  spotsWarningText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  summaryLabel: {
    ...Typography.body2,
  },
  summaryValue: {
    ...Typography.body2,
    fontWeight: '600',
  },
  summaryDivider: {
    height: 1,
    marginBottom: Spacing.md,
    marginHorizontal: Spacing.lg,
  },
  totalLabel: {
    ...Typography.body1,
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
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  securityText: {
    ...Typography.caption,
  },
  bottomBar: {
    ...Platform.select({
      web: {
        position: 'sticky' as any,
        bottom: 0,
      },
      default: {
        position: 'absolute',
        bottom: 0,
      },
    }),
    left: 0,
    right: 0,
    padding: Spacing.lg,
    borderTopWidth: 1,
    backgroundColor: 'transparent',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
      },
    }),
  },
  purchaseButton: {
    width: '100%',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxxl,
  },
  errorTitle: {
    ...Typography.title3,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  errorMessage: {
    ...Typography.body1,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  retryButton: {
    minWidth: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  successText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
});

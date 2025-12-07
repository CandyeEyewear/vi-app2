/**
 * My Events Detail Screen
 * Shows event details and all QR codes for tickets
 * File: app/my-events/[id].tsx
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Video,
  CheckCircle,
  Clock as ClockIcon,
  Ticket,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { Colors } from '../../constants/colors';
import { getEventRegistrations, formatEventDate, formatEventTime } from '../../services/eventsService';
import { useAuth } from '../../contexts/AuthContext';
import { getTicketsByRegistration, EventTicket } from '../../services/eventTicketsService';

export default function MyEventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [registration, setRegistration] = useState<any>(null);
  const [tickets, setTickets] = useState<EventTicket[]>([]);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id || !user?.id) return;

    try {
      setLoading(true);

      // Load registration
      const regResponse = await getEventRegistrations(user.id);
      if (regResponse.success && regResponse.data) {
        const reg = regResponse.data.find((r: any) => r.id === id);
        if (reg) {
          setRegistration(reg);
        }
      }

      // Load tickets
      const ticketsResponse = await getTicketsByRegistration(id);
      if (ticketsResponse.success && ticketsResponse.data) {
        setTickets(ticketsResponse.data);
      }
    } catch (error) {
      console.error('Error loading event details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Event Tickets</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!registration || !registration.event) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Event Tickets</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text }]}>Event not found</Text>
        </View>
      </View>
    );
  }

  const event = registration.event;
  const checkedInCount = tickets.filter((t) => t.checkedIn).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Event Tickets</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Event Header */}
        {event.imageUrl && (
          <Image source={{ uri: event.imageUrl }} style={styles.eventImage} />
        )}

        <View style={styles.eventHeader}>
          <Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text>

          <View style={styles.eventDetails}>
            {event.eventDate && (
              <View style={styles.detailRow}>
                <Calendar size={16} color={colors.textSecondary} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  {formatEventDate(event.eventDate)}
                </Text>
              </View>
            )}

            {event.startTime && (
              <View style={styles.detailRow}>
                <Clock size={16} color={colors.textSecondary} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  {formatEventTime(event.startTime)}
                </Text>
              </View>
            )}

            {event.location && (
              <View style={styles.detailRow}>
                {event.isVirtual ? (
                  <Video size={16} color={colors.textSecondary} />
                ) : (
                  <MapPin size={16} color={colors.textSecondary} />
                )}
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  {event.isVirtual ? 'Virtual Event' : event.location}
                </Text>
              </View>
            )}
          </View>

          {/* Check-in Status */}
          {tickets.length > 0 && (
            <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.statusRow}>
                <Ticket size={20} color={colors.primary} />
                <Text style={[styles.statusText, { color: colors.text }]}>
                  {checkedInCount} of {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} checked in
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Tickets */}
        {tickets.length === 0 ? (
          <View style={styles.emptyTickets}>
            <Ticket size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No tickets available</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Tickets will be generated after payment confirmation
            </Text>
          </View>
        ) : (
          <View style={styles.ticketsContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Tickets</Text>
            {tickets.map((ticket) => (
              <View
                key={ticket.id}
                style={[styles.ticketCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.ticketHeader}>
                  <Text style={[styles.ticketNumber, { color: colors.text }]}>
                    Ticket {ticket.ticketNumber}
                  </Text>
                  {ticket.checkedIn ? (
                    <View style={[styles.statusBadge, { backgroundColor: colors.success + '15' }]}>
                      <CheckCircle size={14} color={colors.success} />
                      <Text style={[styles.statusBadgeText, { color: colors.success }]}>
                        Checked In
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.statusBadge, { backgroundColor: colors.textSecondary + '15' }]}>
                      <ClockIcon size={14} color={colors.textSecondary} />
                      <Text style={[styles.statusBadgeText, { color: colors.textSecondary }]}>
                        Not Checked In
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.qrContainer}>
                  <View style={[styles.qrWrapper, { backgroundColor: '#FFFFFF' }]}>
                    <QRCode
                      value={ticket.qrCode}
                      size={250}
                      backgroundColor="#FFFFFF"
                      color="#000000"
                    />
                  </View>
                </View>

                <Text style={[styles.qrCodeText, { color: colors.textSecondary }]}>
                  {ticket.qrCode}
                </Text>
              </View>
            ))}
          </View>
        )}
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
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  eventImage: {
    width: '100%',
    height: 240,
    resizeMode: 'cover',
  },
  eventHeader: {
    padding: 16,
  },
  eventTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  eventDetails: {
    gap: 12,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailText: {
    fontSize: 15,
    flex: 1,
  },
  statusCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  ticketsContainer: {
    padding: 16,
    gap: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  ticketCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  ticketNumber: {
    fontSize: 18,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  qrContainer: {
    marginVertical: 16,
  },
  qrWrapper: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCodeText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTickets: {
    alignItems: 'center',
    padding: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});


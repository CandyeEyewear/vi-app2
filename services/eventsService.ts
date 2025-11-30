/**
 * Events Service
 * Handles all event-related operations
 * File: services/eventsService.ts
 */

import { supabase } from './supabase';
import {
  Event,
  EventCategory,
  EventStatus,
  EventRegistration,
  EventRegistrationStatus,
  ApiResponse,
} from '../types';

// ==================== HELPER FUNCTIONS ====================

/**
 * Transform database row (snake_case) to Event object (camelCase)
 */
function transformEvent(row: any): Event {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    imageUrl: row.image_url,
    location: row.location,
    locationAddress: row.location_address,
    latitude: row.latitude,
    longitude: row.longitude,
    mapLink: row.map_link,
    isVirtual: row.is_virtual ?? false,
    virtualLink: row.virtual_link,
    eventDate: row.event_date,
    startTime: row.start_time && typeof row.start_time === 'string' ? row.start_time : undefined,
    endTime: row.end_time && typeof row.end_time === 'string' ? row.end_time : undefined,
    timezone: row.timezone || 'America/Jamaica',
    capacity: row.capacity,
    spotsRemaining: row.spots_remaining,
    registrationRequired: row.registration_required ?? false,
    registrationDeadline: row.registration_deadline,
    isFree: row.is_free ?? true,
    ticketPrice: row.ticket_price ? parseFloat(row.ticket_price) : undefined,
    currency: row.currency || 'JMD',
    paymentLink: row.payment_link,
    causeId: row.cause_id,
    cause: row.cause ? {
      id: row.cause.id,
      title: row.cause.title,
      imageUrl: row.cause.image_url,
    } : undefined,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    status: row.status,
    isFeatured: row.is_featured ?? false,
    visibility: row.visibility || 'public',
    createdBy: row.created_by,
    creator: row.creator ? {
      id: row.creator.id,
      fullName: row.creator.full_name,
      avatarUrl: row.creator.avatar_url,
    } : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as Event;
}

/**
 * Transform database row to EventRegistration object
 */
function transformRegistration(row: any): EventRegistration {
  return {
    id: row.id,
    eventId: row.event_id,
    event: row.event ? transformEvent(row.event) : undefined,
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
  } as EventRegistration;
}


// ==================== EVENT FUNCTIONS ====================

/**
 * Fetch all events with optional filters
 * Filters visibility based on user's premium membership status
 */
export async function getEvents(options?: {
  category?: EventCategory | 'all';
  status?: EventStatus;
  featured?: boolean;
  limit?: number;
  offset?: number;
  searchQuery?: string;
  upcoming?: boolean;
  userId?: string; // Optional: if provided, will filter based on user's membership
}): Promise<ApiResponse<Event[]>> {
  try {
    // Check if user is premium member or admin (if userId provided)
    let isPremiumMember = false;
    let isAdmin = false;
    if (options?.userId) {
      const { data: userData } = await supabase
        .from('users')
        .select('membership_tier, membership_status, role')
        .eq('id', options.userId)
        .single();
      
      isPremiumMember = userData?.membership_tier === 'premium' && userData?.membership_status === 'active';
      isAdmin = userData?.role === 'admin';
    }

    let query = supabase
      .from('events')
      .select(`
        *,
        creator:users!created_by(id, full_name, avatar_url),
        cause:causes(id, title, image_url)
      `)
      .order('event_date', { ascending: true });

    // Apply filters
    if (options?.status) {
      query = query.eq('status', options.status);
    } else if (options?.upcoming) {
      query = query.in('status', ['upcoming', 'ongoing']);
    } else {
      query = query.neq('status', 'draft');
    }

    // Filter visibility: non-premium users only see public items
    // Admins see everything (no filter)
    if (!isAdmin && !isPremiumMember) {
      query = query.or('visibility.is.null,visibility.eq.public');
    }
    // Premium members and admins see all (public + members_only), so no filter needed

    if (options?.category && options.category !== 'all') {
      query = query.eq('category', options.category);
    }

    if (options?.featured) {
      query = query.eq('is_featured', true);
    }

    if (options?.searchQuery) {
      query = query.or(`title.ilike.%${options.searchQuery}%,description.ilike.%${options.searchQuery}%,location.ilike.%${options.searchQuery}%`);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;

    let events = data?.map(transformEvent) || [];

    // Filter out past events for non-admin users (similar to opportunities)
    if (!isAdmin && events.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      events = events.filter((event) => {
        if (!event.eventDate) return true; // Show events without dates
        
        const eventDate = new Date(event.eventDate);
        eventDate.setHours(23, 59, 59, 999);
        
        // Show event if it's today or in the future
        return eventDate >= today;
      });
    }

    return { success: true, data: events };
  } catch (error) {
    console.error('Error fetching events:', error);
    return { success: false, error: 'Failed to fetch events' };
  }
}

/**
 * Fetch a single event by ID
 */
export async function getEventById(eventId: string): Promise<ApiResponse<Event>> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        creator:users!created_by(id, full_name, avatar_url),
        cause:causes(id, title, image_url)
      `)
      .eq('id', eventId)
      .single();

    if (error) throw error;

    if (!data) {
      return { success: false, error: 'Event not found' };
    }

    return { success: true, data: transformEvent(data) };
  } catch (error) {
    console.error('Error fetching event:', error);
    return { success: false, error: 'Failed to fetch event' };
  }
}

/**
 * Create a new event (Admin only)
 */
export async function createEvent(eventData: {
  title: string;
  description: string;
  category: EventCategory;
  location: string;
  locationAddress?: string;
  latitude?: number;
  longitude?: number;
  mapLink?: string;
  isVirtual?: boolean;
  virtualLink?: string;
  eventDate: string;
  startTime: string;
  endTime?: string;
  capacity?: number;
  registrationRequired?: boolean;
  registrationDeadline?: string;
  isFree?: boolean;
  ticketPrice?: number;
  paymentLink?: string;
  causeId?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  imageUrl?: string;
  createdBy: string;
  visibility?: 'public' | 'members_only';
}): Promise<ApiResponse<Event>> {
  try {
    const { data, error } = await supabase
      .from('events')
      .insert({
        title: eventData.title,
        description: eventData.description,
        category: eventData.category,
        location: eventData.location,
        location_address: eventData.locationAddress,
        latitude: eventData.latitude,
        longitude: eventData.longitude,
        map_link: eventData.mapLink,
        is_virtual: eventData.isVirtual ?? false,
        virtual_link: eventData.virtualLink,
        event_date: eventData.eventDate,
        start_time: eventData.startTime,
        end_time: eventData.endTime,
        capacity: eventData.capacity,
        spots_remaining: eventData.capacity,
        registration_required: eventData.registrationRequired ?? false,
        registration_deadline: eventData.registrationDeadline,
        is_free: eventData.isFree ?? true,
        ticket_price: eventData.ticketPrice,
        payment_link: eventData.paymentLink,
        cause_id: eventData.causeId,
        contact_name: eventData.contactName,
        contact_email: eventData.contactEmail,
        contact_phone: eventData.contactPhone,
        image_url: eventData.imageUrl,
        created_by: eventData.createdBy,
        visibility: eventData.visibility || 'public',
        status: 'upcoming',
      })
      .select(`
        *,
        creator:users!created_by(id, full_name, avatar_url)
      `)
      .single();

    if (error) throw error;

    return { success: true, data: transformEvent(data) };
  } catch (error) {
    console.error('Error creating event:', error);
    return { success: false, error: 'Failed to create event' };
  }
}

/**
 * Update an event (Admin only)
 */
export async function updateEvent(
  eventId: string,
  updates: Partial<{
    title: string;
    description: string;
    category: EventCategory;
    location: string;
    locationAddress: string;
    latitude: number;
    longitude: number;
    mapLink: string;
    isVirtual: boolean;
    virtualLink: string;
    eventDate: string;
    startTime: string;
    endTime: string;
    capacity: number;
    registrationRequired: boolean;
    registrationDeadline: string;
    isFree: boolean;
    ticketPrice: number;
    causeId: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    imageUrl: string;
    status: EventStatus;
    isFeatured: boolean;
    visibility?: 'public' | 'members_only';
  }>
): Promise<ApiResponse<Event>> {
  try {
    const updateData: any = {};

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.locationAddress !== undefined) updateData.location_address = updates.locationAddress;
    if (updates.latitude !== undefined) updateData.latitude = updates.latitude;
    if (updates.longitude !== undefined) updateData.longitude = updates.longitude;
    if (updates.mapLink !== undefined) updateData.map_link = updates.mapLink;
    if (updates.isVirtual !== undefined) updateData.is_virtual = updates.isVirtual;
    if (updates.virtualLink !== undefined) updateData.virtual_link = updates.virtualLink;
    if (updates.eventDate !== undefined) updateData.event_date = updates.eventDate;
    if (updates.startTime !== undefined) updateData.start_time = updates.startTime;
    if (updates.endTime !== undefined) updateData.end_time = updates.endTime;
    if (updates.capacity !== undefined) updateData.capacity = updates.capacity;
    if (updates.registrationRequired !== undefined) updateData.registration_required = updates.registrationRequired;
    if (updates.registrationDeadline !== undefined) updateData.registration_deadline = updates.registrationDeadline;
    if (updates.isFree !== undefined) updateData.is_free = updates.isFree;
    if (updates.ticketPrice !== undefined) updateData.ticket_price = updates.ticketPrice;
    if (updates.paymentLink !== undefined) updateData.payment_link = updates.paymentLink;
    if (updates.causeId !== undefined) updateData.cause_id = updates.causeId;
    if (updates.contactName !== undefined) updateData.contact_name = updates.contactName;
    if (updates.contactEmail !== undefined) updateData.contact_email = updates.contactEmail;
    if (updates.contactPhone !== undefined) updateData.contact_phone = updates.contactPhone;
    if (updates.imageUrl !== undefined) updateData.image_url = updates.imageUrl;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.isFeatured !== undefined) updateData.is_featured = updates.isFeatured;
    if (updates.visibility !== undefined) updateData.visibility = updates.visibility;

    const { data, error } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', eventId)
      .select(`
        *,
        creator:users!created_by(id, full_name, avatar_url)
      `)
      .single();

    if (error) throw error;

    return { success: true, data: transformEvent(data) };
  } catch (error) {
    console.error('Error updating event:', error);
    return { success: false, error: 'Failed to update event' };
  }
}

/**
 * Delete an event (Admin only)
 */
export async function deleteEvent(eventId: string): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error deleting event:', error);
    return { success: false, error: 'Failed to delete event' };
  }
}


// ==================== REGISTRATION FUNCTIONS ====================

/**
 * Register for an event
 */
export async function registerForEvent(data: {
  eventId: string;
  userId: string;
  ticketCount?: number;
}): Promise<ApiResponse<EventRegistration>> {
  try {
    // Check if already registered
    const { data: existing } = await supabase
      .from('event_registrations')
      .select('id, status')
      .eq('event_id', data.eventId)
      .eq('user_id', data.userId)
      .single();

    if (existing && existing.status !== 'cancelled') {
      return { success: false, error: 'You are already registered for this event' };
    }

    // If previously cancelled, update the existing registration
    if (existing && existing.status === 'cancelled') {
      const { data: updated, error } = await supabase
        .from('event_registrations')
        .update({
          status: 'registered',
          ticket_count: data.ticketCount || 1,
          registered_at: new Date().toISOString(),
          cancelled_at: null,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: transformRegistration(updated) };
    }

    // Create new registration
    const { data: registration, error } = await supabase
      .from('event_registrations')
      .insert({
        event_id: data.eventId,
        user_id: data.userId,
        ticket_count: data.ticketCount || 1,
        status: 'registered',
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: transformRegistration(registration) };
  } catch (error) {
    console.error('Error registering for event:', error);
    return { success: false, error: 'Failed to register for event' };
  }
}

/**
 * Cancel event registration
 */
export async function cancelEventRegistration(
  registrationId: string
): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase
      .from('event_registrations')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', registrationId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error cancelling registration:', error);
    return { success: false, error: 'Failed to cancel registration' };
  }
}

/**
 * Get user's event registrations
 */
export async function getUserRegistrations(
  userId: string,
  options?: {
    status?: EventRegistrationStatus;
    upcoming?: boolean;
  }
): Promise<ApiResponse<EventRegistration[]>> {
  try {
    let query = supabase
      .from('event_registrations')
      .select(`
        *,
        event:events(
          id, title, image_url, event_date, start_time, end_time,
          location, is_virtual, status
        )
      `)
      .eq('user_id', userId)
      .order('registered_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;

    if (error) throw error;

    let registrations = data?.map(transformRegistration) || [];

    // Filter for upcoming events if requested
    if (options?.upcoming) {
      const now = new Date();
      registrations = registrations.filter(reg => {
        if (!reg.event?.eventDate) return false;
        return new Date(reg.event.eventDate) >= now;
      });
    }

    return { success: true, data: registrations };
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return { success: false, error: 'Failed to fetch registrations' };
  }
}

/**
 * Check if user is registered for an event
 */
export async function checkUserRegistration(
  eventId: string,
  userId: string
): Promise<ApiResponse<EventRegistration | null>> {
  try {
    const { data, error } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .neq('status', 'cancelled')
      .maybeSingle();

    if (error) throw error;

    return { 
      success: true, 
      data: data ? transformRegistration(data) : null 
    };
  } catch (error) {
    console.error('Error checking registration:', error);
    return { success: false, error: 'Failed to check registration' };
  }
}

/**
 * Get registrations for an event (Admin)
 */
export async function getEventRegistrations(
  eventId: string,
  options?: {
    status?: EventRegistrationStatus;
    limit?: number;
  }
): Promise<ApiResponse<EventRegistration[]>> {
  try {
    let query = supabase
      .from('event_registrations')
      .select(`
        *,
        user:users(id, full_name, avatar_url, email, phone)
      `)
      .eq('event_id', eventId)
      .order('registered_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    const registrations = data?.map(transformRegistration) || [];

    return { success: true, data: registrations };
  } catch (error) {
    console.error('Error fetching event registrations:', error);
    return { success: false, error: 'Failed to fetch registrations' };
  }
}

/**
 * Deregister a user from an event (Admin)
 * Cancels the registration and optionally processes refund
 */
export async function deregisterUser(
  registrationId: string,
  processRefund: boolean = false
): Promise<ApiResponse<{ refundProcessed?: boolean; refundError?: string }>> {
  try {
    // Get registration details
    const { data: registration, error: regError } = await supabase
      .from('event_registrations')
      .select('*, event:events(id, ticket_price, is_free)')
      .eq('id', registrationId)
      .single();

    if (regError || !registration) {
      return { success: false, error: 'Registration not found' };
    }

    // Update registration status to cancelled
    const { error: updateError } = await supabase
      .from('event_registrations')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', registrationId);

    if (updateError) throw updateError;

    // If it's a paid event and refund is requested, process refund
    let refundResult: { refundProcessed?: boolean; refundError?: string } = {};
    if (processRefund && !registration.event?.is_free && registration.event?.ticket_price) {
      // Find the payment transaction for this registration
      const { data: transaction } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('reference_id', registrationId)
        .eq('order_type', 'event_registration')
        .eq('status', 'completed')
        .single();

      if (transaction) {
        // Process refund through API
        try {
          const refundResponse = await fetch(
            `${process.env.EXPO_PUBLIC_API_URL || 'https://vibe.volunteersinc.org'}/api/ezee/refund`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                transactionId: transaction.transaction_number,
                orderId: transaction.order_id,
                amount: transaction.amount,
                reason: 'Admin deregistration',
              }),
            }
          );

          const refundData = await refundResponse.json();
          if (refundData.success) {
            // Update transaction status
            await supabase
              .from('payment_transactions')
              .update({
                status: 'refunded',
                updated_at: new Date().toISOString(),
              })
              .eq('id', transaction.id);

            refundResult.refundProcessed = true;
          } else {
            refundResult.refundError = refundData.error || 'Refund processing failed';
          }
        } catch (refundError) {
          console.error('Refund error:', refundError);
          refundResult.refundError = 'Failed to process refund. Please process manually.';
        }
      } else {
        refundResult.refundError = 'Payment transaction not found';
      }
    }

    return { success: true, data: refundResult };
  } catch (error) {
    console.error('Error deregistering user:', error);
    return { success: false, error: 'Failed to deregister user' };
  }
}


// ==================== HELPER FUNCTIONS ====================

/**
 * Format event date for display
 */
export function formatEventDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format event time for display
 * Returns empty string if time is not provided
 */
export function formatEventTime(timeString: string | null | undefined): string {
  if (!timeString || typeof timeString !== 'string') {
    return '';
  }
  
  try {
    // Assuming time is in HH:MM:SS or HH:MM format
    const [hours, minutes] = timeString.split(':');
    if (!hours || !minutes) {
      return '';
    }
    const hour = parseInt(hours, 10);
    if (isNaN(hour)) {
      return '';
    }
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch (error) {
    console.warn('[eventsService] formatEventTime error:', error, 'timeString:', timeString);
    return '';
  }
}

/**
 * Check if event is happening today
 */
export function isEventToday(dateString: string): boolean {
  const eventDate = new Date(dateString);
  const today = new Date();
  return eventDate.toDateString() === today.toDateString();
}

/**
 * Check if event is in the past
 */
export function isEventPast(dateString: string): boolean {
  const eventDate = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return eventDate < today;
}

/**
 * Get days until event
 */
export function getDaysUntilEvent(dateString: string): number {
  const eventDate = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  eventDate.setHours(0, 0, 0, 0);
  const diffTime = eventDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format currency for display (JMD)
 */
export function formatCurrency(amount: number, currency: string = 'JMD'): string {
  return new Intl.NumberFormat('en-JM', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

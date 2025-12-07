/**
 * Event Tickets Service
 * Handles QR code generation, ticket management, and check-in functionality
 * File: services/eventTicketsService.ts
 */

import { supabase } from './supabase';
import { ApiResponse } from '../types';

export interface EventTicket {
  id: string;
  registrationId: string;
  ticketNumber: number;
  qrCode: string;
  checkedIn: boolean;
  checkedInAt?: string;
  checkedInBy?: string;
  createdAt: string;
}

export interface TicketWithRegistration extends EventTicket {
  registration?: {
    id: string;
    eventId: string;
    userId: string;
    ticketCount: number;
    user?: {
      id: string;
      fullName: string;
      email: string;
    };
    event?: {
      id: string;
      title: string;
      eventDate: string;
    };
  };
}

/**
 * Generate unique QR code string
 * Format: EVT-{eventId}-{registrationId}-{ticketNumber}-{random8chars}
 */
function generateQRCode(eventId: string, registrationId: string, ticketNumber: number): string {
  const randomString = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `EVT-${eventId}-${registrationId}-${ticketNumber}-${randomString}`;
}

/**
 * Transform database row to EventTicket
 */
function transformTicket(row: any): EventTicket {
  return {
    id: row.id,
    registrationId: row.registration_id,
    ticketNumber: row.ticket_number,
    qrCode: row.qr_code,
    checkedIn: row.checked_in || false,
    checkedInAt: row.checked_in_at,
    checkedInBy: row.checked_in_by,
    createdAt: row.created_at,
  };
}

/**
 * Generate tickets for a registration after successful payment
 * Creates unique QR codes for each ticket
 */
export async function generateTicketsForRegistration(
  registrationId: string,
  ticketCount: number,
  eventId: string
): Promise<ApiResponse<EventTicket[]>> {
  try {
    // Check if tickets already exist for this registration
    const { data: existingTickets } = await supabase
      .from('event_tickets')
      .select('id')
      .eq('registration_id', registrationId);

    if (existingTickets && existingTickets.length > 0) {
      // Tickets already exist, return them
      const { data: tickets } = await supabase
        .from('event_tickets')
        .select('*')
        .eq('registration_id', registrationId)
        .order('ticket_number', { ascending: true });

      if (tickets) {
        return {
          success: true,
          data: tickets.map(transformTicket),
        };
      }
    }

    // Generate new tickets
    const ticketsToInsert = [];
    for (let i = 1; i <= ticketCount; i++) {
      const qrCode = generateQRCode(eventId, registrationId, i);
      ticketsToInsert.push({
        registration_id: registrationId,
        ticket_number: i,
        qr_code: qrCode,
        checked_in: false,
      });
    }

    const { data: insertedTickets, error } = await supabase
      .from('event_tickets')
      .insert(ticketsToInsert)
      .select();

    if (error) throw error;

    return {
      success: true,
      data: insertedTickets.map(transformTicket),
    };
  } catch (error) {
    console.error('Error generating tickets:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate tickets',
    };
  }
}

/**
 * Get all tickets for a registration
 */
export async function getTicketsByRegistration(
  registrationId: string
): Promise<ApiResponse<EventTicket[]>> {
  try {
    const { data, error } = await supabase
      .from('event_tickets')
      .select('*')
      .eq('registration_id', registrationId)
      .order('ticket_number', { ascending: true });

    if (error) throw error;

    return {
      success: true,
      data: (data || []).map(transformTicket),
    };
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch tickets',
    };
  }
}

/**
 * Get ticket by QR code with registration details
 */
export async function getTicketByQRCode(qrCode: string): Promise<ApiResponse<TicketWithRegistration>> {
  try {
    const { data, error } = await supabase
      .from('event_tickets')
      .select(`
        *,
        registration:event_registrations(
          id,
          event_id,
          user_id,
          ticket_count,
          user:users(id, full_name, email),
          event:events(id, title, event_date)
        )
      `)
      .eq('qr_code', qrCode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return {
          success: false,
          error: 'Ticket not found',
        };
      }
      throw error;
    }

    return {
      success: true,
      data: {
        ...transformTicket(data),
        registration: data.registration ? {
          id: data.registration.id,
          eventId: data.registration.event_id,
          userId: data.registration.user_id,
          ticketCount: data.registration.ticket_count,
          user: data.registration.user ? {
            id: data.registration.user.id,
            fullName: data.registration.user.full_name,
            email: data.registration.user.email,
          } : undefined,
          event: data.registration.event ? {
            id: data.registration.event.id,
            title: data.registration.event.title,
            eventDate: data.registration.event.event_date,
          } : undefined,
        } : undefined,
      },
    };
  } catch (error) {
    console.error('Error fetching ticket by QR code:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch ticket',
    };
  }
}

/**
 * Check in a ticket by QR code
 * Only admins can check in tickets
 */
export async function checkInTicket(
  qrCode: string,
  adminUserId: string
): Promise<ApiResponse<{ ticket: EventTicket; attendeeName: string; ticketNumber: number }>> {
  try {
    // First, get the ticket
    const ticketResponse = await getTicketByQRCode(qrCode);
    if (!ticketResponse.success || !ticketResponse.data) {
      return {
        success: false,
        error: ticketResponse.error || 'Ticket not found',
      };
    }

    const ticket = ticketResponse.data;

    // Check if already checked in
    if (ticket.checkedIn) {
      return {
        success: false,
        error: `Ticket #${ticket.ticketNumber} has already been checked in`,
      };
    }

    // Update ticket
    const { data: updatedTicket, error } = await supabase
      .from('event_tickets')
      .update({
        checked_in: true,
        checked_in_at: new Date().toISOString(),
        checked_in_by: adminUserId,
      })
      .eq('id', ticket.id)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: {
        ticket: transformTicket(updatedTicket),
        attendeeName: ticket.registration?.user?.fullName || 'Unknown',
        ticketNumber: ticket.ticketNumber,
      },
    };
  } catch (error) {
    console.error('Error checking in ticket:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check in ticket',
    };
  }
}

/**
 * Get check-in statistics for a registration
 */
export async function getCheckInStats(registrationId: string): Promise<{
  totalTickets: number;
  checkedInCount: number;
  pendingCount: number;
}> {
  try {
    const { data, error } = await supabase
      .from('event_tickets')
      .select('checked_in')
      .eq('registration_id', registrationId);

    if (error) throw error;

    const totalTickets = data?.length || 0;
    const checkedInCount = data?.filter(t => t.checked_in).length || 0;
    const pendingCount = totalTickets - checkedInCount;

    return {
      totalTickets,
      checkedInCount,
      pendingCount,
    };
  } catch (error) {
    console.error('Error fetching check-in stats:', error);
    return {
      totalTickets: 0,
      checkedInCount: 0,
      pendingCount: 0,
    };
  }
}

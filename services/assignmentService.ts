/**
 * Assignment Service
 * Handles assignment of events and opportunities to sup (supervisor) roles
 * File: services/assignmentService.ts
 */

import { supabase } from './supabase';
import { ApiResponse } from '../types';

// ==================== TYPES ====================

export interface EventAssignment {
  id: string;
  eventId: string;
  assignedTo: string;
  assignedBy: string;
  assignedAt: string;
  notes?: string;
  assignedToUser?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
    email: string;
  };
  assignedByUser?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
  event?: {
    id: string;
    title: string;
  };
}

export interface OpportunityAssignment {
  id: string;
  opportunityId: string;
  assignedTo: string;
  assignedBy: string;
  assignedAt: string;
  notes?: string;
  assignedToUser?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
    email: string;
  };
  assignedByUser?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
  opportunity?: {
    id: string;
    title: string;
  };
}

// ==================== EVENT ASSIGNMENTS ====================

/**
 * Assign an event to a sup role
 * Only admins can create assignments
 */
export async function assignEventToSup(data: {
  eventId: string;
  assignedTo: string;
  notes?: string;
}): Promise<ApiResponse<EventAssignment>> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: assignment, error } = await supabase
      .from('event_assignments')
      .insert({
        event_id: data.eventId,
        assigned_to: data.assignedTo,
        assigned_by: session.session.user.id,
        notes: data.notes || null,
      })
      .select(`
        *,
        assigned_to_user:users!assigned_to(id, full_name, avatar_url, email),
        assigned_by_user:users!assigned_by(id, full_name, avatar_url),
        event:events(id, title)
      `)
      .single();

    if (error) throw error;

    return {
      success: true,
      data: {
        id: assignment.id,
        eventId: assignment.event_id,
        assignedTo: assignment.assigned_to,
        assignedBy: assignment.assigned_by,
        assignedAt: assignment.assigned_at,
        notes: assignment.notes,
        assignedToUser: assignment.assigned_to_user,
        assignedByUser: assignment.assigned_by_user,
        event: assignment.event,
      },
    };
  } catch (error: any) {
    console.error('Error assigning event:', error);
    return { success: false, error: error.message || 'Failed to assign event' };
  }
}

/**
 * Remove an event assignment
 * Only admins can remove assignments
 */
export async function unassignEventFromSup(assignmentId: string): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase
      .from('event_assignments')
      .delete()
      .eq('id', assignmentId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error unassigning event:', error);
    return { success: false, error: error.message || 'Failed to unassign event' };
  }
}

/**
 * Get all assignments for an event
 */
export async function getEventAssignments(eventId: string): Promise<ApiResponse<EventAssignment[]>> {
  try {
    const { data, error } = await supabase
      .from('event_assignments')
      .select(`
        *,
        assigned_to_user:users!assigned_to(id, full_name, avatar_url, email),
        assigned_by_user:users!assigned_by(id, full_name, avatar_url),
        event:events(id, title)
      `)
      .eq('event_id', eventId)
      .order('assigned_at', { ascending: false });

    if (error) throw error;

    return {
      success: true,
      data: (data || []).map((assignment) => ({
        id: assignment.id,
        eventId: assignment.event_id,
        assignedTo: assignment.assigned_to,
        assignedBy: assignment.assigned_by,
        assignedAt: assignment.assigned_at,
        notes: assignment.notes,
        assignedToUser: assignment.assigned_to_user,
        assignedByUser: assignment.assigned_by_user,
        event: assignment.event,
      })),
    };
  } catch (error: any) {
    console.error('Error fetching event assignments:', error);
    return { success: false, error: error.message || 'Failed to fetch assignments' };
  }
}

/**
 * Get all events assigned to a sup user
 */
export async function getAssignedEventsForSup(userId: string): Promise<ApiResponse<EventAssignment[]>> {
  try {
    const { data, error } = await supabase
      .from('event_assignments')
      .select(`
        *,
        assigned_to_user:users!assigned_to(id, full_name, avatar_url, email),
        assigned_by_user:users!assigned_by(id, full_name, avatar_url),
        event:events(id, title)
      `)
      .eq('assigned_to', userId)
      .order('assigned_at', { ascending: false });

    if (error) throw error;

    return {
      success: true,
      data: (data || []).map((assignment) => ({
        id: assignment.id,
        eventId: assignment.event_id,
        assignedTo: assignment.assigned_to,
        assignedBy: assignment.assigned_by,
        assignedAt: assignment.assigned_at,
        notes: assignment.notes,
        assignedToUser: assignment.assigned_to_user,
        assignedByUser: assignment.assigned_by_user,
        event: assignment.event,
      })),
    };
  } catch (error: any) {
    console.error('Error fetching assigned events:', error);
    return { success: false, error: error.message || 'Failed to fetch assigned events' };
  }
}

// ==================== OPPORTUNITY ASSIGNMENTS ====================

/**
 * Assign an opportunity to a sup role
 * Only admins can create assignments
 */
export async function assignOpportunityToSup(data: {
  opportunityId: string;
  assignedTo: string;
  notes?: string;
}): Promise<ApiResponse<OpportunityAssignment>> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: assignment, error } = await supabase
      .from('opportunity_assignments')
      .insert({
        opportunity_id: data.opportunityId,
        assigned_to: data.assignedTo,
        assigned_by: session.session.user.id,
        notes: data.notes || null,
      })
      .select(`
        *,
        assigned_to_user:users!assigned_to(id, full_name, avatar_url, email),
        assigned_by_user:users!assigned_by(id, full_name, avatar_url),
        opportunity:opportunities(id, title)
      `)
      .single();

    if (error) throw error;

    return {
      success: true,
      data: {
        id: assignment.id,
        opportunityId: assignment.opportunity_id,
        assignedTo: assignment.assigned_to,
        assignedBy: assignment.assigned_by,
        assignedAt: assignment.assigned_at,
        notes: assignment.notes,
        assignedToUser: assignment.assigned_to_user,
        assignedByUser: assignment.assigned_by_user,
        opportunity: assignment.opportunity,
      },
    };
  } catch (error: any) {
    console.error('Error assigning opportunity:', error);
    return { success: false, error: error.message || 'Failed to assign opportunity' };
  }
}

/**
 * Remove an opportunity assignment
 * Only admins can remove assignments
 */
export async function unassignOpportunityFromSup(assignmentId: string): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase
      .from('opportunity_assignments')
      .delete()
      .eq('id', assignmentId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error unassigning opportunity:', error);
    return { success: false, error: error.message || 'Failed to unassign opportunity' };
  }
}

/**
 * Get all assignments for an opportunity
 */
export async function getOpportunityAssignments(opportunityId: string): Promise<ApiResponse<OpportunityAssignment[]>> {
  try {
    const { data, error } = await supabase
      .from('opportunity_assignments')
      .select(`
        *,
        assigned_to_user:users!assigned_to(id, full_name, avatar_url, email),
        assigned_by_user:users!assigned_by(id, full_name, avatar_url),
        opportunity:opportunities(id, title)
      `)
      .eq('opportunity_id', opportunityId)
      .order('assigned_at', { ascending: false });

    if (error) throw error;

    return {
      success: true,
      data: (data || []).map((assignment) => ({
        id: assignment.id,
        opportunityId: assignment.opportunity_id,
        assignedTo: assignment.assigned_to,
        assignedBy: assignment.assigned_by,
        assignedAt: assignment.assigned_at,
        notes: assignment.notes,
        assignedToUser: assignment.assigned_to_user,
        assignedByUser: assignment.assigned_by_user,
        opportunity: assignment.opportunity,
      })),
    };
  } catch (error: any) {
    console.error('Error fetching opportunity assignments:', error);
    return { success: false, error: error.message || 'Failed to fetch assignments' };
  }
}

/**
 * Get all opportunities assigned to a sup user
 */
export async function getAssignedOpportunitiesForSup(userId: string): Promise<ApiResponse<OpportunityAssignment[]>> {
  try {
    const { data, error } = await supabase
      .from('opportunity_assignments')
      .select(`
        *,
        assigned_to_user:users!assigned_to(id, full_name, avatar_url, email),
        assigned_by_user:users!assigned_by(id, full_name, avatar_url),
        opportunity:opportunities(id, title)
      `)
      .eq('assigned_to', userId)
      .order('assigned_at', { ascending: false });

    if (error) throw error;

    return {
      success: true,
      data: (data || []).map((assignment) => ({
        id: assignment.id,
        opportunityId: assignment.opportunity_id,
        assignedTo: assignment.assigned_to,
        assignedBy: assignment.assigned_by,
        assignedAt: assignment.assigned_at,
        notes: assignment.notes,
        assignedToUser: assignment.assigned_to_user,
        assignedByUser: assignment.assigned_by_user,
        opportunity: assignment.opportunity,
      })),
    };
  } catch (error: any) {
    console.error('Error fetching assigned opportunities:', error);
    return { success: false, error: error.message || 'Failed to fetch assigned opportunities' };
  }
}

/**
 * Get all sup users (for assignment dropdown)
 */
export async function getSupUsers(): Promise<ApiResponse<Array<{ id: string; fullName: string; email: string; avatarUrl?: string }>>> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, avatar_url')
      .eq('role', 'sup')
      .order('full_name', { ascending: true });

    if (error) throw error;

    return {
      success: true,
      data: (data || []).map((user) => ({
        id: user.id,
        fullName: user.full_name || 'Unknown',
        email: user.email || '',
        avatarUrl: user.avatar_url,
      })),
    };
  } catch (error: any) {
    console.error('Error fetching sup users:', error);
    return { success: false, error: error.message || 'Failed to fetch sup users' };
  }
}


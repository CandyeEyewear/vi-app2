/**
 * Causes Service
 * Handles all fundraising/donation related operations
 * File: services/causesService.ts
 */

import { supabase } from './supabase';
import {
  Cause,
  CauseCategory,
  CauseStatus,
  Donation,
  RecurringDonation,
  RecurringFrequency,
  DonorBadge,
  ApiResponse,
} from '../types';
import { formatStorageUrl } from '../utils/storageHelpers';

// Helper to check if string is a valid UUID
const isValidUUID = (str: string): boolean => {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate real-time amount_raised from completed donations for a cause
 */
async function calculateAmountRaised(causeId: string): Promise<number> {
  try {
    const { data: donationsData, error: donationsError } = await supabase
      .from('donations')
      .select('amount')
      .eq('cause_id', causeId)
      .eq('payment_status', 'completed');

    if (donationsError || !donationsData) {
      return 0;
    }

    return donationsData.reduce((sum, donation) => {
      return sum + (parseFloat(donation.amount) || 0);
    }, 0);
  } catch (error) {
    console.error('Error calculating amount raised:', error);
    return 0;
  }
}

/**
 * Transform database row (snake_case) to Cause object (camelCase)
 */
function transformCause(row: any): Cause {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    imageUrl: formatStorageUrl(row.image_url),
    goalAmount: parseFloat(row.goal_amount) || 0,
    amountRaised: parseFloat(row.amount_raised) || 0,
    currency: row.currency || 'JMD',
    startDate: row.start_date,
    endDate: row.end_date,
    isDonationsPublic: row.is_donations_public ?? true,
    allowRecurring: row.allow_recurring ?? true,
    minimumDonation: parseFloat(row.minimum_donation) || 0,
    status: row.status,
    isFeatured: row.is_featured ?? false,
    visibility: row.visibility || 'public',
    donorCount: row.donor_count || 0,
    createdBy: row.created_by,
    creator: row.creator ? {
      id: row.creator.id,
      fullName: row.creator.full_name,
      avatarUrl: row.creator.avatar_url,
    } : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as Cause;
}

/**
 * Transform database row to Donation object
 */
function transformDonation(row: any): Donation {
  return {
    id: row.id,
    causeId: row.cause_id,
    cause: row.cause ? transformCause(row.cause) : undefined,
    userId: row.user_id,
    user: row.user ? {
      id: row.user.id,
      fullName: row.user.full_name,
      avatarUrl: row.user.avatar_url,
    } : undefined,
    amount: parseFloat(row.amount) || 0,
    currency: row.currency || 'JMD',
    donorName: row.donor_name,
    donorEmail: row.donor_email,
    isAnonymous: row.is_anonymous ?? false,
    paymentStatus: row.payment_status,
    transactionNumber: row.transaction_number,
    paymentMethod: row.payment_method,
    message: row.message,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  } as Donation;
}

/**
 * Transform database row to RecurringDonation object
 */
function transformRecurringDonation(row: any): RecurringDonation {
  return {
    id: row.id,
    causeId: row.cause_id,
    cause: row.cause ? transformCause(row.cause) : undefined,
    userId: row.user_id,
    user: row.user ? {
      id: row.user.id,
      fullName: row.user.full_name,
      avatarUrl: row.user.avatar_url,
    } : undefined,
    amount: parseFloat(row.amount) || 0,
    currency: row.currency || 'JMD',
    frequency: row.frequency,
    subscriptionId: row.subscription_id,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    nextBillingDate: row.next_billing_date,
    lastBillingDate: row.last_billing_date,
    totalDonated: parseFloat(row.total_donated) || 0,
    donationCount: row.donation_count || 0,
    isAnonymous: row.is_anonymous ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cancelledAt: row.cancelled_at,
  } as RecurringDonation;
}

/**
 * Transform database row to DonorBadge object
 */
function transformDonorBadge(row: any): DonorBadge {
  return {
    id: row.id,
    userId: row.user_id,
    badgeType: row.badge_type,
    causeId: row.cause_id,
    earnedAt: row.earned_at,
  };
}

// ==================== CAUSE FUNCTIONS ====================

/**
 * Fetch all causes with optional filters
 * Filters visibility based on user's premium membership status
 */
export async function getCauses(options?: {
  category?: CauseCategory | 'all';
  status?: CauseStatus;
  featured?: boolean;
  limit?: number;
  offset?: number;
  searchQuery?: string;
  userId?: string; // Optional: if provided, will filter based on user's membership
}): Promise<ApiResponse<Cause[]>> {
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
      .from('causes')
      .select(`
        *,
        creator:users!created_by(id, full_name, avatar_url)
      `)
      .order('created_at', { ascending: false });

    // Apply status filters
    // For non-admin users: Always filter to only show active causes
    // Admins can see all statuses if explicitly requested
    if (options?.status) {
      if (isAdmin) {
        // Admins can see any status they request
        query = query.eq('status', options.status);
      } else {
        // Non-admin users can only see active causes, regardless of requested status
        query = query.eq('status', 'active');
      }
    } else {
      // Default to active causes for everyone
      query = query.eq('status', 'active');
    }

    // For non-admin users: Hide causes that have passed their end date
    if (!isAdmin) {
      const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
      // Only show causes where end_date is null OR end_date >= today
      query = query.or(`end_date.is.null,end_date.gte.${today}`);
    }
    // Admins see all causes regardless of end date

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
      query = query.or(`title.ilike.%${options.searchQuery}%,description.ilike.%${options.searchQuery}%`);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Recalculate amount_raised from actual donations for all causes
    const causesWithRecalculatedAmounts = await Promise.all(
      (data || []).map(async (cause) => {
        const realAmountRaised = await calculateAmountRaised(cause.id);
        cause.amount_raised = realAmountRaised.toString();
        return transformCause(cause);
      })
    );

    return { success: true, data: causesWithRecalculatedAmounts };
  } catch (error) {
    console.error('Error fetching causes:', error);
    return { success: false, error: 'Failed to fetch causes' };
  }
}

/**
 * Fetch a single cause by identifier (UUID or slug)
 */
export async function getCauseById(
  identifier: string,
  userId?: string
): Promise<ApiResponse<Cause>> {
  try {
    // Check if user is admin (if userId provided)
    let isAdmin = false;
    if (userId) {
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();
      
      isAdmin = userData?.role === 'admin';
    }

    const baseQuery = supabase
      .from('causes')
      .select(`
        *,
        creator:users!created_by(id, full_name, avatar_url)
      `);

    let finalQuery = isValidUUID(identifier)
      ? baseQuery.eq('id', identifier)
      : baseQuery.eq('slug', identifier);

    // For non-admin users (or when userId is not provided): Only allow access to active causes that haven't passed their end date
    if (!isAdmin) {
      finalQuery = finalQuery.eq('status', 'active');
      
      const today = new Date().toISOString().split('T')[0];
      finalQuery = finalQuery.or(`end_date.is.null,end_date.gte.${today}`);
    }

    const { data, error } = await finalQuery.single();

    if (error) throw error;

    if (!data) {
      return { success: false, error: 'Cause not found' };
    }

    // Calculate real-time amount_raised from completed donations
    const realAmountRaised = await calculateAmountRaised(data.id);
    
    // Update the data with real-time amount_raised (always set, even if 0)
    data.amount_raised = realAmountRaised.toString();

    return { success: true, data: transformCause(data) };
  } catch (error) {
    console.error('Error fetching cause:', error);
    return { success: false, error: 'Failed to fetch cause' };
  }
}

export async function getCauseBySlug(
  identifier: string,
  userId?: string
): Promise<ApiResponse<Cause>> {
  return getCauseById(identifier, userId);
}

/**
 * Create a new cause (Admin only)
 */
export async function createCause(causeData: {
  title: string;
  description: string;
  category: CauseCategory;
  goalAmount: number;
  endDate?: string;
  imageUrl?: string;
  isDonationsPublic?: boolean;
  allowRecurring?: boolean;
  minimumDonation?: number;
  createdBy: string;
  visibility?: 'public' | 'members_only';
}): Promise<ApiResponse<Cause>> {
  try {
    const { data, error } = await supabase
      .from('causes')
      .insert({
        title: causeData.title,
        description: causeData.description,
        category: causeData.category,
        goal_amount: causeData.goalAmount,
        end_date: causeData.endDate,
        image_url: causeData.imageUrl,
        is_donations_public: causeData.isDonationsPublic ?? true,
        allow_recurring: causeData.allowRecurring ?? true,
        minimum_donation: causeData.minimumDonation ?? 0,
        created_by: causeData.createdBy,
        visibility: causeData.visibility || 'public',
        status: 'active',
      })
      .select(`
        *,
        creator:users!created_by(id, full_name, avatar_url)
      `)
      .single();

    if (error) throw error;

    return { success: true, data: transformCause(data) };
  } catch (error) {
    console.error('Error creating cause:', error);
    return { success: false, error: 'Failed to create cause' };
  }
}

/**
 * Update a cause (Admin only)
 */
export async function updateCause(
  causeId: string,
  updates: Partial<{
    title: string;
    description: string;
    category: CauseCategory;
    goalAmount: number;
    endDate: string;
    imageUrl: string;
    isDonationsPublic: boolean;
    allowRecurring: boolean;
    minimumDonation: number;
    status: CauseStatus;
    isFeatured: boolean;
    visibility: 'public' | 'members_only';
  }>
): Promise<ApiResponse<Cause>> {
  try {
    const updateData: any = {};
    
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.goalAmount !== undefined) updateData.goal_amount = updates.goalAmount;
    if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
    if (updates.imageUrl !== undefined) updateData.image_url = updates.imageUrl;
    if (updates.isDonationsPublic !== undefined) updateData.is_donations_public = updates.isDonationsPublic;
    if (updates.allowRecurring !== undefined) updateData.allow_recurring = updates.allowRecurring;
    if (updates.minimumDonation !== undefined) updateData.minimum_donation = updates.minimumDonation;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.isFeatured !== undefined) updateData.is_featured = updates.isFeatured;
    if (updates.visibility !== undefined) updateData.visibility = updates.visibility;

    const { data, error } = await supabase
      .from('causes')
      .update(updateData)
      .eq('id', causeId)
      .select(`
        *,
        creator:users!created_by(id, full_name, avatar_url)
      `)
      .single();

    if (error) throw error;

    return { success: true, data: transformCause(data) };
  } catch (error) {
    console.error('Error updating cause:', error);
    return { success: false, error: 'Failed to update cause' };
  }
}

/**
 * Delete a cause (Admin only)
 */
export async function deleteCause(causeId: string): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase
      .from('causes')
      .delete()
      .eq('id', causeId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error deleting cause:', error);
    return { success: false, error: 'Failed to delete cause' };
  }
}


// ==================== DONATION FUNCTIONS ====================

/**
 * Fetch donations for a specific cause (public ones)
 */
export async function getCauseDonations(
  identifier: string,
  options?: {
    limit?: number;
    offset?: number;
    includeAnonymous?: boolean;
  }
): Promise<ApiResponse<Donation[]>> {
  try {
    const causeResult = await getCauseById(identifier, undefined);

    if (!causeResult.success || !causeResult.data) {
      return { success: false, error: causeResult.error || 'Cause not found' };
    }

    const causeId = causeResult.data.id;

    let query = supabase
      .from('donations')
      .select(`
        *,
        user:users(id, full_name, avatar_url)
      `)
      .eq('cause_id', causeId)
      .eq('payment_status', 'completed')
      .order('created_at', { ascending: false });

    if (!options?.includeAnonymous) {
      query = query.eq('is_anonymous', false);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;

    const donations = data?.map(transformDonation) || [];

    return { success: true, data: donations };
  } catch (error) {
    console.error('Error fetching donations:', error);
    return { success: false, error: 'Failed to fetch donations' };
  }
}

/**
 * Create a donation record (before payment)
 */
export async function createDonation(data: {
  causeId: string;
  amount: number;
  userId?: string;
  donorName?: string;
  donorEmail?: string;
  isAnonymous?: boolean;
  message?: string;
}): Promise<ApiResponse<Donation>> {
  try {
    const { data: donation, error } = await supabase
      .from('donations')
      .insert({
        cause_id: data.causeId,
        amount: data.amount,
        user_id: data.userId,
        donor_name: data.donorName,
        donor_email: data.donorEmail,
        is_anonymous: data.isAnonymous ?? false,
        message: data.message,
        payment_status: 'pending',
        currency: 'JMD',
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: transformDonation(donation) };
  } catch (error) {
    console.error('Error creating donation:', error);
    return { success: false, error: 'Failed to create donation' };
  }
}

/**
 * Update donation status after payment
 */
export async function updateDonationStatus(
  donationId: string,
  status: 'completed' | 'failed' | 'refunded',
  transactionNumber?: string
): Promise<ApiResponse<Donation>> {
  try {
    const updateData: any = {
      payment_status: status,
    };

    if (transactionNumber) {
      updateData.transaction_number = transactionNumber;
    }

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('donations')
      .update(updateData)
      .eq('id', donationId)
      .select()
      .single();

    if (error) throw error;

    // If completed, update user's donation stats
    if (status === 'completed' && data.user_id) {
      await updateUserDonationStats(data.user_id);
    }

    return { success: true, data: transformDonation(data) };
  } catch (error) {
    console.error('Error updating donation status:', error);
    return { success: false, error: 'Failed to update donation status' };
  }
}

/**
 * Get user's donation history
 */
export async function getUserDonations(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<ApiResponse<Donation[]>> {
  try {
    let query = supabase
      .from('donations')
      .select(`
        *,
        cause:causes(id, title, image_url, status)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;

    const donations = data?.map(transformDonation) || [];

    return { success: true, data: donations };
  } catch (error) {
    console.error('Error fetching user donations:', error);
    return { success: false, error: 'Failed to fetch donations' };
  }
}


// ==================== RECURRING DONATION FUNCTIONS ====================

/**
 * Create a recurring donation
 */
export async function createRecurringDonation(data: {
  causeId: string;
  userId: string;
  amount: number;
  frequency: RecurringFrequency;
  subscriptionId: string;
  isAnonymous?: boolean;
  endDate?: string;
}): Promise<ApiResponse<RecurringDonation>> {
  try {
    const { data: recurring, error } = await supabase
      .from('recurring_donations')
      .insert({
        cause_id: data.causeId,
        user_id: data.userId,
        amount: data.amount,
        frequency: data.frequency,
        subscription_id: data.subscriptionId,
        is_anonymous: data.isAnonymous ?? false,
        end_date: data.endDate,
        status: 'active',
        currency: 'JMD',
        start_date: new Date().toISOString(),
        next_billing_date: calculateNextBillingDate(data.frequency),
      })
      .select()
      .single();

    if (error) throw error;

    // Award recurring supporter badge
    await awardDonorBadge(data.userId, 'recurring_supporter');

    return { success: true, data: transformRecurringDonation(recurring) };
  } catch (error) {
    console.error('Error creating recurring donation:', error);
    return { success: false, error: 'Failed to create recurring donation' };
  }
}

/**
 * Get user's recurring donations
 */
export async function getUserRecurringDonations(
  userId: string
): Promise<ApiResponse<RecurringDonation[]>> {
  try {
    const { data, error } = await supabase
      .from('recurring_donations')
      .select(`
        *,
        cause:causes(id, title, image_url, status)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const donations = data?.map(transformRecurringDonation) || [];

    return { success: true, data: donations };
  } catch (error) {
    console.error('Error fetching recurring donations:', error);
    return { success: false, error: 'Failed to fetch recurring donations' };
  }
}

/**
 * Update recurring donation status
 */
export async function updateRecurringDonationStatus(
  recurringId: string,
  status: 'active' | 'paused' | 'cancelled'
): Promise<ApiResponse<RecurringDonation>> {
  try {
    const updateData: any = { status };

    if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('recurring_donations')
      .update(updateData)
      .eq('id', recurringId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: transformRecurringDonation(data) };
  } catch (error) {
    console.error('Error updating recurring donation:', error);
    return { success: false, error: 'Failed to update recurring donation' };
  }
}

/**
 * Cancel a recurring donation
 */
export async function cancelRecurringDonation(
  recurringId: string
): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase
      .from('recurring_donations')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', recurringId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error cancelling recurring donation:', error);
    return { success: false, error: 'Failed to cancel recurring donation' };
  }
}


// ==================== DONOR BADGE FUNCTIONS ====================

/**
 * Get user's donor badges
 */
export async function getUserDonorBadges(
  userId: string
): Promise<ApiResponse<DonorBadge[]>> {
  try {
    const { data, error } = await supabase
      .from('donor_badges')
      .select('*')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });

    if (error) throw error;

    const badges = data?.map(transformDonorBadge) || [];

    return { success: true, data: badges };
  } catch (error) {
    console.error('Error fetching donor badges:', error);
    return { success: false, error: 'Failed to fetch badges' };
  }
}

/**
 * Award a donor badge to a user
 */
export async function awardDonorBadge(
  userId: string,
  badgeType: DonorBadge['badgeType'],
  causeId?: string
): Promise<ApiResponse<DonorBadge>> {
  try {
    // Check if badge already exists (except cause_champion which can be multiple)
    if (badgeType !== 'cause_champion') {
      const { data: existing } = await supabase
        .from('donor_badges')
        .select('id')
        .eq('user_id', userId)
        .eq('badge_type', badgeType)
        .single();

      if (existing) {
        return { success: false, error: 'Badge already awarded' };
      }
    }

    const { data, error } = await supabase
      .from('donor_badges')
      .insert({
        user_id: userId,
        badge_type: badgeType,
        cause_id: causeId,
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: transformDonorBadge(data) };
  } catch (error) {
    console.error('Error awarding badge:', error);
    return { success: false, error: 'Failed to award badge' };
  }
}

/**
 * Check and award tier badges based on total donated
 */
export async function checkAndAwardTierBadges(userId: string): Promise<void> {
  try {
    // Get user's total donated
    const { data: userData } = await supabase
      .from('users')
      .select('total_donated')
      .eq('id', userId)
      .single();

    if (!userData) return;

    const totalDonated = parseFloat(userData.total_donated) || 0;

    // Badge thresholds (in JMD)
    const thresholds: { badge: DonorBadge['badgeType']; amount: number }[] = [
      { badge: 'champion_donor', amount: 50000 },
      { badge: 'platinum_donor', amount: 25000 },
      { badge: 'gold_donor', amount: 10000 },
      { badge: 'silver_donor', amount: 5000 },
      { badge: 'bronze_donor', amount: 1000 },
    ];

    for (const { badge, amount } of thresholds) {
      if (totalDonated >= amount) {
        await awardDonorBadge(userId, badge);
        break; // Only award highest tier
      }
    }
  } catch (error) {
    console.error('Error checking tier badges:', error);
  }
}


// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate next billing date based on frequency
 */
function calculateNextBillingDate(frequency: RecurringFrequency): string {
  const now = new Date();
  
  switch (frequency) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      break;
    case 'weekly':
      now.setDate(now.getDate() + 7);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      break;
    case 'quarterly':
      now.setMonth(now.getMonth() + 3);
      break;
    case 'annually':
      now.setFullYear(now.getFullYear() + 1);
      break;
  }
  
  return now.toISOString();
}

/**
 * Update user's total donation stats
 */
async function updateUserDonationStats(userId: string): Promise<void> {
  try {
    // Calculate totals from completed donations
    const { data: donations } = await supabase
      .from('donations')
      .select('amount')
      .eq('user_id', userId)
      .eq('payment_status', 'completed');

    if (!donations) return;

    const totalDonated = donations.reduce((sum, d) => sum + parseFloat(d.amount), 0);
    const donationCount = donations.length;

    // Update user stats
    await supabase
      .from('users')
      .update({
        total_donated: totalDonated,
        donation_count: donationCount,
      })
      .eq('id', userId);

    // Check and award first donation badge
    if (donationCount === 1) {
      await awardDonorBadge(userId, 'first_donation');
    }

    // Check and award tier badges
    await checkAndAwardTierBadges(userId);
  } catch (error) {
    console.error('Error updating user donation stats:', error);
  }
}

/**
 * Get cause progress percentage
 */
export function getCauseProgress(cause: Cause): number {
  const goalAmount = Number(cause.goalAmount) || 0;
  const amountRaised = Number(cause.amountRaised) || 0;
  
  if (goalAmount <= 0 || isNaN(goalAmount) || isNaN(amountRaised)) return 0;
  const progress = (amountRaised / goalAmount) * 100;
  return Math.min(progress, 100); // Cap at 100%
}

/**
 * Get days remaining for a cause
 */
export function getCauseDaysRemaining(cause: Cause): number | null {
  if (!cause.endDate) return null;
  
  const endDate = new Date(cause.endDate);
  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

/**
 * Format currency for display (JMD)
 */
export function formatCurrency(amount: number | null | undefined, currency: string = 'JMD'): string {
  // Handle null, undefined, or NaN values
  if (amount == null || isNaN(amount)) {
    return new Intl.NumberFormat('en-JM', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(0);
  }
  
  return new Intl.NumberFormat('en-JM', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

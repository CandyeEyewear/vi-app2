/**
 * User Data Transformation Utilities
 * Converts between database schema (snake_case) and app types (camelCase)
 */

import { User, UserRole } from '../types';

/**
 * Database user row shape (from Supabase)
 *
 * Note: this is a best-effort mirror of the `public.users` table columns that
 * are used throughout the app. Add/adjust fields as your schema evolves.
 */
export interface DbUser {
  id: string;
  slug: string | null;
  email: string;

  full_name: string | null;
  phone: string | null;
  location: string | null;
  country: string | null;
  bio: string | null;
  areas_of_expertise: string[] | null;
  education: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;

  role: string;
  membership_tier: string | null;
  membership_status: string | null;

  is_private: boolean | null;

  // Stats
  total_hours: number | null;
  activities_completed: number | null;
  organizations_helped: number | null;

  // Organization fields
  account_type: string | null;
  approval_status: string | null;
  is_partner_organization: boolean | null;
  partner_org_id: string | null;
  organization_data: any | null;

  // Moderation fields (optional)
  is_banned?: boolean | null;
  banned_until?: string | null;
  ban_reason?: string | null;

  // Streak fields (optional)
  current_streak?: number | null;
  longest_streak?: number | null;
  last_activity_date?: string | null;

  // Donation stats (optional)
  total_donated?: number | null;
  donation_count?: number | null;
  donor_badges?: any | null;

  created_at: string;
  updated_at: string;

  // Catch-all for additional columns without breaking callers
  [key: string]: any;
}

function coerceUserRole(role: unknown): UserRole {
  if (role === 'admin') return 'admin';
  if (role === 'sup') return 'sup';
  return 'volunteer';
}

function coerceAccountType(accountType: unknown): User['account_type'] {
  // App code mostly checks for `=== 'organization'`; everything else is treated as a volunteer.
  return accountType === 'organization' ? 'organization' : 'volunteer';
}

/**
 * Transform database user to app `User` type
 */
export function mapDbUserToUser(dbUser: DbUser): User {
  return {
    id: dbUser.id,
    slug: dbUser.slug ?? '',
    email: dbUser.email,

    fullName: dbUser.full_name || '',
    phone: dbUser.phone || '',
    location: dbUser.location || '',
    country: dbUser.country || '',
    bio: dbUser.bio || '',
    areasOfExpertise: dbUser.areas_of_expertise || [],
    education: dbUser.education || '',
    avatarUrl: dbUser.avatar_url || '',
    dateOfBirth: dbUser.date_of_birth || '',

    role: coerceUserRole(dbUser.role),
    membershipTier: (dbUser.membership_tier as User['membershipTier']) ?? 'free',
    membershipStatus: (dbUser.membership_status as User['membershipStatus']) ?? 'inactive',
    isPrivate: dbUser.is_private || false,

    totalHours: dbUser.total_hours || 0,
    activitiesCompleted: dbUser.activities_completed || 0,
    organizationsHelped: dbUser.organizations_helped || 0,

    achievements: [],

    account_type: coerceAccountType(dbUser.account_type),
    approval_status: (dbUser.approval_status as User['approval_status']) ?? undefined,
    is_partner_organization: dbUser.is_partner_organization || false,
    partner_org_id: dbUser.partner_org_id ?? null,
    organization_data: (dbUser.organization_data as User['organization_data']) ?? null,

    isBanned: dbUser.is_banned ?? undefined,
    bannedUntil: dbUser.banned_until || undefined,
    banReason: dbUser.ban_reason || undefined,

    currentStreak: dbUser.current_streak ?? undefined,
    longestStreak: dbUser.longest_streak ?? undefined,
    lastActivityDate: dbUser.last_activity_date || undefined,

    totalDonated: dbUser.total_donated ?? undefined,
    donationCount: dbUser.donation_count ?? undefined,
    donorBadges: (dbUser.donor_badges as User['donorBadges']) ?? undefined,

    // Messaging presence (optional columns in DB)
    onlineStatus: typeof dbUser.online_status === 'boolean' ? (dbUser.online_status as boolean) : undefined,
    lastSeen: typeof dbUser.last_seen === 'string' ? (dbUser.last_seen as string) : undefined,

    createdAt: dbUser.created_at,
    updatedAt: dbUser.updated_at,
  };
}

/**
 * Transform app `User` updates to database format
 */
export function mapUserToDbUser(user: Partial<User>): Partial<DbUser> {
  const dbUser: Partial<DbUser> = {};

  if (user.slug !== undefined) dbUser.slug = user.slug;

  if (user.fullName !== undefined) dbUser.full_name = user.fullName;
  if (user.phone !== undefined) dbUser.phone = user.phone;
  if (user.location !== undefined) dbUser.location = user.location;
  if (user.country !== undefined) dbUser.country = user.country ?? null;
  if (user.bio !== undefined) dbUser.bio = user.bio ?? null;
  if (user.areasOfExpertise !== undefined) dbUser.areas_of_expertise = user.areasOfExpertise ?? null;
  if (user.education !== undefined) dbUser.education = user.education ?? null;
  if (user.avatarUrl !== undefined) dbUser.avatar_url = user.avatarUrl ?? null;
  if (user.dateOfBirth !== undefined) dbUser.date_of_birth = user.dateOfBirth ?? null;
  if (user.isPrivate !== undefined) dbUser.is_private = user.isPrivate;

  if (user.account_type !== undefined) dbUser.account_type = user.account_type;
  if (user.approval_status !== undefined) dbUser.approval_status = user.approval_status ?? null;
  if (user.is_partner_organization !== undefined) dbUser.is_partner_organization = user.is_partner_organization;
  if (user.organization_data !== undefined) dbUser.organization_data = user.organization_data ?? null;

  if (user.isBanned !== undefined) dbUser.is_banned = user.isBanned;
  if (user.bannedUntil !== undefined) dbUser.banned_until = user.bannedUntil ?? null;
  if (user.banReason !== undefined) dbUser.ban_reason = user.banReason ?? null;

  if (user.currentStreak !== undefined) dbUser.current_streak = user.currentStreak ?? null;
  if (user.longestStreak !== undefined) dbUser.longest_streak = user.longestStreak ?? null;
  if (user.lastActivityDate !== undefined) dbUser.last_activity_date = user.lastActivityDate ?? null;

  if (user.totalDonated !== undefined) dbUser.total_donated = user.totalDonated ?? null;
  if (user.donationCount !== undefined) dbUser.donation_count = user.donationCount ?? null;
  if (user.donorBadges !== undefined) dbUser.donor_badges = user.donorBadges as any;

  return dbUser;
}

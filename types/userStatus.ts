/**
 * User Status Types
 * Defines membership and verification status
 */

// Match these to actual database values found in audit
export type UserRole = 'admin' | 'volunteer';

export type MembershipStatus = 'inactive' | 'active' | 'expired' | 'cancelled';

export type MembershipTier = 'free' | 'premium';

export interface UserStatus {
  role: UserRole;
  membershipTier?: MembershipTier;
  membershipStatus?: MembershipStatus;
  isVerified?: boolean;  // Derived from membershipStatus === 'active' OR separate field
}

// Helper to determine if user should show premium indicators
export function isPremiumMember(
  membershipTier?: MembershipTier,
  membershipStatus?: MembershipStatus
): boolean {
  return membershipTier === 'premium' && membershipStatus === 'active';
}

// Helper to determine if user is admin
export function isAdminUser(role?: UserRole | string): boolean {
  return role === 'admin';
}

// Helper to determine if blue tick should show
// ADJUST THIS based on your business logic
export function shouldShowVerifiedTick(
  membershipTier?: MembershipTier,
  membershipStatus?: MembershipStatus,
  isVerified?: boolean
): boolean {
  // Option 1: Show tick for active premium members
  return isPremiumMember(membershipTier, membershipStatus);
  
  // Option 2: Show tick based on separate isVerified field
  // return isVerified === true;
  
  // Option 3: Show tick for premium OR manually verified
  // return isPremiumMember(membershipTier, membershipStatus) || isVerified === true;
}


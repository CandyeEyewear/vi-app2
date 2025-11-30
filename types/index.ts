/**
 * VIbe App TypeScript Definitions
 */

export * from './reactions';

// ==================== USER TYPES ====================

export type UserRole = 'volunteer' | 'admin';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  location: string;
  country?: string;
  bio?: string;
  areasOfExpertise?: string[];
  education?: string;
  avatarUrl?: string;
  dateOfBirth?: string;
  role: UserRole;
  membershipTier?: 'free' | 'premium'; // Subscription tier
  membershipStatus?: 'inactive' | 'active' | 'expired' | 'cancelled'; // Subscription status
  isPrivate?: boolean; // Privacy setting for profile visibility
  // Organization fields
  account_type?: 'volunteer' | 'organization';
  approval_status?: 'pending' | 'approved' | 'rejected';
  is_partner_organization?: boolean;
  organization_data?: {
    organization_name: string;
    registration_number: string;
    organization_description: string;
    website_url?: string;
    contact_person_name: string;
    contact_person_role?: string;
    organization_size: string;
    industry_focus: string[];
  };
  // Moderation fields
  isBanned?: boolean;
  bannedUntil?: string;
  banReason?: string;
  
  // Stats
  totalHours: number;
  activitiesCompleted: number;
  organizationsHelped: number;
  
  // 🔥 Streak fields (monthly)
  currentStreak?: number;
  longestStreak?: number;
  lastActivityDate?: string;
  
  // Achievements
  achievements: Achievement[];
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  
  // Donation stats
  totalDonated?: number;
  donationCount?: number;
  donorBadges?: DonorBadge[];
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string;
}

// ==================== OPPORTUNITY TYPES ====================

export type OpportunityCategory = 
  | 'environment' 
  | 'education' 
  | 'healthcare' 
  | 'poorRelief'
  | 'community'
  | 'viEngage';

export type OpportunityStatus = 'active' | 'full' | 'completed' | 'cancelled';

export type VisibilityType = 'public' | 'members_only';

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  organizationName: string;
  organizationVerified: boolean;
  category: OpportunityCategory;
  
  // Location
  location: string;
  latitude?: number;
  longitude?: number;
  mapLink?: string;
  distance?: number; // Distance in miles (calculated from user location)
  
  // Timing
  date: string; // Legacy field, use date_start/date_end
  dateStart?: string;
  dateEnd?: string;
  timeStart?: string;
  timeEnd?: string;
  duration?: string; // Legacy field, use time_start/time_end
  
  // Capacity
  spotsAvailable: number;
  spotsTotal: number;
  
  // Details
  requirements?: string[];
  skillsNeeded?: string[];
  impactStatement?: string;
  imageUrl?: string;
  links?: OpportunityLink[];
  hours?: number; // Volunteer hours earned
  
  // Check-in system
   checkInCode?: string;
   qr_code?: string;
   qr_code_generated_at?: string;
  
// Contact person
contactPersonName?: string;
contactPersonPhone?: string;

  // Status
  status: OpportunityStatus;
  visibility?: VisibilityType;
  
  // Admin info
  createdBy: string; // Admin user ID
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityLink {
  label: string;
  url: string;
}

// ==================== CHECK-IN TYPES ====================

export type CheckInMethod = 'qr_code' | 'manual' | 'admin';

export type CheckInStatus = 
  | 'not_checked_in' 
  | 'pending_approval' 
  | 'approved' 
  | 'rejected';

export interface OpportunitySignupWithCheckIn extends OpportunitySignup {
  // User details (from join)
  user?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
    phone?: string;
  };
  
  // Opportunity details (from join)
  opportunity?: {
    id: string;
    title: string;
    date: string;
    hours: number;
  };
}

export interface CheckInHistoryItem {
  id: string;
  signup_id: string;
  opportunity_id: string;
  user_id: string;
  action: 'checked_in' | 'approved' | 'rejected';
  performed_by?: string;
  method?: string;
  notes?: string;
  created_at: string;
}

export interface CheckInStats {
  total_signups: number;
  checked_in_count: number;
  pending_approval_count: number;
  approved_count: number;
  not_checked_in_count: number;
}

export interface OpportunitySignup {
  id: string;
  opportunityId: string;
  userId: string;
  status: 'confirmed' | 'completed' | 'cancelled';
  hoursCompleted?: number;
  signedUpAt: string;
  completedAt?: string;
  
  // Check-in fields
  checked_in?: boolean;
  checked_in_at?: string;
  check_in_method?: CheckInMethod;
  check_in_status?: CheckInStatus;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
}

// ==================== FEED/POST TYPES ====================

export interface Post {
  id: string;
  userId: string;
  user: User; // Populated user data
  
  // Content
  text: string;
  mediaUrls?: string[]; // Array of image/video URLs
  mediaTypes?: ('image' | 'video')[]; // Corresponding media types
  
  // Engagement
  likes: string[]; // Array of user IDs who liked
  comments: Comment[];
  shares: number;
  reactions?: PostReaction[]; // Array of reactions
  
  // Optional linked opportunity
  opportunityId?: string;
  opportunity?: Opportunity;
  
  // Optional linked cause
  causeId?: string;
  cause?: Cause;
  
  // Optional linked event
  eventId?: string;
  event?: Event;
  
  // Announcement fields
  isAnnouncement?: boolean;
  isPinned?: boolean;
  
  // Moderation fields
  isHidden?: boolean;
  
  // Shared post fields
  sharedPostId?: string | null;     // ID of the original post if this is a share
  sharedPost?: Post | null;         // The full original post object (populated when loading)
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  user: User; // Populated user data
  text: string;
  createdAt: string;
}

// ==================== MODERATION TYPES ====================

export type ReportReason = 
  | 'spam'
  | 'inappropriate'
  | 'harassment'
  | 'misinformation'
  | 'offensive'
  | 'other';

export type ReportStatus = 'pending' | 'reviewed' | 'dismissed';

export interface PostReport {
  id: string;
  postId: string;
  post?: Post; // Populated post data
  reporterId: string;
  reporter?: User; // Populated reporter data
  reason: ReportReason;
  details?: string;
  status: ReportStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export type ModerationActionType = 
  | 'delete_post'
  | 'hide_post'
  | 'unhide_post'
  | 'ban_user'
  | 'unban_user'
  | 'dismiss_report';

export type ModerationTargetType = 'post' | 'user' | 'report';

export interface ModerationAction {
  id: string;
  adminId: string;
  admin?: User; // Populated admin data
  actionType: ModerationActionType;
  targetType: ModerationTargetType;
  targetId: string;
  reason?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface ModerationStats {
  totalReports: number;
  pendingReports: number;
  reviewedReports: number;
  postsHidden: number;
  postsDeleted: number;
  usersBanned: number;
  actionsToday: number;
}

// ==================== MESSAGING TYPES ====================

export interface Conversation {
  id: string;
  participants: string[]; // Array of user IDs
  participantDetails: User[]; // Populated user data
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  read: boolean;
  status?: 'sent' | 'delivered' | 'read';
  createdAt: string;
  deletedAt?: string;
  replyTo?: {
    id: string;
    senderId: string;
    senderName: string;
    text: string;
  };
  attachments?: {
    type: 'image' | 'video' | 'document';
    url: string;
    filename?: string;
    thumbnail?: string;
  }[];
}

// ==================== NOTIFICATION TYPES ====================

export interface Notification {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'message' | 'opportunity' | 'announcement';
  title: string;
  body: string;
  read: boolean;
  
  // Links
  postId?: string;
  opportunityId?: string;
  conversationId?: string;
  
  createdAt: string;
}

// ==================== STREAK TYPES ====================

// 🔥 Monthly Streak Milestones
export interface StreakBadge {
  months: number;
  emoji: string;
  label: string;
  color: string;
}

export const STREAK_MILESTONES: StreakBadge[] = [
  { months: 3, emoji: '🔥', label: '3 Month Streak', color: '#FF6B35' },
  { months: 6, emoji: '🔥🔥', label: '6 Month Streak', color: '#FF5722' },
  { months: 12, emoji: '⭐', label: '1 Year Streak!', color: '#FFD700' },
  { months: 18, emoji: '⭐⭐', label: '18 Month Streak', color: '#9C27B0' },
  { months: 24, emoji: '👑', label: '2 Year Streak!', color: '#E91E63' },
  { months: 36, emoji: '🏆', label: '3 Year Legend!', color: '#2196F3' },
];

// Helper function to get current badge
export function getCurrentStreakBadge(streakMonths: number): StreakBadge | null {
  // Return the highest milestone achieved
  const achieved = STREAK_MILESTONES.filter(m => streakMonths >= m.months);
  return achieved.length > 0 ? achieved[achieved.length - 1] : null;
}

// ==================== FORM TYPES ====================

export interface RegisterFormData {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  location: string;
  bio?: string;
  areasOfExpertise?: string[];
  education?: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface OpportunityFormData {
  title: string;
  description: string;
  organizationName: string;
  category: OpportunityCategory;
  location: string;
  latitude?: number;
  longitude?: number;
  date: string;
  duration: string;
  spotsTotal: number;
  requirements?: string[];
  skillsNeeded?: string[];
  impactStatement?: string;
  imageUrl?: string;
}

// ==================== API RESPONSE TYPES ====================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

export interface OpportunityChatMessage {
  id: string;
  opportunityId: string;
  userId: string;
  user: User; // Populated user data
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface TypingIndicator {
  userId: string;
  userName: string;
  isTyping: boolean;
}
export type CauseCategory = 
  | 'disaster_relief'
  | 'education'
  | 'healthcare'
  | 'environment'
  | 'community'
  | 'poverty'
  | 'other';

export type CauseStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface Cause {
  id: string;
  
  // Basic Info
  title: string;
  description: string;
  category: CauseCategory;
  imageUrl?: string;
  
  // Fundraising Goals
  goalAmount: number;
  amountRaised: number;
  currency: string;
  
  // Timing
  startDate: string;
  endDate?: string;
  
  // Settings
  isDonationsPublic: boolean;
  allowRecurring: boolean;
  minimumDonation: number;
  
  // Status
  status: CauseStatus;
  isFeatured: boolean;
  
  // Stats
  donorCount: number;
  
  // Admin
  createdBy: string;
  creator?: User;  // Populated
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Donation {
  id: string;
  
  // References
  causeId: string;
  cause?: Cause;  // Populated
  userId?: string;
  user?: User;    // Populated
  
  // Donation Details
  amount: number;
  currency: string;
  
  // Donor Info
  donorName?: string;
  donorEmail?: string;
  isAnonymous: boolean;
  
  // Payment Info (eZeePayments)
  paymentStatus: PaymentStatus;
  transactionNumber?: string;
  paymentMethod?: string;
  
  // Optional message
  message?: string;
  
  // Timestamps
  createdAt: string;
  completedAt?: string;
}

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
export type RecurringStatus = 'active' | 'paused' | 'cancelled' | 'ended' | 'failed';

export interface RecurringDonation {
  id: string;
  
  // References
  causeId: string;
  cause?: Cause;  // Populated
  userId: string;
  user?: User;    // Populated
  
  // Recurring Details
  amount: number;
  currency: string;
  frequency: RecurringFrequency;
  
  // eZeePayments Subscription
  subscriptionId?: string;
  
  // Status
  status: RecurringStatus;
  
  // Dates
  startDate: string;
  endDate?: string;
  nextBillingDate?: string;
  lastBillingDate?: string;
  
  // Stats
  totalDonated: number;
  donationCount: number;
  
  // Settings
  isAnonymous: boolean;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
}

export type DonorBadgeType = 
  | 'bronze_donor'        // $1,000+ total
  | 'silver_donor'        // $5,000+ total
  | 'gold_donor'          // $10,000+ total
  | 'platinum_donor'      // $25,000+ total
  | 'champion_donor'      // $50,000+ total
  | 'recurring_supporter' // Has active recurring donation
  | 'first_donation'      // Made first donation
  | 'cause_champion';     // Top donor to a specific cause

export interface DonorBadge {
  id: string;
  userId: string;
  badgeType: DonorBadgeType;
  causeId?: string;  // For cause_champion badge
  earnedAt: string;
}

// Donor Badge Display Info
export interface DonorBadgeInfo {
  type: DonorBadgeType;
  label: string;
  emoji: string;
  color: string;
  threshold?: number;  // Amount threshold for tier badges
}

export const DONOR_BADGE_INFO: Record<DonorBadgeType, DonorBadgeInfo> = {
  first_donation: {
    type: 'first_donation',
    label: 'First Donation',
    emoji: '🌱',
    color: '#4CAF50',
  },
  bronze_donor: {
    type: 'bronze_donor',
    label: 'Bronze Donor',
    emoji: '🥉',
    color: '#CD7F32',
    threshold: 1000,
  },
  silver_donor: {
    type: 'silver_donor',
    label: 'Silver Donor',
    emoji: '🥈',
    color: '#C0C0C0',
    threshold: 5000,
  },
  gold_donor: {
    type: 'gold_donor',
    label: 'Gold Donor',
    emoji: '🥇',
    color: '#FFD700',
    threshold: 10000,
  },
  platinum_donor: {
    type: 'platinum_donor',
    label: 'Platinum Donor',
    emoji: '💎',
    color: '#E5E4E2',
    threshold: 25000,
  },
  champion_donor: {
    type: 'champion_donor',
    label: 'Charitable Champion',
    emoji: '🏆',
    color: '#9C27B0',
    threshold: 50000,
  },
  recurring_supporter: {
    type: 'recurring_supporter',
    label: 'Recurring Supporter',
    emoji: '🔄',
    color: '#2196F3',
  },
  cause_champion: {
    type: 'cause_champion',
    label: 'Cause Champion',
    emoji: '⭐',
    color: '#FF9800',
  },
};

// Helper function to get highest donor badge
export function getHighestDonorBadge(totalDonated: number): DonorBadgeInfo | null {
  const tierBadges: DonorBadgeType[] = [
    'champion_donor',
    'platinum_donor', 
    'gold_donor',
    'silver_donor',
    'bronze_donor',
  ];
  
  for (const badgeType of tierBadges) {
    const info = DONOR_BADGE_INFO[badgeType];
    if (info.threshold && totalDonated >= info.threshold) {
      return info;
    }
  }
  return null;
}


// ==================== EVENT TYPES ====================

export type EventCategory = 
  | 'meetup'
  | 'gala'
  | 'fundraiser'
  | 'workshop'
  | 'celebration'
  | 'networking'
  | 'other';

export type EventStatus = 'draft' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export interface Event {
  id: string;
  
  // Basic Info
  title: string;
  description: string;
  category: EventCategory;
  imageUrl?: string;
  
  // Location
  location: string;
  locationAddress?: string;
  latitude?: number;
  longitude?: number;
  mapLink?: string;
  isVirtual: boolean;
  virtualLink?: string;
  
  // Timing
  eventDate: string;
  startTime: string;
  endTime?: string;
  timezone: string;
  
  // Capacity & Registration
  capacity?: number;
  spotsRemaining?: number;
  registrationRequired: boolean;
  registrationDeadline?: string;
  
  // Pricing
  isFree: boolean;
  ticketPrice?: number;
  currency: string;
  paymentLink?: string;
  
  // Linked cause
  causeId?: string;
  cause?: Cause;  // Populated
  
  // Contact
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  
  // Status
  status: EventStatus;
  isFeatured: boolean;
  
  // Admin
  createdBy: string;
  creator?: User;  // Populated
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export type EventRegistrationStatus = 'registered' | 'attended' | 'cancelled' | 'no_show';

export interface EventRegistration {
  id: string;
  
  // References
  eventId: string;
  event?: Event;  // Populated
  userId: string;
  user?: User;    // Populated
  
  // Registration Details
  status: EventRegistrationStatus;
  ticketCount: number;
  
  // Payment (if paid event)
  paymentStatus?: PaymentStatus;
  transactionNumber?: string;
  amountPaid?: number;
  
  // Timestamps
  registeredAt: string;
  cancelledAt?: string;
  attendedAt?: string;
}


// ==================== UPDATE USER INTERFACE ====================
// Add these fields to your existing User interface:

/*
  // Add to User interface:
  totalDonated?: number;
  donationCount?: number;
  donorBadges?: DonorBadge[];
*/


// ==================== FORM TYPES ====================

export interface CauseFormData {
  title: string;
  description: string;
  category: CauseCategory;
  goalAmount: number;
  endDate?: string;
  imageUrl?: string;
  isDonationsPublic: boolean;
  allowRecurring: boolean;
  minimumDonation?: number;
}

export interface DonationFormData {
  causeId: string;
  amount: number;
  donorName?: string;
  donorEmail?: string;
  isAnonymous: boolean;
  message?: string;
  isRecurring: boolean;
  frequency?: RecurringFrequency;
}

export interface EventFormData {
  title: string;
  description: string;
  category: EventCategory;
  location: string;
  locationAddress?: string;
  isVirtual: boolean;
  virtualLink?: string;
  eventDate: string;
  startTime: string;
  endTime?: string;
  capacity?: number;
  registrationRequired: boolean;
  registrationDeadline?: string;
  isFree: boolean;
  ticketPrice?: number;
  causeId?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  imageUrl?: string;
}

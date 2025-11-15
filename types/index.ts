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
  isPrivate?: boolean; // Privacy setting for profile visibility
  
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
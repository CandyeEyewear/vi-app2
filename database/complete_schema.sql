-- ============================================
-- VI APP - COMPLETE DATABASE SCHEMA
-- ============================================
-- This file contains the complete database schema for the VI App
-- (Volunteers in Jamaica) application running on Supabase/PostgreSQL
--
-- Generated: 2025-12-16
-- Database: PostgreSQL 17 (Supabase)
-- Total Tables: 34
--
-- Usage: Run this SQL in your Supabase SQL Editor to create all tables
-- All CREATE TABLE statements use IF NOT EXISTS to prevent errors
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================
-- SECTION 1: USER & AUTHENTICATION TABLES
-- ============================================

-- Table 1: users
-- Core user profiles and account information
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  location TEXT DEFAULT '',
  country TEXT DEFAULT 'Jamaica',
  bio TEXT,
  areas_of_expertise TEXT[],
  education TEXT,
  avatar_url TEXT,
  date_of_birth TEXT,
  role TEXT DEFAULT 'volunteer' CHECK (role IN ('volunteer', 'admin')),

  -- Organization fields
  account_type TEXT DEFAULT 'volunteer' CHECK (account_type IN ('volunteer', 'organization')),
  approval_status TEXT DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  is_partner_organization BOOLEAN DEFAULT false,
  organization_data JSONB,

  -- Membership
  membership_tier TEXT DEFAULT 'free' CHECK (membership_tier IN ('free', 'premium')),
  membership_status TEXT DEFAULT 'inactive' CHECK (membership_status IN ('inactive', 'active', 'expired', 'cancelled')),

  -- Privacy
  is_private BOOLEAN DEFAULT false,

  -- Moderation
  is_banned BOOLEAN DEFAULT false,
  banned_until TIMESTAMPTZ,
  ban_reason TEXT,

  -- Stats
  total_hours INTEGER DEFAULT 0 NOT NULL,
  activities_completed INTEGER DEFAULT 0 NOT NULL,
  organizations_helped INTEGER DEFAULT 0 NOT NULL,

  -- Streaks (monthly)
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date TIMESTAMPTZ,

  -- Donation stats
  total_donated NUMERIC(10, 2) DEFAULT 0,
  donation_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_slug ON public.users(slug);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_account_type ON public.users(account_type);

-- Table 2: user_notification_settings
-- User notification preferences
CREATE TABLE IF NOT EXISTS public.user_notification_settings (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  circle_requests_enabled BOOLEAN DEFAULT true NOT NULL,
  announcements_enabled BOOLEAN DEFAULT true NOT NULL,
  opportunities_enabled BOOLEAN DEFAULT true NOT NULL,
  messages_enabled BOOLEAN DEFAULT true NOT NULL,
  opportunity_proposals_enabled BOOLEAN DEFAULT true NOT NULL,
  causes_enabled BOOLEAN DEFAULT true NOT NULL,
  events_enabled BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Table 3: user_circles
-- User network/circles (friend connections)
CREATE TABLE IF NOT EXISTS public.user_circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  circle_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, circle_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_circles_user_id ON public.user_circles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_circles_status ON public.user_circles(status);

-- ============================================
-- SECTION 2: OPPORTUNITIES TABLES
-- ============================================

-- Table 4: opportunities
-- Volunteer opportunity listings
CREATE TABLE IF NOT EXISTS public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  organization_verified BOOLEAN DEFAULT false NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('environment', 'education', 'healthcare', 'poorRelief', 'community', 'viEngage')),

  -- Location
  location TEXT NOT NULL,
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  map_link TEXT,

  -- Timing
  date_start TIMESTAMPTZ,
  date_end TIMESTAMPTZ,
  time_start TIME,
  time_end TIME,
  date TEXT, -- Legacy field
  duration TEXT, -- Legacy field

  -- Capacity
  spots_available INTEGER NOT NULL,
  spots_total INTEGER NOT NULL,

  -- Details
  requirements TEXT[],
  skills_needed TEXT[],
  impact_statement TEXT,
  image_url TEXT,
  hours INTEGER, -- Volunteer hours earned

  -- Check-in system
  check_in_code TEXT,
  qr_code TEXT,
  qr_code_generated_at TIMESTAMPTZ,

  -- Contact
  contact_person_name TEXT,
  contact_person_phone TEXT,

  -- Status
  status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'full', 'completed', 'cancelled')),
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'members_only')),

  -- Admin
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_opportunities_slug ON public.opportunities(slug);
CREATE INDEX IF NOT EXISTS idx_opportunities_category ON public.opportunities(category);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON public.opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_created_by ON public.opportunities(created_by);
CREATE INDEX IF NOT EXISTS idx_opportunities_location ON public.opportunities USING GIST(ll_to_earth(latitude::float8, longitude::float8)) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Table 5: opportunity_signups
-- User sign-ups for opportunities
CREATE TABLE IF NOT EXISTS public.opportunity_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'confirmed' NOT NULL CHECK (status IN ('confirmed', 'completed', 'cancelled')),
  hours_completed INTEGER,
  signed_up_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,

  -- Check-in fields
  checked_in BOOLEAN DEFAULT false,
  checked_in_at TIMESTAMPTZ,
  check_in_method TEXT CHECK (check_in_method IN ('qr_code', 'manual', 'admin')),
  check_in_status TEXT DEFAULT 'not_checked_in' CHECK (check_in_status IN ('not_checked_in', 'pending_approval', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  UNIQUE(opportunity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_opportunity_signups_opportunity_id ON public.opportunity_signups(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_signups_user_id ON public.opportunity_signups(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_signups_status ON public.opportunity_signups(status);

-- Table 6: saved_opportunities
-- Bookmarked opportunities
CREATE TABLE IF NOT EXISTS public.saved_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_opportunities_user_id ON public.saved_opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_opportunity_id ON public.saved_opportunities(opportunity_id);

-- Enable RLS for saved_opportunities
ALTER TABLE public.saved_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own saved opportunities"
  ON public.saved_opportunities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own saved opportunities"
  ON public.saved_opportunities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own saved opportunities"
  ON public.saved_opportunities FOR DELETE
  USING (auth.uid() = user_id);

-- Table 7: opportunity_chat_messages
-- In-opportunity messaging
CREATE TABLE IF NOT EXISTS public.opportunity_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_opportunity_chat_messages_opportunity_id ON public.opportunity_chat_messages(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_chat_messages_created_at ON public.opportunity_chat_messages(created_at DESC);

-- ============================================
-- SECTION 3: CAUSES & DONATIONS TABLES
-- ============================================

-- Table 8: causes
-- Fundraising cause listings
CREATE TABLE IF NOT EXISTS public.causes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,

  -- Basic Info
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('disaster_relief', 'education', 'healthcare', 'environment', 'community', 'poverty', 'other')),
  image_url TEXT,

  -- Fundraising Goals
  goal_amount NUMERIC(12, 2) NOT NULL,
  amount_raised NUMERIC(12, 2) DEFAULT 0 NOT NULL,
  currency TEXT DEFAULT 'JMD' NOT NULL,

  -- Timing
  start_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  end_date TIMESTAMPTZ,

  -- Settings
  is_donations_public BOOLEAN DEFAULT true NOT NULL,
  allow_recurring BOOLEAN DEFAULT true NOT NULL,
  minimum_donation NUMERIC(10, 2) DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
  is_featured BOOLEAN DEFAULT false NOT NULL,
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'members_only')),

  -- Stats
  donor_count INTEGER DEFAULT 0 NOT NULL,

  -- Admin
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_causes_slug ON public.causes(slug);
CREATE INDEX IF NOT EXISTS idx_causes_category ON public.causes(category);
CREATE INDEX IF NOT EXISTS idx_causes_status ON public.causes(status);
CREATE INDEX IF NOT EXISTS idx_causes_created_by ON public.causes(created_by);
CREATE INDEX IF NOT EXISTS idx_causes_is_featured ON public.causes(is_featured) WHERE is_featured = true;

-- Table 9: donations
-- Individual donations
CREATE TABLE IF NOT EXISTS public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  cause_id UUID NOT NULL REFERENCES public.causes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Donation Details
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'JMD' NOT NULL,

  -- Donor Info
  donor_name TEXT,
  donor_email TEXT,
  is_anonymous BOOLEAN DEFAULT false NOT NULL,

  -- Payment Info (eZeePayments)
  payment_status TEXT DEFAULT 'pending' NOT NULL CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  transaction_number TEXT,
  payment_method TEXT,

  -- Optional message
  message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_donations_cause_id ON public.donations(cause_id);
CREATE INDEX IF NOT EXISTS idx_donations_user_id ON public.donations(user_id);
CREATE INDEX IF NOT EXISTS idx_donations_payment_status ON public.donations(payment_status);
CREATE INDEX IF NOT EXISTS idx_donations_transaction_number ON public.donations(transaction_number);

-- Table 10: recurring_donations
-- Subscription/recurring donations
CREATE TABLE IF NOT EXISTS public.recurring_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  cause_id UUID NOT NULL REFERENCES public.causes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Recurring Details
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'JMD' NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'annually')),

  -- eZeePayments Subscription
  subscription_id TEXT,

  -- Status
  status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'paused', 'cancelled', 'ended', 'failed')),

  -- Dates
  start_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  end_date TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,
  last_billing_date TIMESTAMPTZ,

  -- Stats
  total_donated NUMERIC(12, 2) DEFAULT 0 NOT NULL,
  donation_count INTEGER DEFAULT 0 NOT NULL,

  -- Settings
  is_anonymous BOOLEAN DEFAULT false NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recurring_donations_cause_id ON public.recurring_donations(cause_id);
CREATE INDEX IF NOT EXISTS idx_recurring_donations_user_id ON public.recurring_donations(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_donations_status ON public.recurring_donations(status);
CREATE INDEX IF NOT EXISTS idx_recurring_donations_subscription_id ON public.recurring_donations(subscription_id);

-- Table 11: saved_causes
-- Bookmarked causes
CREATE TABLE IF NOT EXISTS public.saved_causes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cause_id UUID NOT NULL REFERENCES public.causes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, cause_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_causes_user_id ON public.saved_causes(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_causes_cause_id ON public.saved_causes(cause_id);

-- Enable RLS for saved_causes
ALTER TABLE public.saved_causes ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own saved causes"
  ON public.saved_causes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can save causes"
  ON public.saved_causes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can unsave causes"
  ON public.saved_causes FOR DELETE
  USING (auth.uid() = user_id);

-- Table 12: donor_badges
-- Donor achievement badges
CREATE TABLE IF NOT EXISTS public.donor_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL CHECK (badge_type IN ('bronze_donor', 'silver_donor', 'gold_donor', 'platinum_donor', 'champion_donor', 'recurring_supporter', 'first_donation', 'cause_champion')),
  cause_id UUID REFERENCES public.causes(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_donor_badges_user_id ON public.donor_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_donor_badges_badge_type ON public.donor_badges(badge_type);

-- ============================================
-- SECTION 4: EVENTS TABLES
-- ============================================

-- Table 13: events
-- Event listings
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,

  -- Basic Info
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('meetup', 'gala', 'fundraiser', 'workshop', 'celebration', 'networking', 'other')),
  image_url TEXT,

  -- Location
  location TEXT NOT NULL,
  location_address TEXT,
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  map_link TEXT,
  is_virtual BOOLEAN DEFAULT false NOT NULL,
  virtual_link TEXT,

  -- Timing
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  timezone TEXT DEFAULT 'America/Jamaica' NOT NULL,

  -- Capacity & Registration
  capacity INTEGER,
  spots_remaining INTEGER,
  registration_required BOOLEAN DEFAULT true NOT NULL,
  registration_deadline TIMESTAMPTZ,

  -- Pricing
  is_free BOOLEAN DEFAULT true NOT NULL,
  ticket_price NUMERIC(10, 2),
  currency TEXT DEFAULT 'JMD' NOT NULL,
  payment_link TEXT,

  -- Linked cause
  cause_id UUID REFERENCES public.causes(id) ON DELETE SET NULL,

  -- Contact
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,

  -- Status
  status TEXT DEFAULT 'upcoming' NOT NULL CHECK (status IN ('draft', 'upcoming', 'ongoing', 'completed', 'cancelled')),
  is_featured BOOLEAN DEFAULT false NOT NULL,
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'members_only')),

  -- Admin
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_slug ON public.events(slug);
CREATE INDEX IF NOT EXISTS idx_events_category ON public.events(category);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON public.events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_is_featured ON public.events(is_featured) WHERE is_featured = true;

-- Table 14: event_registrations
-- User event sign-ups
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Registration Details
  status TEXT DEFAULT 'registered' NOT NULL CHECK (status IN ('registered', 'attended', 'cancelled', 'no_show')),
  ticket_count INTEGER DEFAULT 1 NOT NULL,

  -- Payment (if paid event)
  payment_status TEXT CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  transaction_number TEXT,
  amount_paid NUMERIC(10, 2),

  -- Timestamps
  registered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  cancelled_at TIMESTAMPTZ,
  attended_at TIMESTAMPTZ,

  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_registrations_event_id ON public.event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_user_id ON public.event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_status ON public.event_registrations(status);

-- Table 15: event_tickets
-- Event ticket management
CREATE TABLE IF NOT EXISTS public.event_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  ticket_number INTEGER NOT NULL,
  qr_code TEXT,
  checked_in BOOLEAN DEFAULT false NOT NULL,
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_tickets_registration_id ON public.event_tickets(registration_id);
CREATE INDEX IF NOT EXISTS idx_event_tickets_qr_code ON public.event_tickets(qr_code);

-- Table 16: saved_events
-- Bookmarked events
CREATE TABLE IF NOT EXISTS public.saved_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_events_user_id ON public.saved_events(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_events_event_id ON public.saved_events(event_id);

-- Enable RLS for saved_events
ALTER TABLE public.saved_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own saved events"
  ON public.saved_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can save events"
  ON public.saved_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can unsave events"
  ON public.saved_events FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- SECTION 5: POSTS & SOCIAL TABLES
-- ============================================

-- Table 17: shoutout_categories
-- Shoutout recognition categories
CREATE TABLE IF NOT EXISTS public.shoutout_categories (
  id TEXT PRIMARY KEY CHECK (id IN ('team_player', 'above_and_beyond', 'heart_of_gold', 'problem_solver', 'first_timer_star', 'inspiring_leader')),
  label TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  gradient_start TEXT NOT NULL,
  gradient_end TEXT NOT NULL
);

-- Insert default shoutout categories
INSERT INTO public.shoutout_categories (id, label, icon, color, gradient_start, gradient_end)
VALUES
  ('team_player', 'Team Player', '🤝', '#3B82F6', '#3B82F6', '#1D4ED8'),
  ('above_and_beyond', 'Above & Beyond', '⭐', '#F59E0B', '#F59E0B', '#D97706'),
  ('heart_of_gold', 'Heart of Gold', '💛', '#EAB308', '#EAB308', '#CA8A04'),
  ('problem_solver', 'Problem Solver', '🧩', '#8B5CF6', '#8B5CF6', '#6D28D9'),
  ('first_timer_star', 'First-Timer Star', '🌟', '#10B981', '#10B981', '#059669'),
  ('inspiring_leader', 'Inspiring Leader', '👑', '#EC4899', '#EC4899', '#BE185D')
ON CONFLICT (id) DO NOTHING;

-- Table 18: posts
-- Feed posts
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Content
  text TEXT NOT NULL,
  media_urls TEXT[],
  media_types TEXT[], -- 'image' or 'video'

  -- Engagement
  likes UUID[] DEFAULT '{}' NOT NULL, -- Array of user IDs who liked
  shares INTEGER DEFAULT 0 NOT NULL,

  -- Optional linked opportunity
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,

  -- Optional linked cause
  cause_id UUID REFERENCES public.causes(id) ON DELETE SET NULL,

  -- Optional linked event
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,

  -- Post type
  post_type TEXT DEFAULT 'regular' CHECK (post_type IN ('regular', 'shoutout')),

  -- Shoutout fields
  shoutout_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  shoutout_category TEXT REFERENCES public.shoutout_categories(id),

  -- Announcement fields
  is_announcement BOOLEAN DEFAULT false NOT NULL,
  is_pinned BOOLEAN DEFAULT false NOT NULL,

  -- Moderation fields
  is_hidden BOOLEAN DEFAULT false NOT NULL,

  -- Shared post fields
  shared_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_opportunity_id ON public.posts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_posts_cause_id ON public.posts(cause_id);
CREATE INDEX IF NOT EXISTS idx_posts_event_id ON public.posts(event_id);
CREATE INDEX IF NOT EXISTS idx_posts_is_announcement ON public.posts(is_announcement) WHERE is_announcement = true;

-- Table 19: comments
-- Post comments
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at DESC);

-- Table 20: post_reactions
-- Emoji reactions on posts
CREATE TABLE IF NOT EXISTS public.post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('heart', 'thumbsup', 'clap', 'fire', 'star', 'cosign')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(post_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id ON public.post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_user_id ON public.post_reactions(user_id);

-- Table 21: post_reports
-- Reported posts
CREATE TABLE IF NOT EXISTS public.post_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'harassment', 'misinformation', 'offensive', 'other')),
  details TEXT,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_post_reports_post_id ON public.post_reports(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reports_status ON public.post_reports(status);
CREATE INDEX IF NOT EXISTS idx_post_reports_created_at ON public.post_reports(created_at DESC);

-- Table 22: post_mentions
-- User mentions in posts
CREATE TABLE IF NOT EXISTS public.post_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mentioned_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CHECK ((post_id IS NOT NULL AND comment_id IS NULL) OR (post_id IS NULL AND comment_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_post_mentions_mentioned_user_id ON public.post_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_post_mentions_post_id ON public.post_mentions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_mentions_comment_id ON public.post_mentions(comment_id);

-- Table 23: post_hashtags
-- Hashtags in posts/comments
CREATE TABLE IF NOT EXISTS public.post_hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  cause_id UUID REFERENCES public.causes(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  tagged_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_post_hashtags_post_id ON public.post_hashtags(post_id);
CREATE INDEX IF NOT EXISTS idx_post_hashtags_event_id ON public.post_hashtags(event_id);
CREATE INDEX IF NOT EXISTS idx_post_hashtags_cause_id ON public.post_hashtags(cause_id);

-- Table 24: post_images
-- Post media storage tracking (legacy/optional)
CREATE TABLE IF NOT EXISTS public.post_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_post_images_post_id ON public.post_images(post_id);

-- ============================================
-- SECTION 6: MESSAGING TABLES
-- ============================================

-- Table 25: conversations
-- Message conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participants UUID[] NOT NULL, -- Array of user IDs
  last_message TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_participants ON public.conversations USING GIN(participants);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);

-- Table 26: messages
-- Direct messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  read BOOLEAN DEFAULT false NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
  reply_to JSONB, -- {id, senderId, senderName, text}
  attachments JSONB[], -- [{type, url, filename, thumbnail}]
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- ============================================
-- SECTION 7: NOTIFICATIONS & REMINDERS
-- ============================================

-- Table 27: notifications
-- In-app notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'message', 'opportunity', 'announcement', 'cause', 'event', 'circle_request')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  related_id UUID,
  is_read BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Table 28: reminder_settings
-- User reminder preferences
CREATE TABLE IF NOT EXISTS public.reminder_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  reminders_enabled BOOLEAN DEFAULT true NOT NULL,
  remind_day_before BOOLEAN DEFAULT true NOT NULL,
  remind_day_of BOOLEAN DEFAULT true NOT NULL,
  remind_hours_before INTEGER CHECK (remind_hours_before IS NULL OR remind_hours_before > 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reminder_settings_user_id ON public.reminder_settings(user_id);

-- Enable RLS for reminder_settings
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can read their own reminder settings"
  ON public.reminder_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own reminder settings"
  ON public.reminder_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own reminder settings"
  ON public.reminder_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Table 29: scheduled_reminders
-- Scheduled reminder queue
CREATE TABLE IF NOT EXISTS public.scheduled_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('day_before', 'day_of', 'hours_before')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CHECK (
    (event_id IS NOT NULL AND opportunity_id IS NULL) OR
    (event_id IS NULL AND opportunity_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_status_scheduled ON public.scheduled_reminders(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_user_id ON public.scheduled_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_event_id ON public.scheduled_reminders(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_opportunity_id ON public.scheduled_reminders(opportunity_id) WHERE opportunity_id IS NOT NULL;

-- Enable RLS for scheduled_reminders
ALTER TABLE public.scheduled_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Service role can manage all reminders"
  ON public.scheduled_reminders FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY IF NOT EXISTS "Users can read their own reminders"
  ON public.scheduled_reminders FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- SECTION 8: MODERATION TABLES
-- ============================================

-- Table 30: moderation_actions
-- Admin moderation log
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('delete_post', 'hide_post', 'unhide_post', 'ban_user', 'unban_user', 'dismiss_report', 'assign_admin', 'remove_admin')),
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'user', 'report')),
  target_id UUID NOT NULL,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_moderation_actions_admin_id ON public.moderation_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_target_type_id ON public.moderation_actions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_created_at ON public.moderation_actions(created_at DESC);

-- ============================================
-- SECTION 9: PAYMENT TABLES
-- ============================================

-- Table 31: payment_transactions
-- Payment history
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  order_id TEXT,
  order_type TEXT CHECK (order_type IN ('donation', 'event_registration', 'membership', 'other')),
  reference_id UUID, -- References related record (donation_id, event_registration_id, etc.)
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'JMD' NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded')),
  transaction_number TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON public.payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_transaction_number ON public.payment_transactions(transaction_number);

-- Table 32: payment_subscriptions
-- Subscription management
CREATE TABLE IF NOT EXISTS public.payment_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subscription_type TEXT NOT NULL CHECK (subscription_type IN ('recurring_donation', 'membership', 'organization_membership', 'other')),
  reference_id UUID, -- References related record
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'JMD' NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'annually')),
  ezee_subscription_id TEXT,
  status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'paused', 'cancelled', 'ended', 'failed')),
  transaction_number TEXT,
  last_billing_date DATE,
  next_billing_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_subscriptions_user_id ON public.payment_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_subscriptions_status ON public.payment_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payment_subscriptions_ezee_subscription_id ON public.payment_subscriptions(ezee_subscription_id);

-- Table 33: payment_webhooks
-- Payment provider webhooks
CREATE TABLE IF NOT EXISTS public.payment_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('subscription_payment', 'one_time_payment')),
  transaction_number TEXT,
  payload JSONB NOT NULL,
  headers JSONB,
  processed BOOLEAN DEFAULT false NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_webhooks_processed ON public.payment_webhooks(processed);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_transaction_number ON public.payment_webhooks(transaction_number);

-- Table 34: receipts
-- Payment receipts
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.payment_subscriptions(id) ON DELETE SET NULL,
  transaction_number TEXT NOT NULL,
  receipt_number TEXT UNIQUE NOT NULL,
  receipt_type TEXT NOT NULL CHECK (receipt_type IN ('donation', 'subscription', 'event', 'membership')),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  billing_address JSONB,
  subtotal NUMERIC(10, 2) NOT NULL,
  processing_fee NUMERIC(10, 2) DEFAULT 0,
  total_amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'JMD' NOT NULL,
  line_items JSONB[],
  payment_method TEXT,
  status TEXT DEFAULT 'generated' CHECK (status IN ('generated', 'sent', 'failed')),
  email_sent_at TIMESTAMPTZ,
  issued_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_receipts_transaction_number ON public.receipts(transaction_number);
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_number ON public.receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_customer_email ON public.receipts(customer_email);

-- ============================================
-- SECTION 10: DATABASE FUNCTIONS & TRIGGERS
-- ============================================

-- Function: handle_new_user
-- Auto-creates user profile and settings when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_metadata JSONB;
  full_name_val TEXT;
  phone_val TEXT;
  location_val TEXT;
  country_val TEXT;
  bio_val TEXT;
  areas_of_expertise_val TEXT[];
  education_val TEXT;
  date_of_birth_val TEXT;
BEGIN
  user_metadata := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);

  full_name_val := COALESCE(user_metadata->>'full_name', user_metadata->>'fullName', '');
  phone_val := COALESCE(user_metadata->>'phone', '');
  location_val := COALESCE(user_metadata->>'location', '');
  country_val := COALESCE(user_metadata->>'country', 'Jamaica');
  bio_val := user_metadata->>'bio';
  education_val := user_metadata->>'education';
  date_of_birth_val := user_metadata->>'date_of_birth';

  IF user_metadata->'areas_of_expertise' IS NOT NULL THEN
    areas_of_expertise_val := ARRAY(SELECT jsonb_array_elements_text(user_metadata->'areas_of_expertise'));
  ELSE
    areas_of_expertise_val := NULL;
  END IF;

  INSERT INTO public.users (
    id, email, full_name, phone, location, country, bio,
    areas_of_expertise, education, date_of_birth, role,
    total_hours, activities_completed, organizations_helped,
    created_at, updated_at
  )
  VALUES (
    NEW.id, COALESCE(NEW.email, ''), full_name_val, phone_val,
    location_val, country_val, bio_val, areas_of_expertise_val,
    education_val, date_of_birth_val, 'volunteer',
    0, 0, 0, NOW(), NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_notification_settings (
    user_id, circle_requests_enabled, announcements_enabled,
    opportunities_enabled, messages_enabled, opportunity_proposals_enabled,
    causes_enabled, events_enabled, created_at, updated_at
  )
  VALUES (NEW.id, true, true, true, true, true, true, true, NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.reminder_settings (
    user_id, reminders_enabled, remind_day_before, remind_day_of,
    remind_hours_before, created_at, updated_at
  )
  VALUES (NEW.id, true, true, true, NULL, NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger: on_auth_user_created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function: schedule_reminders_for_event_registration
-- Auto-schedules reminders when user registers for an event
CREATE OR REPLACE FUNCTION public.schedule_reminders_for_event_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_settings RECORD;
  event_data RECORD;
  event_start_datetime TIMESTAMPTZ;
  reminder_time TIMESTAMPTZ;
  hours_before_val INTEGER;
BEGIN
  SELECT * INTO user_settings FROM public.reminder_settings WHERE user_id = NEW.user_id;

  IF user_settings IS NULL OR user_settings.reminders_enabled = false THEN
    RETURN NEW;
  END IF;

  SELECT event_date, start_time, timezone INTO event_data FROM public.events WHERE id = NEW.event_id;

  IF event_data IS NULL OR event_data.event_date IS NULL THEN
    RETURN NEW;
  END IF;

  event_start_datetime := (event_data.event_date::text || ' ' || COALESCE(event_data.start_time, '09:00:00'))::timestamptz;

  IF event_start_datetime <= NOW() THEN
    RETURN NEW;
  END IF;

  IF user_settings.remind_day_before = true THEN
    reminder_time := (event_start_datetime - INTERVAL '1 day')::date::timestamp + TIME '09:00:00';
    IF reminder_time > NOW() THEN
      INSERT INTO public.scheduled_reminders (user_id, event_id, reminder_type, scheduled_for, status)
      VALUES (NEW.user_id, NEW.event_id, 'day_before', reminder_time, 'pending');
    END IF;
  END IF;

  IF user_settings.remind_day_of = true THEN
    reminder_time := event_start_datetime::date::timestamp + TIME '08:00:00';
    IF reminder_time > NOW() AND reminder_time < event_start_datetime THEN
      INSERT INTO public.scheduled_reminders (user_id, event_id, reminder_type, scheduled_for, status)
      VALUES (NEW.user_id, NEW.event_id, 'day_of', reminder_time, 'pending');
    END IF;
  END IF;

  IF user_settings.remind_hours_before IS NOT NULL THEN
    hours_before_val := user_settings.remind_hours_before;
    reminder_time := event_start_datetime - (hours_before_val || ' hours')::interval;
    IF reminder_time > NOW() THEN
      INSERT INTO public.scheduled_reminders (user_id, event_id, reminder_type, scheduled_for, status)
      VALUES (NEW.user_id, NEW.event_id, 'hours_before', reminder_time, 'pending');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Function: schedule_reminders_for_opportunity_signup
-- Auto-schedules reminders when user signs up for an opportunity
CREATE OR REPLACE FUNCTION public.schedule_reminders_for_opportunity_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_settings RECORD;
  opportunity_data RECORD;
  opportunity_start_datetime TIMESTAMPTZ;
  reminder_time TIMESTAMPTZ;
  hours_before_val INTEGER;
BEGIN
  SELECT * INTO user_settings FROM public.reminder_settings WHERE user_id = NEW.user_id;

  IF user_settings IS NULL OR user_settings.reminders_enabled = false THEN
    RETURN NEW;
  END IF;

  SELECT date_start, time_start INTO opportunity_data FROM public.opportunities WHERE id = NEW.opportunity_id;

  IF opportunity_data IS NULL OR opportunity_data.date_start IS NULL THEN
    RETURN NEW;
  END IF;

  IF opportunity_data.time_start IS NOT NULL THEN
    opportunity_start_datetime := (opportunity_data.date_start::date::text || ' ' || opportunity_data.time_start)::timestamptz;
  ELSE
    opportunity_start_datetime := opportunity_data.date_start;
  END IF;

  IF opportunity_start_datetime <= NOW() THEN
    RETURN NEW;
  END IF;

  IF user_settings.remind_day_before = true THEN
    reminder_time := (opportunity_start_datetime - INTERVAL '1 day')::date::timestamp + TIME '09:00:00';
    IF reminder_time > NOW() THEN
      INSERT INTO public.scheduled_reminders (user_id, opportunity_id, reminder_type, scheduled_for, status)
      VALUES (NEW.user_id, NEW.opportunity_id, 'day_before', reminder_time, 'pending');
    END IF;
  END IF;

  IF user_settings.remind_day_of = true THEN
    reminder_time := opportunity_start_datetime::date::timestamp + TIME '08:00:00';
    IF reminder_time > NOW() AND reminder_time < opportunity_start_datetime THEN
      INSERT INTO public.scheduled_reminders (user_id, opportunity_id, reminder_type, scheduled_for, status)
      VALUES (NEW.user_id, NEW.opportunity_id, 'day_of', reminder_time, 'pending');
    END IF;
  END IF;

  IF user_settings.remind_hours_before IS NOT NULL THEN
    hours_before_val := user_settings.remind_hours_before;
    reminder_time := opportunity_start_datetime - (hours_before_val || ' hours')::interval;
    IF reminder_time > NOW() THEN
      INSERT INTO public.scheduled_reminders (user_id, opportunity_id, reminder_type, scheduled_for, status)
      VALUES (NEW.user_id, NEW.opportunity_id, 'hours_before', reminder_time, 'pending');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Function: cancel_reminders_on_unregister
-- Cancels pending reminders when user unregisters
CREATE OR REPLACE FUNCTION public.cancel_reminders_on_unregister()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_TABLE_NAME = 'event_registrations' THEN
    UPDATE public.scheduled_reminders SET status = 'cancelled'
    WHERE event_id = OLD.event_id AND user_id = OLD.user_id AND status = 'pending';
  ELSIF TG_TABLE_NAME = 'opportunity_signups' THEN
    UPDATE public.scheduled_reminders SET status = 'cancelled'
    WHERE opportunity_id = OLD.opportunity_id AND user_id = OLD.user_id AND status = 'pending';
  END IF;
  RETURN OLD;
END;
$$;

-- Create triggers for reminder scheduling
DROP TRIGGER IF EXISTS trigger_schedule_reminders_on_event_registration ON public.event_registrations;
CREATE TRIGGER trigger_schedule_reminders_on_event_registration
  AFTER INSERT ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.schedule_reminders_for_event_registration();

DROP TRIGGER IF EXISTS trigger_schedule_reminders_on_opportunity_signup ON public.opportunity_signups;
CREATE TRIGGER trigger_schedule_reminders_on_opportunity_signup
  AFTER INSERT ON public.opportunity_signups
  FOR EACH ROW
  EXECUTE FUNCTION public.schedule_reminders_for_opportunity_signup();

DROP TRIGGER IF EXISTS trigger_cancel_reminders_on_event_unregister ON public.event_registrations;
CREATE TRIGGER trigger_cancel_reminders_on_event_unregister
  AFTER DELETE ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.cancel_reminders_on_unregister();

DROP TRIGGER IF EXISTS trigger_cancel_reminders_on_opportunity_unregister ON public.opportunity_signups;
CREATE TRIGGER trigger_cancel_reminders_on_opportunity_unregister
  AFTER DELETE ON public.opportunity_signups
  FOR EACH ROW
  EXECUTE FUNCTION public.cancel_reminders_on_unregister();

-- ============================================
-- SECTION 11: NOTIFICATION RPC FUNCTIONS
-- ============================================

-- Function to create announcement notifications for all users
CREATE OR REPLACE FUNCTION public.create_announcement_notifications(
  p_post_id UUID,
  p_title TEXT,
  p_content TEXT,
  p_sender_id UUID
)
RETURNS TABLE(user_id UUID) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.notifications (user_id, type, title, message, link, related_id, is_read, created_at)
  SELECT
    u.id,
    'announcement',
    p_title,
    p_content,
    '/post/' || p_post_id,
    p_post_id,
    false,
    NOW()
  FROM public.users u
  LEFT JOIN public.user_notification_settings uns ON uns.user_id = u.id
  WHERE
    u.id != p_sender_id
    AND (uns.announcements_enabled IS NULL OR uns.announcements_enabled = true)
  RETURNING user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create cause notifications for all users
CREATE OR REPLACE FUNCTION public.create_cause_notifications(
  p_cause_id UUID,
  p_title TEXT,
  p_creator_id UUID
)
RETURNS TABLE(user_id UUID) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.notifications (user_id, type, title, message, link, related_id, is_read, created_at)
  SELECT
    u.id,
    'cause',
    'New Fundraising Cause',
    p_title || ' - Help make a difference!',
    '/causes/' || p_cause_id,
    p_cause_id,
    false,
    NOW()
  FROM public.users u
  LEFT JOIN public.user_notification_settings uns ON uns.user_id = u.id
  WHERE
    u.id != p_creator_id
    AND (uns.causes_enabled IS NULL OR uns.causes_enabled = true)
  RETURNING user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create event notifications for all users
CREATE OR REPLACE FUNCTION public.create_event_notifications(
  p_event_id UUID,
  p_title TEXT,
  p_creator_id UUID
)
RETURNS TABLE(user_id UUID) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.notifications (user_id, type, title, message, link, related_id, is_read, created_at)
  SELECT
    u.id,
    'event',
    'New Event',
    p_title || ' - Join us!',
    '/events/' || p_event_id,
    p_event_id,
    false,
    NOW()
  FROM public.users u
  LEFT JOIN public.user_notification_settings uns ON uns.user_id = u.id
  WHERE
    u.id != p_creator_id
    AND (uns.events_enabled IS NULL OR uns.events_enabled = true)
  RETURNING user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SCHEMA CREATION COMPLETE
-- ============================================
-- All 34 tables have been created with:
-- - Primary and foreign key constraints
-- - Indexes for performance
-- - Row Level Security (RLS) policies where needed
-- - Database triggers and functions
-- - Default values and check constraints
-- ============================================

COMMENT ON SCHEMA public IS 'VI App complete database schema with 34 tables for volunteer management, fundraising, events, and social features';

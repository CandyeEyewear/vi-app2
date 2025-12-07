-- ============================================
-- REMINDER SYSTEM MIGRATION
-- ============================================
-- Creates tables, functions, and triggers for
-- automatic event/opportunity reminder notifications
-- ============================================

-- ============================================
-- TABLE 1: reminder_settings
-- ============================================
CREATE TABLE IF NOT EXISTS public.reminder_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  reminders_enabled BOOLEAN DEFAULT true NOT NULL,
  remind_day_before BOOLEAN DEFAULT true NOT NULL,
  remind_day_of BOOLEAN DEFAULT true NOT NULL,
  remind_hours_before INTEGER NULL CHECK (remind_hours_before IS NULL OR remind_hours_before > 0),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_reminder_settings_user_id ON public.reminder_settings(user_id);

-- Enable RLS
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reminder_settings
CREATE POLICY "Users can read their own reminder settings"
  ON public.reminder_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own reminder settings"
  ON public.reminder_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reminder settings"
  ON public.reminder_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- TABLE 2: scheduled_reminders
-- ============================================
CREATE TABLE IF NOT EXISTS public.scheduled_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id UUID NULL REFERENCES public.events(id) ON DELETE CASCADE,
  opportunity_id UUID NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('day_before', 'day_of', 'hours_before')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NULL,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error_message TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  -- Ensure either event_id or opportunity_id is set, but not both
  CONSTRAINT check_event_or_opportunity CHECK (
    (event_id IS NOT NULL AND opportunity_id IS NULL) OR
    (event_id IS NULL AND opportunity_id IS NOT NULL)
  )
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_status_scheduled ON public.scheduled_reminders(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_user_id ON public.scheduled_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_event_id ON public.scheduled_reminders(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_opportunity_id ON public.scheduled_reminders(opportunity_id) WHERE opportunity_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.scheduled_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scheduled_reminders
-- Service role can do everything (for Edge Function)
CREATE POLICY "Service role can manage all reminders"
  ON public.scheduled_reminders
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Users can read their own reminders
CREATE POLICY "Users can read their own reminders"
  ON public.scheduled_reminders
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- FUNCTION: create_reminder_settings_for_new_user
-- ============================================
CREATE OR REPLACE FUNCTION public.create_reminder_settings_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.reminder_settings (
    user_id,
    reminders_enabled,
    remind_day_before,
    remind_day_of,
    remind_hours_before,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    true,  -- Default: enabled
    true,  -- Default: day before enabled
    true,  -- Default: day of enabled
    NULL,  -- Default: hours before disabled
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- FUNCTION: schedule_reminders_for_event_registration
-- ============================================
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
  -- Get user's reminder settings
  SELECT * INTO user_settings
  FROM public.reminder_settings
  WHERE user_id = NEW.user_id;
  
  -- If no settings or reminders disabled, do nothing
  IF user_settings IS NULL OR user_settings.reminders_enabled = false THEN
    RETURN NEW;
  END IF;
  
  -- Get event details
  SELECT event_date, start_time, timezone INTO event_data
  FROM public.events
  WHERE id = NEW.event_id;
  
  -- If event not found or no date, do nothing
  IF event_data IS NULL OR event_data.event_date IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Parse event date and time to create full datetime
  -- event_date is a DATE, start_time is a TIME string (e.g., '09:00:00')
  -- Combine them into a TIMESTAMPTZ
  event_start_datetime := (
    event_data.event_date::text || ' ' || COALESCE(event_data.start_time, '09:00:00')
  )::timestamptz;
  
  -- If event is in the past, don't schedule reminders
  IF event_start_datetime <= NOW() THEN
    RETURN NEW;
  END IF;
  
  -- Schedule "day before" reminder (9:00 AM the day before)
  IF user_settings.remind_day_before = true THEN
    reminder_time := (event_start_datetime - INTERVAL '1 day')::date::timestamp + TIME '09:00:00';
    -- Only schedule if reminder time is in the future
    IF reminder_time > NOW() THEN
      INSERT INTO public.scheduled_reminders (
        user_id,
        event_id,
        reminder_type,
        scheduled_for,
        status
      )
      VALUES (
        NEW.user_id,
        NEW.event_id,
        'day_before',
        reminder_time,
        'pending'
      );
    END IF;
  END IF;
  
  -- Schedule "day of" reminder (8:00 AM on the day of event)
  IF user_settings.remind_day_of = true THEN
    reminder_time := event_start_datetime::date::timestamp + TIME '08:00:00';
    -- Only schedule if reminder time is in the future
    IF reminder_time > NOW() AND reminder_time < event_start_datetime THEN
      INSERT INTO public.scheduled_reminders (
        user_id,
        event_id,
        reminder_type,
        scheduled_for,
        status
      )
      VALUES (
        NEW.user_id,
        NEW.event_id,
        'day_of',
        reminder_time,
        'pending'
      );
    END IF;
  END IF;
  
  -- Schedule "hours before" reminder
  IF user_settings.remind_hours_before IS NOT NULL THEN
    hours_before_val := user_settings.remind_hours_before;
    reminder_time := event_start_datetime - (hours_before_val || ' hours')::interval;
    -- Only schedule if reminder time is in the future
    IF reminder_time > NOW() THEN
      INSERT INTO public.scheduled_reminders (
        user_id,
        event_id,
        reminder_type,
        scheduled_for,
        status
      )
      VALUES (
        NEW.user_id,
        NEW.event_id,
        'hours_before',
        reminder_time,
        'pending'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- FUNCTION: schedule_reminders_for_opportunity_signup
-- ============================================
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
  -- Get user's reminder settings
  SELECT * INTO user_settings
  FROM public.reminder_settings
  WHERE user_id = NEW.user_id;
  
  -- If no settings or reminders disabled, do nothing
  IF user_settings IS NULL OR user_settings.reminders_enabled = false THEN
    RETURN NEW;
  END IF;
  
  -- Get opportunity details
  -- Opportunities use date_start (TIMESTAMPTZ) and time_start (TIME string)
  SELECT date_start, time_start INTO opportunity_data
  FROM public.opportunities
  WHERE id = NEW.opportunity_id;
  
  -- If opportunity not found or no date, do nothing
  IF opportunity_data IS NULL OR opportunity_data.date_start IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Parse opportunity date and time
  -- date_start is already a TIMESTAMPTZ, but we need to combine with time_start if provided
  IF opportunity_data.time_start IS NOT NULL THEN
    -- Combine date from date_start with time from time_start
    opportunity_start_datetime := (
      opportunity_data.date_start::date::text || ' ' || opportunity_data.time_start
    )::timestamptz;
  ELSE
    -- Use date_start as-is (it's already a timestamp)
    opportunity_start_datetime := opportunity_data.date_start;
  END IF;
  
  -- If opportunity is in the past, don't schedule reminders
  IF opportunity_start_datetime <= NOW() THEN
    RETURN NEW;
  END IF;
  
  -- Schedule "day before" reminder (9:00 AM the day before)
  IF user_settings.remind_day_before = true THEN
    reminder_time := (opportunity_start_datetime - INTERVAL '1 day')::date::timestamp + TIME '09:00:00';
    -- Only schedule if reminder time is in the future
    IF reminder_time > NOW() THEN
      INSERT INTO public.scheduled_reminders (
        user_id,
        opportunity_id,
        reminder_type,
        scheduled_for,
        status
      )
      VALUES (
        NEW.user_id,
        NEW.opportunity_id,
        'day_before',
        reminder_time,
        'pending'
      );
    END IF;
  END IF;
  
  -- Schedule "day of" reminder (8:00 AM on the day of opportunity)
  IF user_settings.remind_day_of = true THEN
    reminder_time := opportunity_start_datetime::date::timestamp + TIME '08:00:00';
    -- Only schedule if reminder time is in the future
    IF reminder_time > NOW() AND reminder_time < opportunity_start_datetime THEN
      INSERT INTO public.scheduled_reminders (
        user_id,
        opportunity_id,
        reminder_type,
        scheduled_for,
        status
      )
      VALUES (
        NEW.user_id,
        NEW.opportunity_id,
        'day_of',
        reminder_time,
        'pending'
      );
    END IF;
  END IF;
  
  -- Schedule "hours before" reminder
  IF user_settings.remind_hours_before IS NOT NULL THEN
    hours_before_val := user_settings.remind_hours_before;
    reminder_time := opportunity_start_datetime - (hours_before_val || ' hours')::interval;
    -- Only schedule if reminder time is in the future
    IF reminder_time > NOW() THEN
      INSERT INTO public.scheduled_reminders (
        user_id,
        opportunity_id,
        reminder_type,
        scheduled_for,
        status
      )
      VALUES (
        NEW.user_id,
        NEW.opportunity_id,
        'hours_before',
        reminder_time,
        'pending'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- FUNCTION: cancel_reminders_on_unregister
-- ============================================
CREATE OR REPLACE FUNCTION public.cancel_reminders_on_unregister()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Cancel pending reminders for the deleted registration
  IF TG_TABLE_NAME = 'event_registrations' THEN
    UPDATE public.scheduled_reminders
    SET status = 'cancelled'
    WHERE event_id = OLD.event_id
      AND user_id = OLD.user_id
      AND status = 'pending';
  ELSIF TG_TABLE_NAME = 'opportunity_signups' THEN
    UPDATE public.scheduled_reminders
    SET status = 'cancelled'
    WHERE opportunity_id = OLD.opportunity_id
      AND user_id = OLD.user_id
      AND status = 'pending';
  END IF;
  
  RETURN OLD;
END;
$$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger: Auto-create reminder settings for new users (via handle_new_user function)
-- This is handled by updating the existing handle_new_user() function

-- Trigger: Schedule reminders when user registers for event
DROP TRIGGER IF EXISTS trigger_schedule_reminders_on_event_registration ON public.event_registrations;
CREATE TRIGGER trigger_schedule_reminders_on_event_registration
  AFTER INSERT ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.schedule_reminders_for_event_registration();

-- Trigger: Schedule reminders when user signs up for opportunity
DROP TRIGGER IF EXISTS trigger_schedule_reminders_on_opportunity_signup ON public.opportunity_signups;
CREATE TRIGGER trigger_schedule_reminders_on_opportunity_signup
  AFTER INSERT ON public.opportunity_signups
  FOR EACH ROW
  EXECUTE FUNCTION public.schedule_reminders_for_opportunity_signup();

-- Trigger: Cancel reminders when user unregisters from event
DROP TRIGGER IF EXISTS trigger_cancel_reminders_on_event_unregister ON public.event_registrations;
CREATE TRIGGER trigger_cancel_reminders_on_event_unregister
  AFTER DELETE ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.cancel_reminders_on_unregister();

-- Trigger: Cancel reminders when user unregisters from opportunity
DROP TRIGGER IF EXISTS trigger_cancel_reminders_on_opportunity_unregister ON public.opportunity_signups;
CREATE TRIGGER trigger_cancel_reminders_on_opportunity_unregister
  AFTER DELETE ON public.opportunity_signups
  FOR EACH ROW
  EXECUTE FUNCTION public.cancel_reminders_on_unregister();

-- ============================================
-- UPDATE handle_new_user() FUNCTION
-- ============================================
-- Add reminder settings creation to the existing trigger function
-- Note: This should be run after the handle_new_user.sql trigger is applied

-- ============================================
-- HELPER: Update existing users with reminder settings
-- ============================================
-- Run this once to create reminder settings for existing users
INSERT INTO public.reminder_settings (user_id, reminders_enabled, remind_day_before, remind_day_of, remind_hours_before, created_at, updated_at)
SELECT 
  id,
  true,
  true,
  true,
  NULL,
  NOW(),
  NOW()
FROM public.users
WHERE id NOT IN (SELECT user_id FROM public.reminder_settings)
ON CONFLICT (user_id) DO NOTHING;

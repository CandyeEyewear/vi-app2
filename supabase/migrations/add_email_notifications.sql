-- Add email notification settings and throttling
-- Run this migration in Supabase SQL Editor

-- 1. Add email_notifications_enabled column to user_notification_settings
ALTER TABLE public.user_notification_settings
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT true;

-- 2. Create table to track email notifications sent (for throttling)
CREATE TABLE IF NOT EXISTS public.email_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'message', 'circle_request', 'announcement', etc.
  reference_id TEXT, -- conversation_id for messages, user_id for circle requests, etc.
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Index for fast lookups
  CONSTRAINT unique_recent_email UNIQUE (user_id, notification_type, reference_id)
);

-- Index for checking recent emails
CREATE INDEX IF NOT EXISTS idx_email_log_user_type_sent
ON public.email_notification_log(user_id, notification_type, sent_at DESC);

-- Index for cleanup of old records
CREATE INDEX IF NOT EXISTS idx_email_log_sent_at
ON public.email_notification_log(sent_at);

-- 3. Enable RLS
ALTER TABLE public.email_notification_log ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies - only service role can access this table
CREATE POLICY "Service role can manage email logs"
ON public.email_notification_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. Function to check if we should send an email (throttling)
CREATE OR REPLACE FUNCTION public.should_send_notification_email(
  p_user_id UUID,
  p_notification_type TEXT,
  p_reference_id TEXT,
  p_throttle_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_sent TIMESTAMPTZ;
  v_email_enabled BOOLEAN;
  v_user_online BOOLEAN;
  v_last_seen TIMESTAMPTZ;
BEGIN
  -- Check if user has email notifications enabled
  SELECT email_notifications_enabled INTO v_email_enabled
  FROM public.user_notification_settings
  WHERE user_id = p_user_id;

  IF v_email_enabled IS NULL OR v_email_enabled = false THEN
    RETURN false;
  END IF;

  -- Check if user is currently online (active in last 5 minutes)
  SELECT online_status, last_seen INTO v_user_online, v_last_seen
  FROM public.users
  WHERE id = p_user_id;

  -- If user is online or was active in last 5 minutes, don't send email
  IF v_user_online = true OR (v_last_seen IS NOT NULL AND v_last_seen > NOW() - INTERVAL '5 minutes') THEN
    RETURN false;
  END IF;

  -- Check throttling - was an email sent for this type/reference recently?
  SELECT sent_at INTO v_last_sent
  FROM public.email_notification_log
  WHERE user_id = p_user_id
    AND notification_type = p_notification_type
    AND (reference_id = p_reference_id OR (reference_id IS NULL AND p_reference_id IS NULL))
  ORDER BY sent_at DESC
  LIMIT 1;

  IF v_last_sent IS NOT NULL AND v_last_sent > NOW() - (p_throttle_minutes || ' minutes')::INTERVAL THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- 6. Function to log that an email was sent
CREATE OR REPLACE FUNCTION public.log_notification_email(
  p_user_id UUID,
  p_notification_type TEXT,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Upsert the log entry
  INSERT INTO public.email_notification_log (user_id, notification_type, reference_id, sent_at)
  VALUES (p_user_id, p_notification_type, p_reference_id, NOW())
  ON CONFLICT (user_id, notification_type, reference_id)
  DO UPDATE SET sent_at = NOW();
END;
$$;

-- 7. Cleanup function to remove old email logs (run via cron)
CREATE OR REPLACE FUNCTION public.cleanup_old_email_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.email_notification_log
  WHERE sent_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- 8. Update handle_new_user to include email_notifications_enabled
-- (This ensures new users get the default setting)
-- Note: If trigger already exists, it should already insert into user_notification_settings
-- We just need to ensure the default is set

-- Add comment for documentation
COMMENT ON COLUMN public.user_notification_settings.email_notifications_enabled IS
'Whether to send email notifications for messages and other alerts';

COMMENT ON TABLE public.email_notification_log IS
'Tracks sent email notifications for throttling purposes';

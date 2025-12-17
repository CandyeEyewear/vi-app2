-- ============================================
-- TARGETED ANNOUNCEMENTS (General vs Targeted)
-- ============================================
-- Adds:
-- 1) posts.announcement_scope ('general' | 'targeted')
-- 2) announcement_targets join table
-- 3) RPC function to create targeted announcement notifications for eligible users
-- Date: 2025-12-17
-- ============================================

-- 1) posts: announcement_scope
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS announcement_scope TEXT NOT NULL DEFAULT 'general'
CHECK (announcement_scope IN ('general', 'targeted'));

-- 2) announcement_targets table
CREATE TABLE IF NOT EXISTS public.announcement_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('opportunity', 'event', 'cause')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS announcement_targets_post_id_idx
  ON public.announcement_targets (post_id);

CREATE INDEX IF NOT EXISTS announcement_targets_type_id_idx
  ON public.announcement_targets (target_type, target_id);

-- 3) Targeted announcement notifications (eligible audience only)
-- Eligibility rules:
-- - opportunity: users with opportunity_signups (status != 'cancelled')
-- - event: users with event_registrations
-- - cause: users with donations (payment_status='completed')
CREATE OR REPLACE FUNCTION public.create_targeted_announcement_notifications(
  p_post_id UUID,
  p_title TEXT,
  p_content TEXT,
  p_sender_id UUID
)
RETURNS TABLE(user_id UUID) AS $$
BEGIN
  RETURN QUERY
  WITH targets AS (
    SELECT at.target_type, at.target_id
    FROM public.announcement_targets at
    WHERE at.post_id = p_post_id
  ),
  eligible_users AS (
    -- Opportunity signups
    SELECT DISTINCT os.user_id
    FROM targets t
    JOIN public.opportunity_signups os
      ON t.target_type = 'opportunity'
     AND os.opportunity_id = t.target_id
    WHERE COALESCE(os.status, '') <> 'cancelled'

    UNION

    -- Event registrations
    SELECT DISTINCT er.user_id
    FROM targets t
    JOIN public.event_registrations er
      ON t.target_type = 'event'
     AND er.event_id = t.target_id

    UNION

    -- Cause donors (completed payments)
    SELECT DISTINCT d.user_id
    FROM targets t
    JOIN public.donations d
      ON t.target_type = 'cause'
     AND d.cause_id = t.target_id
    WHERE d.payment_status = 'completed'
  )
  INSERT INTO public.notifications (user_id, type, title, message, link, related_id, is_read, created_at)
  SELECT
    eu.user_id,
    'announcement',
    p_title,
    p_content,
    '/post/' || p_post_id,
    p_post_id,
    false,
    NOW()
  FROM eligible_users eu
  JOIN public.users u ON u.id = eu.user_id
  LEFT JOIN public.user_notification_settings uns ON uns.user_id = eu.user_id
  WHERE
    eu.user_id <> p_sender_id
    AND (uns.announcements_enabled IS NULL OR uns.announcements_enabled = true)
  RETURNING notifications.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_targeted_announcement_notifications IS
  'Creates in-app notifications for eligible users only (participants/donors) for targeted announcements';



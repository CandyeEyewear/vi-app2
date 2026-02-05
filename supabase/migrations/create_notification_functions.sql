-- ============================================
-- NOTIFICATION SYSTEM FUNCTIONS
-- ============================================
-- This migration creates the RPC functions needed for the notification system
-- Date: 2025-12-02
-- ============================================

-- Function to create announcement notifications for all users
CREATE OR REPLACE FUNCTION create_announcement_notifications(
  p_post_id UUID,
  p_title TEXT,
  p_content TEXT,
  p_sender_id UUID
)
RETURNS TABLE(user_id UUID) AS $$
BEGIN
  -- Insert notifications for all users except the sender
  -- Only for users who have announcements enabled (defaults to true)
  RETURN QUERY
  INSERT INTO notifications (user_id, type, title, message, link, related_id, is_read, created_at)
  SELECT 
    u.id,
    'announcement',
    p_title,
    p_content,
    '/post/' || p_post_id,
    p_post_id,
    false,
    NOW()
  FROM users u
  LEFT JOIN user_notification_settings uns ON uns.user_id = u.id
  WHERE 
    u.id != p_sender_id
    AND (uns.announcements_enabled IS NULL OR uns.announcements_enabled = true)
  RETURNING user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create cause notifications for all users
CREATE OR REPLACE FUNCTION create_cause_notifications(
  p_cause_id UUID,
  p_title TEXT,
  p_creator_id UUID
)
RETURNS TABLE(user_id UUID) AS $$
BEGIN
  -- Insert notifications for all users except the creator
  -- Only for users who have causes enabled (defaults to true)
  RETURN QUERY
  INSERT INTO notifications (user_id, type, title, message, link, related_id, is_read, created_at)
  SELECT 
    u.id,
    'cause',
    'New Fundraising Cause',
    p_title || ' - Help make a difference!',
    '/causes/' || p_cause_id,
    p_cause_id,
    false,
    NOW()
  FROM users u
  LEFT JOIN user_notification_settings uns ON uns.user_id = u.id
  WHERE 
    u.id != p_creator_id
    AND (uns.causes_enabled IS NULL OR uns.causes_enabled = true)
  RETURNING user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create event notifications for all users
CREATE OR REPLACE FUNCTION create_event_notifications(
  p_event_id UUID,
  p_title TEXT,
  p_creator_id UUID
)
RETURNS TABLE(user_id UUID) AS $$
BEGIN
  -- Insert notifications for all users except the creator
  -- Only for users who have events enabled (defaults to true)
  RETURN QUERY
  INSERT INTO notifications (user_id, type, title, message, link, related_id, is_read, created_at)
  SELECT 
    u.id,
    'event',
    'New Event',
    p_title || ' - Join us!',
    '/events/' || p_event_id,
    p_event_id,
    false,
    NOW()
  FROM users u
  LEFT JOIN user_notification_settings uns ON uns.user_id = u.id
  WHERE 
    u.id != p_creator_id
    AND (uns.events_enabled IS NULL OR uns.events_enabled = true)
  RETURNING user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create opportunity notifications for all users
CREATE OR REPLACE FUNCTION create_opportunity_notifications(
  p_opportunity_id UUID,
  p_title TEXT,
  p_organization_name TEXT,
  p_sender_id UUID
)
RETURNS TABLE(user_id UUID) AS $$
BEGIN
  -- Insert notifications for all users except the creator
  -- Only for users who have opportunities enabled (defaults to true)
  RETURN QUERY
  INSERT INTO notifications (user_id, type, title, message, link, related_id, is_read, created_at)
  SELECT
    u.id,
    'opportunity',
    'New Opportunity Available',
    p_title || ' - ' || p_organization_name,
    '/opportunity/' || p_opportunity_id,
    p_opportunity_id,
    false,
    NOW()
  FROM users u
  LEFT JOIN user_notification_settings uns ON uns.user_id = u.id
  WHERE
    u.id != p_sender_id
    AND (uns.opportunities_enabled IS NULL OR uns.opportunities_enabled = true)
  RETURNING user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON FUNCTION create_announcement_notifications IS 'Creates in-app notifications for all users (except sender) when a new announcement is posted';
COMMENT ON FUNCTION create_cause_notifications IS 'Creates in-app notifications for all users (except creator) when a new cause is created';
COMMENT ON FUNCTION create_event_notifications IS 'Creates in-app notifications for all users (except creator) when a new event is created';
COMMENT ON FUNCTION create_opportunity_notifications IS 'Creates in-app notifications for all users (except creator) when a new opportunity is created';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the functions work:
--
-- 1. Check if functions exist:
--    SELECT proname FROM pg_proc WHERE proname LIKE '%notification%';
--
-- 2. Test announcement notifications:
--    SELECT * FROM create_announcement_notifications(
--      'test-post-id'::uuid,
--      'Test Announcement',
--      'This is a test message',
--      'your-user-id'::uuid
--    );
--
-- 3. Check created notifications:
--    SELECT * FROM notifications 
--    WHERE type = 'announcement' 
--    ORDER BY created_at DESC 
--    LIMIT 10;
-- ============================================

-- Create RPC function to create opportunity notifications
-- Date: 2026-02-08

CREATE OR REPLACE FUNCTION create_opportunity_notifications(
  p_opportunity_id UUID,
  p_title TEXT,
  p_organization_name TEXT,
  p_sender_id UUID
)
RETURNS TABLE(user_id UUID) AS $$
BEGIN
  -- Insert notifications for all users except the sender
  -- Only for users who have opportunities enabled (defaults to true)
  RETURN QUERY
  INSERT INTO notifications (user_id, type, title, message, link, related_id, is_read, created_at)
  SELECT 
    u.id,
    'opportunity',
    'New Volunteer Opportunity',
    p_organization_name || ': ' || p_title,
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

COMMENT ON FUNCTION create_opportunity_notifications IS 'Creates in-app notifications for all users (except sender) when a new opportunity is created';

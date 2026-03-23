-- Create RPC functions for notifying users when opportunities, events, or causes are updated
-- Date: 2026-03-23

-- Drop existing versions (may have different return types)
DROP FUNCTION IF EXISTS notify_opportunity_update(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS notify_event_update(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS notify_cause_update(UUID, TEXT, TEXT);

-- 1. Notify opportunity signups about updates
CREATE OR REPLACE FUNCTION notify_opportunity_update(
  p_opportunity_id UUID,
  p_title TEXT,
  p_changes TEXT
)
RETURNS INTEGER AS $$
DECLARE
  notified_count INTEGER;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link, related_id, is_read, created_at)
  SELECT
    os.user_id,
    'opportunity',
    'Opportunity Updated',
    p_title || ': ' || p_changes,
    '/opportunity/' || p_opportunity_id,
    p_opportunity_id,
    false,
    NOW()
  FROM opportunity_signups os
  WHERE os.opportunity_id = p_opportunity_id
    AND COALESCE(os.status, '') <> 'cancelled'
    AND os.user_id <> auth.uid();

  GET DIAGNOSTICS notified_count = ROW_COUNT;
  RETURN notified_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_opportunity_update IS 'Creates in-app notifications for signed-up users when an opportunity is updated';

-- 2. Notify event registrants about updates
CREATE OR REPLACE FUNCTION notify_event_update(
  p_event_id UUID,
  p_title TEXT,
  p_changes TEXT
)
RETURNS INTEGER AS $$
DECLARE
  notified_count INTEGER;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link, related_id, is_read, created_at)
  SELECT
    er.user_id,
    'event',
    'Event Updated',
    p_title || ': ' || p_changes,
    '/events/' || p_event_id,
    p_event_id,
    false,
    NOW()
  FROM event_registrations er
  WHERE er.event_id = p_event_id
    AND er.user_id <> auth.uid();

  GET DIAGNOSTICS notified_count = ROW_COUNT;
  RETURN notified_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_event_update IS 'Creates in-app notifications for registered users when an event is updated';

-- 3. Notify cause donors about updates
CREATE OR REPLACE FUNCTION notify_cause_update(
  p_cause_id UUID,
  p_title TEXT,
  p_changes TEXT
)
RETURNS INTEGER AS $$
DECLARE
  notified_count INTEGER;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link, related_id, is_read, created_at)
  SELECT DISTINCT
    d.user_id,
    'cause',
    'Cause Updated',
    p_title || ': ' || p_changes,
    '/causes/' || p_cause_id,
    p_cause_id,
    false,
    NOW()
  FROM donations d
  WHERE d.cause_id = p_cause_id
    AND d.payment_status = 'completed'
    AND d.user_id <> auth.uid();

  GET DIAGNOSTICS notified_count = ROW_COUNT;
  RETURN notified_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_cause_update IS 'Creates in-app notifications for donors when a cause is updated';

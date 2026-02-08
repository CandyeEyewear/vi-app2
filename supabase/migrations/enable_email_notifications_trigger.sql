-- Enable email notifications trigger
-- Uses pg_net extension to call Edge Function
-- TODO: Replace YOUR_SERVICE_ROLE_KEY and URL with actual values in production

CREATE EXTENSION IF NOT EXISTS "pg_net";

CREATE OR REPLACE FUNCTION public.trigger_send_email_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payload JSONB;
  -- Default to local development URL
  v_url TEXT := 'https://drshtkrhszeaxpmectex.supabase.co/functions/v1/send-notification-email'; 
  -- Placeholder for service role key - MUST BE REPLACED
  v_api_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyc2h0a3Joc3plYXhwbWVjdGV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjI1NTA1MCwiZXhwIjoyMDc3ODMxMDUwfQ.yzF0d7IwjjspjeRwgXJetEhqPx6pXZxjKxKduSvhyrE'; 
  v_headers JSONB;
  v_request_id BIGINT;
BEGIN
  -- Construct payload matches NotificationEmailRequest interface
  v_payload := jsonb_build_object(
    'recipientUserId', NEW.user_id,
    'type', NEW.type,
    'data', jsonb_build_object(
      'title', NEW.title,
      'description', NEW.message, -- Generic fallback for description
      'messagePreview', NEW.message, -- For messages
      'link', NEW.link,
      'id', NEW.related_id::text,
      'conversationId', NEW.related_id::text -- Assuming related_id maps to conversation_id for messages
    )
  );
  
  -- Prepare headers
  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_api_key
  );

  -- Make the HTTP POST request (asynchronous)
  -- The id is returned but we ignore it
  SELECT net.http_post(
    url := v_url,
    body := v_payload,
    headers := v_headers
  ) INTO v_request_id;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log warning but ensure transaction completes
  RAISE WARNING 'Error driving email notification trigger: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_notification_created ON public.notifications;
CREATE TRIGGER on_notification_created
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_send_email_notification();

COMMENT ON FUNCTION public.trigger_send_email_notification IS 'Triggers generic email notification via Edge Function';

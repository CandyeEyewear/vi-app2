/**
 * Migration: Setup Payment Checker Cron Job
 * 
 * This migration sets up a cron job to automatically check pending payments
 * every hour and process any that were actually completed.
 * 
 * IMPORTANT: Replace the placeholders before running:
 * - [YOUR_SUPABASE_URL] - Your Supabase project URL
 * - [SERVICE_ROLE_KEY] - Your Supabase service role key
 * 
 * To get your Supabase URL and service role key:
 * 1. Go to your Supabase project dashboard
 * 2. Settings > API
 * 3. Copy the "Project URL" and "service_role" key
 * 
 * To run this migration:
 * 1. Replace the placeholders below
 * 2. Run in Supabase SQL Editor or via Supabase CLI
 */

-- Enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the payment checker to run every hour
-- Cron format: minute hour day month weekday
-- '0 * * * *' means: at minute 0 of every hour (i.e., every hour on the hour)
SELECT cron.schedule(
  'check-pending-payments',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT net.http_post(
    url := '[YOUR_SUPABASE_URL]/functions/v1/check-pending-payments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'check-pending-payments';

-- To manually test the cron job (optional):
-- SELECT net.http_post(
--   url := '[YOUR_SUPABASE_URL]/functions/v1/check-pending-payments',
--   headers := jsonb_build_object(
--     'Content-Type', 'application/json',
--     'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
--   ),
--   body := '{}'::jsonb
-- );

-- To unschedule the cron job (if needed):
-- SELECT cron.unschedule('check-pending-payments');

-- To view cron job execution history:
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'check-pending-payments') ORDER BY start_time DESC LIMIT 10;

-- Migration: Add causes_enabled and events_enabled columns to user_notification_settings table
-- This allows users to control whether they receive notifications for new causes and events
-- Date: 2025-12-01

-- Add causes_enabled column (defaults to true for new and existing users)
ALTER TABLE user_notification_settings
ADD COLUMN IF NOT EXISTS causes_enabled BOOLEAN DEFAULT true NOT NULL;

-- Add events_enabled column (defaults to true for new and existing users)
ALTER TABLE user_notification_settings
ADD COLUMN IF NOT EXISTS events_enabled BOOLEAN DEFAULT true NOT NULL;

-- Update existing rows to have these enabled by default
UPDATE user_notification_settings
SET causes_enabled = true,
    events_enabled = true
WHERE causes_enabled IS NULL OR events_enabled IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN user_notification_settings.causes_enabled IS 'Whether user receives notifications for new fundraising causes';
COMMENT ON COLUMN user_notification_settings.events_enabled IS 'Whether user receives notifications for new events';

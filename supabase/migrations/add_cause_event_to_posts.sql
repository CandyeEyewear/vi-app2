-- Migration: Add cause_id and event_id columns to posts table
-- This allows posts to be linked to causes and events

-- Add cause_id column (nullable, references causes table)
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS cause_id UUID REFERENCES causes(id) ON DELETE SET NULL;

-- Add event_id column (nullable, references events table)
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_posts_cause_id ON posts(cause_id);
CREATE INDEX IF NOT EXISTS idx_posts_event_id ON posts(event_id);

-- Add comments for documentation
COMMENT ON COLUMN posts.cause_id IS 'Reference to a cause when this post is sharing a cause';
COMMENT ON COLUMN posts.event_id IS 'Reference to an event when this post is sharing an event';


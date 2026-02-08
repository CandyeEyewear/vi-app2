-- Add visibility column to opportunities, events, and causes tables
-- Date: 2026-02-08

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';
ALTER TABLE events ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';
ALTER TABLE causes ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';

COMMENT ON COLUMN opportunities.visibility IS 'Visibility of the opportunity: public or circle';
COMMENT ON COLUMN events.visibility IS 'Visibility of the event: public or circle';
COMMENT ON COLUMN causes.visibility IS 'Visibility of the cause: public or circle';

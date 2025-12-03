-- Create saved_causes table
CREATE TABLE IF NOT EXISTS saved_causes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cause_id UUID NOT NULL REFERENCES causes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, cause_id)
);

-- Create saved_events table
CREATE TABLE IF NOT EXISTS saved_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_saved_causes_user_id ON saved_causes(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_causes_cause_id ON saved_causes(cause_id);
CREATE INDEX IF NOT EXISTS idx_saved_events_user_id ON saved_events(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_events_event_id ON saved_events(event_id);

-- Enable Row Level Security
ALTER TABLE saved_causes ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_events ENABLE ROW LEVEL SECURITY;

-- Policies for saved_causes
CREATE POLICY "Users can view their own saved causes"
  ON saved_causes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save causes"
  ON saved_causes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave causes"
  ON saved_causes FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for saved_events
CREATE POLICY "Users can view their own saved events"
  ON saved_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save events"
  ON saved_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave events"
  ON saved_events FOR DELETE
  USING (auth.uid() = user_id);

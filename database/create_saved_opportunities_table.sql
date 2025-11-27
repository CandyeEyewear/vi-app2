-- Create saved_opportunities table for bookmarking opportunities
-- Run this SQL in your Supabase SQL Editor

-- First, check if public.users table exists. If it does, use it. Otherwise, use auth.users
-- Option 1: If you have a public.users table (most common)
CREATE TABLE IF NOT EXISTS public.saved_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, opportunity_id)
);

-- If you have a public.users table, uncomment this line:
-- ALTER TABLE public.saved_opportunities ADD CONSTRAINT fk_saved_opportunities_user_id 
--   FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- If you DON'T have a public.users table, use this instead:
-- ALTER TABLE public.saved_opportunities ADD CONSTRAINT fk_saved_opportunities_user_id 
--   FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_user_id ON public.saved_opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_opportunity_id ON public.saved_opportunities(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_saved_at ON public.saved_opportunities(saved_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.saved_opportunities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Policy: Users can view their own saved opportunities
CREATE POLICY "Users can view their own saved opportunities"
  ON public.saved_opportunities
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own saved opportunities
CREATE POLICY "Users can insert their own saved opportunities"
  ON public.saved_opportunities
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own saved opportunities
CREATE POLICY "Users can delete their own saved opportunities"
  ON public.saved_opportunities
  FOR DELETE
  USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT SELECT, INSERT, DELETE ON public.saved_opportunities TO authenticated;
GRANT USAGE ON SEQUENCE saved_opportunities_id_seq TO authenticated;


-- ============================================
-- ADD VISIBILITY COLUMN TO OPPORTUNITIES, EVENTS, AND CAUSES
-- ============================================
-- The create screens for opportunities, events, and causes all insert a
-- 'visibility' value ('public' or 'members_only'), but the column was never
-- added to these tables via migration. This causes the INSERT to fail with
-- a 400 Bad Request from PostgREST.
-- ============================================

-- Add visibility column to opportunities table
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'members_only'));

-- Add visibility column to events table
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'members_only'));

-- Add visibility column to causes table
ALTER TABLE public.causes
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'members_only'));

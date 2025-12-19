-- ============================================
-- CO-SIGNS (separate from reactions)
-- ============================================
-- Creates a dedicated table for "co-signs" on posts (e.g., shoutouts),
-- migrates any legacy cosign entries from post_reactions, and removes them.
-- This prevents invalid reaction_type values from violating post_reactions constraints.

-- 1) Table
CREATE TABLE IF NOT EXISTS public.post_cosigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_post_cosigns_post_id ON public.post_cosigns(post_id);
CREATE INDEX IF NOT EXISTS idx_post_cosigns_user_id ON public.post_cosigns(user_id);

-- 3) RLS
ALTER TABLE public.post_cosigns ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can view co-signs (needed to display co-signers on posts)
CREATE POLICY "Authenticated users can view post cosigns"
  ON public.post_cosigns
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can add their own co-sign
CREATE POLICY "Users can create their own post cosign"
  ON public.post_cosigns
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their own co-sign
CREATE POLICY "Users can delete their own post cosign"
  ON public.post_cosigns
  FOR DELETE
  USING (auth.uid() = user_id);

-- 4) Data migration: move any legacy 'cosign' reaction rows into post_cosigns
INSERT INTO public.post_cosigns (post_id, user_id, created_at)
SELECT pr.post_id, pr.user_id, pr.created_at
FROM public.post_reactions pr
WHERE pr.reaction_type = 'cosign'
ON CONFLICT (post_id, user_id) DO NOTHING;

-- 5) Remove legacy rows so post_reactions stays purely "reactions"
DELETE FROM public.post_reactions
WHERE reaction_type = 'cosign';













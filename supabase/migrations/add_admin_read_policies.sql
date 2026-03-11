-- Migration: Add admin/supervisor read policies for event_registrations, opportunity_signups, and users
--
-- Problem: RLS is enabled on these tables but no policies allow admins to read all rows.
-- This means admin screens (event registrations, participants list) show zero results.
--
-- Fix: Add SELECT policies for admins (role = 'admin') and supervisors (role = 'sup')
-- to read all rows in these tables. Also ensure all authenticated users can read
-- the users table (needed for profile views and JOIN operations).

-- ============================================================
-- 1. event_registrations: admin/sup can read all registrations
-- ============================================================
DROP POLICY IF EXISTS "Admins can view all event registrations" ON public.event_registrations;
CREATE POLICY "Admins can view all event registrations"
  ON public.event_registrations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'sup')
    )
  );

-- ============================================================
-- 2. opportunity_signups: admin/sup can read all signups
-- ============================================================
DROP POLICY IF EXISTS "Admins can view all opportunity signups" ON public.opportunity_signups;
CREATE POLICY "Admins can view all opportunity signups"
  ON public.opportunity_signups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'sup')
    )
  );

-- ============================================================
-- 3. users: all authenticated users can read user profiles
--    (needed for JOINs in registration/signup queries, profile
--     views, and general app functionality)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view all user profiles" ON public.users;
CREATE POLICY "Authenticated users can view all user profiles"
  ON public.users
  FOR SELECT
  USING (auth.role() = 'authenticated');

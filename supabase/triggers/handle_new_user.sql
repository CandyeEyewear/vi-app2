-- ============================================
-- CORRECTED DATABASE TRIGGER FOR SDK 54
-- ============================================
-- This trigger handles new user creation from Supabase Auth
-- Updated to work with SDK 54 and handle missing metadata gracefully
-- ============================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create the trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_metadata JSONB;
  full_name_val TEXT;
  phone_val TEXT;
  location_val TEXT;
  country_val TEXT;
  bio_val TEXT;
  areas_of_expertise_val TEXT[];
  education_val TEXT;
  date_of_birth_val TEXT;
  invite_code_val TEXT;
BEGIN
  -- Get metadata from the new user record
  -- Use COALESCE to handle missing raw_user_meta_data gracefully
  user_metadata := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  
  -- Extract values with defaults (defensive coding for SDK 54)
  full_name_val := COALESCE(
    user_metadata->>'full_name',
    user_metadata->>'fullName',  -- Try alternative key name
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')  -- Fallback
  );
  
  phone_val := COALESCE(
    user_metadata->>'phone',
    ''
  );
  
  location_val := COALESCE(
    user_metadata->>'location',
    ''
  );
  
  country_val := COALESCE(
    user_metadata->>'country',
    'Jamaica'  -- Default country
  );
  
  bio_val := COALESCE(
    user_metadata->>'bio',
    NULL
  );
  
  -- Handle areas_of_expertise (array)
  IF user_metadata->'areas_of_expertise' IS NOT NULL THEN
    areas_of_expertise_val := ARRAY(
      SELECT jsonb_array_elements_text(user_metadata->'areas_of_expertise')
    );
  ELSE
    areas_of_expertise_val := NULL;
  END IF;
  
  education_val := COALESCE(
    user_metadata->>'education',
    NULL
  );
  
  date_of_birth_val := COALESCE(
    user_metadata->>'date_of_birth',
    NULL
  );
  
  invite_code_val := COALESCE(
    user_metadata->>'invite_code',
    NULL
  );

  -- Insert into public.users table
  INSERT INTO public.users (
    id,
    email,
    full_name,
    phone,
    location,
    country,
    bio,
    areas_of_expertise,
    education,
    date_of_birth,
    role,
    total_hours,
    activities_completed,
    organizations_helped,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    full_name_val,
    phone_val,
    location_val,
    country_val,
    bio_val,
    areas_of_expertise_val,
    education_val,
    date_of_birth_val,
    'volunteer',  -- Default role
    0,            -- Default hours
    0,            -- Default activities
    0,            -- Default organizations
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;  -- Prevent duplicate inserts

  -- Create default notification settings with CORRECT column names
  INSERT INTO public.user_notification_settings (
    user_id,
    circle_requests_enabled,      -- ✅ CORRECT column name
    announcements_enabled,         -- ✅ CORRECT column name
    opportunities_enabled,         -- ✅ CORRECT column name
    messages_enabled,              -- ✅ CORRECT column name
    opportunity_proposals_enabled, -- ✅ CORRECT column name
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    true,  -- Default: enabled
    true,  -- Default: enabled
    true,  -- Default: enabled
    true,  -- Default: enabled
    true,  -- Default: enabled
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;  -- Prevent duplicate inserts

  -- Log for debugging (optional - remove in production)
  RAISE NOTICE 'User profile created: % (email: %, full_name: %, phone: %)', 
    NEW.id, 
    NEW.email, 
    full_name_val, 
    phone_val;

  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the trigger is working:
--
-- 1. Check if trigger exists:
--    SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
--
-- 2. Check function:
--    SELECT proname, prosrc FROM pg_proc WHERE proname = 'handle_new_user';
--
-- 3. Test with a new signup and check:
--    SELECT id, email, full_name, phone, location 
--    FROM public.users 
--    ORDER BY created_at DESC LIMIT 5;
--
-- 4. Check notification settings:
--    SELECT user_id, circle_requests_enabled, announcements_enabled, 
--           opportunities_enabled, messages_enabled, opportunity_proposals_enabled
--    FROM public.user_notification_settings 
--    ORDER BY created_at DESC LIMIT 5;
-- ============================================


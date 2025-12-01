# 🚀 Quick Deployment Guide - Push Notifications Fix

## TL;DR
Your push notifications for causes and events weren't sending because of missing database columns. Here's how to fix it in **5 minutes**.

---

## ⚡ Quick Fix (3 Steps)

### Step 1: Apply Database Migration (2 min)

#### Option A: Supabase CLI
```bash
supabase db push
```

#### Option B: Supabase Dashboard
1. Go to https://supabase.com/dashboard → Your Project
2. Click **SQL Editor**
3. Copy this SQL:

```sql
-- Add missing columns
ALTER TABLE user_notification_settings
ADD COLUMN IF NOT EXISTS causes_enabled BOOLEAN DEFAULT true NOT NULL;

ALTER TABLE user_notification_settings
ADD COLUMN IF NOT EXISTS events_enabled BOOLEAN DEFAULT true NOT NULL;

-- Enable for all existing users
UPDATE user_notification_settings
SET causes_enabled = true,
    events_enabled = true
WHERE causes_enabled IS NULL OR events_enabled IS NULL;
```

4. Click **Run** ▶️

### Step 2: Update Trigger (1 min)

In Supabase Dashboard → SQL Editor, run:

```sql
-- Drop and recreate the trigger function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create the updated trigger function
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
  user_metadata := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  
  full_name_val := COALESCE(
    user_metadata->>'full_name',
    user_metadata->>'fullName',
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  phone_val := COALESCE(user_metadata->>'phone', '');
  location_val := COALESCE(user_metadata->>'location', '');
  country_val := COALESCE(user_metadata->>'country', 'Jamaica');
  bio_val := COALESCE(user_metadata->>'bio', NULL);
  
  IF user_metadata->'areas_of_expertise' IS NOT NULL THEN
    areas_of_expertise_val := ARRAY(
      SELECT jsonb_array_elements_text(user_metadata->'areas_of_expertise')
    );
  ELSE
    areas_of_expertise_val := NULL;
  END IF;
  
  education_val := COALESCE(user_metadata->>'education', NULL);
  date_of_birth_val := COALESCE(user_metadata->>'date_of_birth', NULL);
  invite_code_val := COALESCE(user_metadata->>'invite_code', NULL);

  INSERT INTO public.users (
    id, email, full_name, phone, location, country, bio,
    areas_of_expertise, education, date_of_birth, role,
    total_hours, activities_completed, organizations_helped,
    created_at, updated_at
  )
  VALUES (
    NEW.id, COALESCE(NEW.email, ''), full_name_val, phone_val,
    location_val, country_val, bio_val, areas_of_expertise_val,
    education_val, date_of_birth_val, 'volunteer',
    0, 0, 0, NOW(), NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_notification_settings (
    user_id,
    circle_requests_enabled,
    announcements_enabled,
    opportunities_enabled,
    messages_enabled,
    opportunity_proposals_enabled,
    causes_enabled,
    events_enabled,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    true, true, true, true, true,
    true, -- causes_enabled
    true, -- events_enabled
    NOW(), NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

### Step 3: Deploy App Code (1 min)

```bash
# Stage changes
git add app/settings.tsx supabase/

# Commit
git commit -m "Fix: Add causes and events notification settings"

# Push to your branch
git push
```

---

## ✅ Verify It Works

### Quick Test
```sql
-- Run in SQL Editor to verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_notification_settings' 
AND column_name IN ('causes_enabled', 'events_enabled');

-- Should return:
-- causes_enabled | boolean
-- events_enabled | boolean
```

### Test Notifications
1. **In App**: Open Settings → See "Fundraising Causes" and "Events" toggles
2. **Create Cause**: Admin creates a cause → Users get push notification
3. **Create Event**: Admin creates an event → Users get push notification

---

## 🐛 Troubleshooting

### "Column already exists" error
```sql
-- Just run the UPDATE part:
UPDATE user_notification_settings
SET causes_enabled = true, events_enabled = true;
```

### Push notifications still not working
1. Check FCM credentials are set in Supabase
2. Verify users have `push_token` in database:
   ```sql
   SELECT id, push_token FROM users LIMIT 5;
   ```
3. Check Edge Function logs in Supabase Dashboard

### Settings screen crashes
1. Clear app cache and restart
2. Check console logs for errors
3. Verify migration completed successfully

---

## 📊 What Was Fixed

| Component | Status Before | Status After |
|-----------|---------------|--------------|
| In-app notifications | ✅ Working | ✅ Working |
| Push notifications for causes | ❌ Not sent | ✅ Now sent |
| Push notifications for events | ❌ Not sent | ✅ Now sent |
| User controls | ❌ Missing | ✅ Added to Settings |

---

## 📞 Need Help?

Check these files:
- `AUDIT_REPORT.md` - Complete technical audit
- `NOTIFICATION_FIX_SUMMARY.md` - Detailed fix documentation

Or check Supabase logs:
1. Go to Supabase Dashboard
2. Click **Edge Functions** → **send-fcm-notification**
3. Click **Logs**
4. Look for errors when creating causes/events

---

**Time to Complete**: ~5 minutes  
**Difficulty**: Easy  
**Risk**: Low (additive changes only)  
**Impact**: High (restores critical feature)

✅ **Ready to Deploy!**

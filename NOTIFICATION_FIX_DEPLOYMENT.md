# Notification System Fix - Deployment Guide

## Problem Found

The notification system for causes, events, and announcements was **not working** because:

1. **Missing Database Functions**: The `create_announcement_notifications`, `create_cause_notifications`, and `create_event_notifications` RPC functions were never created in the database
2. **Inconsistent Implementation**: Causes and events were manually inserting notifications instead of using database functions like announcements
3. **Settings Not Respected**: The manual insertion approach wasn't properly checking user notification preferences

## What Was Fixed

### 1. Created Missing Database Functions
- ✅ `create_announcement_notifications` - Creates in-app notifications for announcements
- ✅ `create_cause_notifications` - Creates in-app notifications for new causes
- ✅ `create_event_notifications` - Creates in-app notifications for new events

All functions now:
- Automatically exclude the creator/sender from receiving notifications
- Respect user notification settings (announcements_enabled, causes_enabled, events_enabled)
- Default to enabled if user hasn't set preferences
- Return the list of notified users for push notification targeting

### 2. Updated Application Code
- ✅ Updated `app/(admin)/causes/create.tsx` to use RPC function
- ✅ Updated `app/(admin)/events/create.tsx` to use RPC function
- ✅ Made all three notification flows consistent

### 3. Files Changed
```
Modified:
  - app/(admin)/causes/create.tsx
  - app/(admin)/events/create.tsx

Created:
  - supabase/migrations/create_notification_functions.sql
  - NOTIFICATION_FIX_DEPLOYMENT.md (this file)
```

## Deployment Steps

### Step 1: Run the Database Migration

You need to apply the new migration to create the missing database functions.

**Option A: Using Supabase Dashboard (Recommended)**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click "New query"
4. Copy and paste the entire contents of `/workspace/supabase/migrations/create_notification_functions.sql`
5. Click "Run" to execute the migration
6. Verify success (should show "Success. No rows returned")

**Option B: Using Supabase CLI**

```bash
# Make sure you're in the project root
cd /workspace

# Login to Supabase (if not already logged in)
supabase login

# Link to your project (if not already linked)
supabase link --project-ref your-project-ref

# Apply the migration
supabase db push

# Or manually run the migration file
supabase db execute --file supabase/migrations/create_notification_functions.sql
```

### Step 2: Verify Database Functions

Run these queries in your Supabase SQL Editor to verify the functions were created:

```sql
-- Check if all 3 functions exist
SELECT proname, pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname IN (
  'create_announcement_notifications',
  'create_cause_notifications', 
  'create_event_notifications'
)
ORDER BY proname;
```

You should see 3 rows returned.

### Step 3: Verify Notification Settings Columns

Ensure your `user_notification_settings` table has the correct columns:

```sql
-- Check columns in user_notification_settings table
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_notification_settings'
ORDER BY ordinal_position;
```

You should see these notification columns:
- `announcements_enabled` (boolean, default true)
- `causes_enabled` (boolean, default true)
- `events_enabled` (boolean, default true)
- `circle_requests_enabled` (boolean, default true)
- `opportunities_enabled` (boolean, default true)
- `opportunity_proposals_enabled` (boolean, default true)
- `messages_enabled` (boolean, default true)

If any are missing, run the migration:
```sql
-- This should already exist, but run if needed
ALTER TABLE user_notification_settings
ADD COLUMN IF NOT EXISTS causes_enabled BOOLEAN DEFAULT true NOT NULL,
ADD COLUMN IF NOT EXISTS events_enabled BOOLEAN DEFAULT true NOT NULL;

UPDATE user_notification_settings
SET causes_enabled = true, events_enabled = true
WHERE causes_enabled IS NULL OR events_enabled IS NULL;
```

### Step 4: Deploy the Application Code

Deploy the updated React Native code to your app:

```bash
# For development build
npm run android
# or
npm run ios

# For production build (EAS)
eas build --platform all

# For OTA update (if configured)
eas update --branch production --message "Fix notification system"
```

### Step 5: Test the Notification System

#### Test Announcements:
1. Login as an admin user
2. Navigate to "Create Announcement"
3. Create a test announcement
4. Check console logs for:
   - "✅ Notifications created successfully"
   - "📊 Total notifications sent: X"
   - "✅ Push sent to user: ..."
5. Login as a regular user
6. Check the notifications screen - you should see the announcement
7. You should also receive a push notification (on physical device only)

#### Test Causes:
1. Login as an admin user
2. Navigate to Admin Dashboard → Causes → Create Cause
3. Create a test cause
4. Check console logs for:
   - "🔧 Calling RPC function: create_cause_notifications"
   - "✅ Notifications created successfully"
   - "✅ Push sent to user: ..."
5. Login as a regular user
6. Check notifications screen - you should see "New Fundraising Cause"
7. You should receive a push notification (on physical device)

#### Test Events:
1. Login as an admin user
2. Navigate to Admin Dashboard → Events → Create Event
3. Create a test event
4. Check console logs for:
   - "🔧 Calling RPC function: create_event_notifications"
   - "✅ Notifications created successfully"
   - "✅ Push sent to user: ..."
5. Login as a regular user
6. Check notifications screen - you should see "New Event"
7. You should receive a push notification (on physical device)

### Step 6: Verify Notification Settings Work

1. Login as a regular user
2. Go to Settings → Notification Settings
3. Toggle OFF "Causes" notifications
4. Login as admin and create a new cause
5. The user should NOT receive a notification
6. Toggle ON "Causes" notifications
7. Create another cause
8. The user SHOULD now receive the notification

Repeat for Events and Announcements.

## Troubleshooting

### Issue: No in-app notifications appearing

**Solution:**
1. Check if the RPC functions exist in database (see Step 2)
2. Check console logs for errors when creating cause/event/announcement
3. Query the notifications table directly:
   ```sql
   SELECT * FROM notifications 
   WHERE created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC;
   ```
4. If no rows, the RPC function might not be executing correctly

### Issue: No push notifications

**Checklist:**
- ✅ Is the user on a physical device? (Push doesn't work on emulators)
- ✅ Does the user have a push_token in the users table?
- ✅ Is FIREBASE_SERVICE_ACCOUNT configured in Supabase Edge Functions?
- ✅ Are notifications enabled in device settings for the app?
- ✅ Check Edge Function logs in Supabase dashboard

**Debug Push Token:**
```sql
-- Check if user has push token
SELECT id, email, push_token, updated_at 
FROM users 
WHERE id = 'your-user-id';
```

### Issue: RPC function errors

If you see errors like "function create_announcement_notifications does not exist":

1. Make sure the migration was applied successfully
2. Check function exists:
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'create_announcement_notifications';
   ```
3. If not exists, re-run the migration SQL manually in SQL Editor

### Issue: Notifications sent to wrong users

The functions now properly:
- Exclude the creator/sender
- Only notify users with settings enabled (or NULL/undefined)
- Handle LEFT JOIN correctly so users without settings row still get notified

If issues persist, check:
```sql
-- See which users have notification settings
SELECT 
  u.id, 
  u.email,
  uns.announcements_enabled,
  uns.causes_enabled,
  uns.events_enabled
FROM users u
LEFT JOIN user_notification_settings uns ON uns.user_id = u.id
LIMIT 10;
```

## Architecture Overview

### How It Works Now

1. **Admin creates cause/event/announcement**
   ↓
2. **App calls RPC function** (e.g., `create_cause_notifications`)
   ↓
3. **Database function:**
   - Queries all users (except creator)
   - Checks notification settings
   - Inserts notifications for eligible users
   - Returns list of notified users
   ↓
4. **App receives list of notified users**
   ↓
5. **App queries push tokens** for notified users
   ↓
6. **App sends push notifications** via Firebase (Supabase Edge Function)

### Benefits of This Approach

- ✅ **Atomic**: In-app notifications created in single transaction
- ✅ **Consistent**: All notification types use same pattern
- ✅ **Efficient**: Database does filtering, not app code
- ✅ **Maintainable**: Logic centralized in database functions
- ✅ **Respects Settings**: User preferences properly enforced
- ✅ **Scalable**: Works for 10 users or 10,000 users

## Next Steps

After deployment:

1. **Monitor**: Check Supabase logs for any errors
2. **Test**: Create test causes/events/announcements
3. **Verify**: Confirm users receive both in-app and push notifications
4. **User Feedback**: Ask beta testers to confirm they're receiving notifications
5. **Settings**: Verify notification toggle switches work correctly

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review console logs (both app and Supabase Edge Functions)
3. Verify database functions exist and are correct
4. Test with a small user base first before full deployment

---

**Summary**: The notification system is now fully wired for causes, events, and announcements. Both in-app and push notifications should work correctly after deploying these changes.

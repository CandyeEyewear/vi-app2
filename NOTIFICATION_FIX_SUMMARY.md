# 🔔 Push Notifications Fix - Causes & Events

## Executive Summary

**Issue**: Push notifications for new causes and events were **NOT being sent**, though in-app notifications were being created in the database.

**Root Cause**: Database schema mismatch - the create screens were querying for `causes_enabled` and `events_enabled` columns that didn't exist in the `user_notification_settings` table.

**Status**: ✅ **FIXED**

---

## 🔍 Detailed Analysis

### What Was Broken

1. **Create Cause Screen** (`app/(admin)/causes/create.tsx`):
   - Creates in-app notifications ✅ (working)
   - Queries for `causes_enabled` setting ❌ (column didn't exist)
   - Push notifications not sent ❌ (filter failed)

2. **Create Event Screen** (`app/(admin)/events/create.tsx`):
   - Creates in-app notifications ✅ (working)
   - Queries for `events_enabled` setting ❌ (column didn't exist)
   - Push notifications not sent ❌ (filter failed)

### Why Notifications Appeared in the App

The **in-app notifications** were being created successfully in the database:
```typescript
const { error: notifError } = await supabase
  .from('notifications')
  .insert(notifications);
```

This explains why they showed up in your notifications screen, but **no push notifications** were being sent because the query to check user settings was failing.

### The Flow That Was Failing

```
1. Admin creates cause/event
   ↓
2. ✅ In-app notifications inserted into database
   ↓
3. Query user_notification_settings for causes_enabled/events_enabled
   ↓
4. ❌ Columns don't exist → Query returns empty/fails
   ↓
5. ❌ Filter finds 0 users with notifications enabled
   ↓
6. ❌ No push notifications sent
```

---

## ✅ Fixes Implemented

### 1. Database Migration

**File**: `supabase/migrations/add_causes_events_notification_settings.sql`

Added two new columns to `user_notification_settings`:
- `causes_enabled` (BOOLEAN, defaults to `true`)
- `events_enabled` (BOOLEAN, defaults to `true`)

```sql
ALTER TABLE user_notification_settings
ADD COLUMN IF NOT EXISTS causes_enabled BOOLEAN DEFAULT true NOT NULL;

ALTER TABLE user_notification_settings
ADD COLUMN IF NOT EXISTS events_enabled BOOLEAN DEFAULT true NOT NULL;

-- Update existing users to have these enabled
UPDATE user_notification_settings
SET causes_enabled = true,
    events_enabled = true
WHERE causes_enabled IS NULL OR events_enabled IS NULL;
```

### 2. User Creation Trigger Update

**File**: `supabase/triggers/handle_new_user.sql`

Updated the trigger that creates default notification settings for new users to include the new columns:

```sql
INSERT INTO public.user_notification_settings (
  user_id,
  circle_requests_enabled,
  announcements_enabled,
  opportunities_enabled,
  messages_enabled,
  opportunity_proposals_enabled,
  causes_enabled,        -- ✅ NEW
  events_enabled,        -- ✅ NEW
  created_at,
  updated_at
)
VALUES (
  NEW.id,
  true, true, true, true, true,
  true,  -- causes_enabled
  true,  -- events_enabled
  NOW(), NOW()
)
```

### 3. Settings Screen Update

**File**: `app/settings.tsx`

Added UI controls for users to manage cause and event notifications:

- Added `causes_enabled` and `events_enabled` to state
- Added switches for "Fundraising Causes" and "Events"
- Users can now opt in/out of these notifications

---

## 🚀 How to Deploy

### Step 1: Apply Database Migration

Run the migration on your Supabase database:

```bash
# If using Supabase CLI
supabase db push

# Or apply manually via Supabase Dashboard SQL Editor:
# 1. Go to SQL Editor in Supabase Dashboard
# 2. Copy contents of supabase/migrations/add_causes_events_notification_settings.sql
# 3. Execute the SQL
```

### Step 2: Update Trigger

Apply the updated trigger:

```bash
# Option 1: Via Supabase CLI
supabase db push

# Option 2: Via Supabase Dashboard
# 1. Go to SQL Editor
# 2. Copy contents of supabase/triggers/handle_new_user.sql
# 3. Execute the SQL
```

### Step 3: Deploy Code Changes

The code changes have been made to:
- `app/settings.tsx` - Settings UI
- No changes needed to create screens (they already had the correct logic)

---

## 📊 Complete Notification Flow (Now Fixed)

### When a Cause is Created:

```
1. Admin creates cause via /app/(admin)/causes/create.tsx
   ↓
2. ✅ Cause inserted into 'causes' table
   ↓
3. ✅ In-app notifications inserted for all users (except creator)
   ↓
4. ✅ Query user_notification_settings for 'causes_enabled'
   ↓
5. ✅ Filter users with causes_enabled = true AND push_token != null
   ↓
6. ✅ Send push notifications via FCM Edge Function
   ↓
7. ✅ Users receive push notification + in-app notification
```

### When an Event is Created:

```
1. Admin creates event via /app/(admin)/events/create.tsx
   ↓
2. ✅ Event inserted into 'events' table
   ↓
3. ✅ In-app notifications inserted for all users (except creator)
   ↓
4. ✅ Query user_notification_settings for 'events_enabled'
   ↓
5. ✅ Filter users with events_enabled = true AND push_token != null
   ↓
6. ✅ Send push notifications via FCM Edge Function
   ↓
7. ✅ Users receive push notification + in-app notification
```

---

## 🧪 Testing Checklist

After deploying, test the following:

### Database Testing
- [ ] Verify columns exist:
  ```sql
  SELECT column_name, data_type, column_default 
  FROM information_schema.columns 
  WHERE table_name = 'user_notification_settings' 
  AND column_name IN ('causes_enabled', 'events_enabled');
  ```

- [ ] Verify existing users have values:
  ```sql
  SELECT user_id, causes_enabled, events_enabled 
  FROM user_notification_settings 
  LIMIT 10;
  ```

### App Testing
- [ ] Open Settings screen
- [ ] Verify "Fundraising Causes" toggle appears
- [ ] Verify "Events" toggle appears
- [ ] Toggle causes notifications ON/OFF → verify database updates
- [ ] Toggle events notifications ON/OFF → verify database updates

### Push Notification Testing
- [ ] As admin, create a new cause
- [ ] Verify users with `causes_enabled = true` receive push notifications
- [ ] Check Supabase logs for any errors
- [ ] As admin, create a new event
- [ ] Verify users with `events_enabled = true` receive push notifications

### New User Testing
- [ ] Register a new user account
- [ ] Verify `causes_enabled` and `events_enabled` are set to `true` by default
- [ ] Verify new user receives cause/event notifications

---

## 📝 Files Changed

1. **NEW**: `supabase/migrations/add_causes_events_notification_settings.sql`
2. **MODIFIED**: `supabase/triggers/handle_new_user.sql`
3. **MODIFIED**: `app/settings.tsx`

---

## 🎯 Expected Behavior After Fix

### For All Users
- ✅ Receive push notifications for new causes (if enabled)
- ✅ Receive push notifications for new events (if enabled)
- ✅ See notifications in the in-app notifications screen
- ✅ Can control these settings in Settings screen

### For Admins
- ✅ When creating a cause, all users with `causes_enabled = true` get notified
- ✅ When creating an event, all users with `events_enabled = true` get notified
- ✅ See console logs confirming notifications were sent

### Default Behavior
- ✅ New users: All notifications enabled by default
- ✅ Existing users: All notifications enabled by default (after migration)

---

## 🔄 Rollback Plan

If issues occur, you can rollback the database changes:

```sql
-- Remove the new columns
ALTER TABLE user_notification_settings
DROP COLUMN IF EXISTS causes_enabled;

ALTER TABLE user_notification_settings
DROP COLUMN IF EXISTS events_enabled;

-- Restore the old trigger (remove causes_enabled and events_enabled from INSERT)
```

---

## 📞 Support

If you encounter any issues after deploying:

1. Check Supabase logs for errors
2. Verify the migration ran successfully
3. Check that FCM credentials are configured
4. Verify push tokens exist in the users table
5. Review browser console logs for any errors

---

**Audit Date**: December 1, 2025
**Status**: ✅ Ready for Deployment
**Impact**: HIGH - Restores critical notification functionality

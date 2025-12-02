# Notification Fix - Quick Start Guide

## 🚨 The Problem
- No in-app notifications for causes, events, or announcements
- No push notifications being sent
- Missing database functions causing silent failures

## ✅ The Fix
Created 3 database functions + updated app code to use them

## 🚀 Deploy in 5 Minutes

### Step 1: Run Database Migration (2 minutes)

**Copy this entire SQL and run it in Supabase SQL Editor:**

```sql
-- ============================================
-- NOTIFICATION SYSTEM FUNCTIONS
-- ============================================

-- Function to create announcement notifications for all users
CREATE OR REPLACE FUNCTION create_announcement_notifications(
  p_post_id UUID,
  p_title TEXT,
  p_content TEXT,
  p_sender_id UUID
)
RETURNS TABLE(user_id UUID) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO notifications (user_id, type, title, message, link, related_id, is_read, created_at)
  SELECT 
    u.id,
    'announcement',
    p_title,
    p_content,
    '/post/' || p_post_id,
    p_post_id,
    false,
    NOW()
  FROM users u
  LEFT JOIN user_notification_settings uns ON uns.user_id = u.id
  WHERE 
    u.id != p_sender_id
    AND (uns.announcements_enabled IS NULL OR uns.announcements_enabled = true)
  RETURNING user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create cause notifications for all users
CREATE OR REPLACE FUNCTION create_cause_notifications(
  p_cause_id UUID,
  p_title TEXT,
  p_creator_id UUID
)
RETURNS TABLE(user_id UUID) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO notifications (user_id, type, title, message, link, related_id, is_read, created_at)
  SELECT 
    u.id,
    'cause',
    'New Fundraising Cause',
    p_title || ' - Help make a difference!',
    '/causes/' || p_cause_id,
    p_cause_id,
    false,
    NOW()
  FROM users u
  LEFT JOIN user_notification_settings uns ON uns.user_id = u.id
  WHERE 
    u.id != p_creator_id
    AND (uns.causes_enabled IS NULL OR uns.causes_enabled = true)
  RETURNING user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create event notifications for all users
CREATE OR REPLACE FUNCTION create_event_notifications(
  p_event_id UUID,
  p_title TEXT,
  p_creator_id UUID
)
RETURNS TABLE(user_id UUID) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO notifications (user_id, type, title, message, link, related_id, is_read, created_at)
  SELECT 
    u.id,
    'event',
    'New Event',
    p_title || ' - Join us!',
    '/events/' || p_event_id,
    p_event_id,
    false,
    NOW()
  FROM users u
  LEFT JOIN user_notification_settings uns ON uns.user_id = u.id
  WHERE 
    u.id != p_creator_id
    AND (uns.events_enabled IS NULL OR uns.events_enabled = true)
  RETURNING user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

✅ Should see: "Success. No rows returned"

### Step 2: Verify Functions Exist (30 seconds)

Run this in SQL Editor:
```sql
SELECT proname FROM pg_proc WHERE proname LIKE '%notification%';
```

✅ Should see:
- create_announcement_notifications
- create_cause_notifications
- create_event_notifications

### Step 3: Deploy App Code (2 minutes)

```bash
# Rebuild and deploy
npm run android
# or
npm run ios

# For production OTA update
eas update --branch production --message "Fix notifications"
```

### Step 4: Test It (1 minute)

1. **Login as admin**
2. **Create a test cause** (Admin Dashboard → Causes → Create)
3. **Check console logs** - should see:
   ```
   ✅ Cause created successfully
   🔧 Calling RPC function: create_cause_notifications
   ✅ Notifications created successfully
   📊 Total notifications sent: X
   ✅ Push sent to user: ...
   ```
4. **Login as regular user**
5. **Check notifications screen** → Should see "New Fundraising Cause" notification
6. **Check device** (physical device only) → Should receive push notification

Repeat for events and announcements.

## 🎯 What's Fixed

| Feature | Before | After |
|---------|--------|-------|
| Announcements | ❌ Broken (missing DB function) | ✅ Working |
| Causes | ❌ Broken (manual insert failed) | ✅ Working |
| Events | ❌ Broken (manual insert failed) | ✅ Working |
| In-App Notifications | ❌ Not appearing | ✅ Appearing |
| Push Notifications | ❌ Not sent | ✅ Sent |
| User Settings | ❌ Not respected | ✅ Respected |

## 🔍 Quick Verification Checklist

- [ ] Database functions created (Step 1)
- [ ] Functions verified to exist (Step 2)
- [ ] App code deployed (Step 3)
- [ ] Test cause created successfully
- [ ] In-app notification appears
- [ ] Push notification received (on physical device)
- [ ] Test event created successfully
- [ ] In-app notification appears
- [ ] Push notification received (on physical device)
- [ ] Test announcement created successfully
- [ ] In-app notification appears
- [ ] Push notification received (on physical device)
- [ ] Notification settings toggle working

## 🐛 Quick Troubleshooting

### No in-app notifications?
```sql
-- Check if notifications were created
SELECT * FROM notifications 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```
If empty → RPC function not executing, check Step 1

### No push notifications?
- ✅ Are you on a **physical device**? (Not emulator)
- ✅ Does user have push_token?
  ```sql
  SELECT id, email, push_token FROM users WHERE id = 'your-user-id';
  ```
- ✅ Is FIREBASE_SERVICE_ACCOUNT configured in Supabase?
- ✅ Are app notifications enabled in device settings?

### RPC function errors?
If you see "function does not exist":
1. Re-run Step 1 SQL in Supabase SQL Editor
2. Make sure you're in the correct project
3. Check function exists with Step 2 verification

## 📚 Full Documentation

- **Detailed explanation**: See `WHAT_WAS_WRONG.md`
- **Complete deployment guide**: See `NOTIFICATION_FIX_DEPLOYMENT.md`
- **Database migration file**: See `supabase/migrations/create_notification_functions.sql`

## ✨ Done!

Your notification system is now fully functional:
- ✅ In-app notifications for causes, events, and announcements
- ✅ Push notifications to physical devices
- ✅ User notification preferences respected
- ✅ Consistent implementation across all notification types

---

**Total time: ~5 minutes** | **Difficulty: Easy** | **Risk: Low** (only adding missing functions)

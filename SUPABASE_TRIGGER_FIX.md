# Supabase Trigger Fix for SDK 54

## Problem Summary

After upgrading to SDK 54, user signup is failing because:

1. **Metadata not reaching database**: SDK 54 users only have default Supabase fields in `raw_user_meta_data`, not custom fields like `full_name`, `phone`, `location`
2. **Trigger has wrong column names**: The trigger tries to insert into `email_enabled` and `push_enabled` columns that don't exist. The correct columns are:
   - `circle_requests_enabled`
   - `announcements_enabled`
   - `opportunities_enabled`
   - `messages_enabled`
   - `opportunity_proposals_enabled`

## Solution

### Step 1: Update Supabase Client (Already Done ✅)

The `services/supabase.ts` has been updated to:
- Use SecureStore instead of AsyncStorage
- Enable PKCE flow explicitly
- This ensures SDK 54 compatibility for metadata serialization

### Step 2: Fix Database Trigger

Run the SQL in `supabase/triggers/handle_new_user.sql` in your Supabase SQL Editor.

**Key fixes:**
- ✅ Defensive coding: Uses `COALESCE` to handle missing `raw_user_meta_data`
- ✅ Correct column names: Uses `circle_requests_enabled`, `announcements_enabled`, etc.
- ✅ Graceful fallbacks: Handles missing metadata fields without crashing
- ✅ Prevents duplicates: Uses `ON CONFLICT DO NOTHING`

### Step 3: Verify Metadata is Being Sent

The debug logging in `contexts/AuthContext.tsx` will show:
- What metadata is being sent
- What metadata is received from Supabase
- Warnings if fields are missing

## Testing

1. **Test signup** and check console logs for:
   ```
   [AUTH] 📤 Metadata being sent to Supabase:
   [AUTH] 📥 Received metadata fields:
   ```

2. **Check database** after signup:
   ```sql
   -- Check if user was created
   SELECT id, email, full_name, phone, location 
   FROM public.users 
   ORDER BY created_at DESC LIMIT 1;
   
   -- Check if notification settings were created
   SELECT * FROM public.user_notification_settings 
   WHERE user_id = '<new-user-id>';
   ```

3. **Verify metadata in auth.users**:
   ```sql
   SELECT id, email, raw_user_meta_data 
   FROM auth.users 
   ORDER BY created_at DESC LIMIT 1;
   ```

## Expected Results

### Before Fix:
- ❌ `raw_user_meta_data` only contains: `{"sub":"...","email":"...","email_verified":true}`
- ❌ Trigger fails with: `record 'new' has no field 'raw_user_meta_data'`
- ❌ User profile not created in `public.users`
- ❌ Notification settings not created

### After Fix:
- ✅ `raw_user_meta_data` contains: `{"full_name":"...","phone":"...","location":"..."}`
- ✅ Trigger executes successfully
- ✅ User profile created in `public.users` with all fields
- ✅ Notification settings created with correct column names

## Debugging

If metadata is still missing after applying the fix:

1. **Check SecureStore is working**: Verify `expo-secure-store` is installed and working
2. **Check PKCE flow**: Verify `flowType: 'pkce'` is set in `supabase.ts`
3. **Check console logs**: Look for warnings about missing metadata
4. **Check Supabase logs**: Go to Supabase Dashboard > Logs > Auth Logs to see what's being received

## Related Files

- `services/supabase.ts` - Supabase client configuration (SecureStore + PKCE)
- `contexts/AuthContext.tsx` - Signup function with debug logging
- `supabase/triggers/handle_new_user.sql` - Corrected database trigger


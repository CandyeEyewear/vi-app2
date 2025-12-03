# Event Image Loading Fix - Summary

## Problem
Images were not loading properly in events (and potentially causes as well).

## Root Cause Analysis
The issue was related to how image URLs were being stored and retrieved from the Supabase storage bucket. There were several potential problems:

1. **Image URLs might be stored as relative paths** instead of absolute URLs
2. **Storage bucket might not be publicly accessible**
3. **Missing proper URL formatting** when transforming database rows to objects
4. **Lack of error logging** to diagnose issues

## Changes Made

### 1. Created Storage Helper Utilities (`utils/storageHelpers.ts`)
- **Purpose**: Centralized storage URL formatting and validation
- **Key Functions**:
  - `formatStorageUrl()`: Ensures image URLs are properly formatted (handles both relative paths and absolute URLs)
  - `getPublicUrl()`: Gets public URL from storage path
  - `verifyStorageBucket()`: Checks if bucket exists and is public
  - `testImageUrl()`: Tests if an image URL is accessible

### 2. Updated Events Service (`services/eventsService.ts`)
- Added `formatStorageUrl()` to transform database image URLs
- Added comprehensive logging to track image URLs through the pipeline
- Logs show:
  - Raw `image_url` from database
  - Processed `imageUrl` after formatting

### 3. Updated Causes Service (`services/causesService.ts`)
- Applied the same `formatStorageUrl()` fix to causes
- Ensures consistency across all image-handling services

### 4. Enhanced Event Components with Better Error Handling

#### EventCard (`components/cards/EventCard.tsx`)
- Added logging when images start/end loading
- Added detailed error logging with native event info
- Shows exactly which URL failed to load

#### Event Detail Screen (`app/events/[id].tsx`)
- Same logging enhancements as EventCard
- Helps diagnose issues in the detail view

### 5. Enhanced Admin Event Forms

#### Create Event (`app/(admin)/events/create.tsx`)
- Added logging after image upload
- Shows the path and public URL of uploaded images

#### Edit Event (`app/(admin)/events/edit/[id].tsx`)
- Same logging enhancements as create form

### 6. Created Verification Script (`scripts/verify-storage.ts`)
- Checks if the `post-images` bucket exists
- Verifies if the bucket is public
- Provides instructions if issues are found

## How the Fix Works

### Before:
```typescript
// Database has: "events/user123/12345.jpg" (relative path)
imageUrl: row.image_url  // → "events/user123/12345.jpg"
// Image fails to load because it's not a complete URL
```

### After:
```typescript
// Database has: "events/user123/12345.jpg" (relative path)
imageUrl: formatStorageUrl(row.image_url)
// → "https://drshtkrhszeaxpmectex.supabase.co/storage/v1/object/public/post-images/events/user123/12345.jpg"
// Image loads successfully!
```

## What To Do Next

### 1. Check Storage Bucket Configuration

Run the verification script:
```bash
npx ts-node scripts/verify-storage.ts
```

If the bucket doesn't exist or isn't public, follow these steps:

**In Supabase Dashboard:**
1. Go to **Storage** section
2. Check if `post-images` bucket exists
   - If not, create it
3. Click on the bucket
4. Go to **Configuration** or **Settings**
5. Enable **"Public bucket"** option
6. Save changes

### 2. Test the Fix

1. **Clear any cached data** (restart the app/clear browser cache)
2. **Check console logs** - You should now see detailed logging:
   ```
   [transformEvent] Event: My Event Title
     - Raw image_url: events/user123/12345.jpg
     - Processed imageUrl: https://...full-url...
   [EventCard] Image load started: https://...full-url...
   [EventCard] Image load ended successfully: https://...full-url...
   ```
3. **If images still don't load**, check the console for error messages

### 3. Common Issues and Solutions

#### Issue: "Bucket not found"
**Solution:** Create the `post-images` bucket in Supabase dashboard

#### Issue: "Bucket is private"
**Solution:** Make the bucket public in Supabase settings

#### Issue: Images load in admin but not in events list
**Solution:** Check if the image URLs in the database are correct
```sql
SELECT id, title, image_url FROM events WHERE image_url IS NOT NULL LIMIT 10;
```

#### Issue: CORS errors in browser console
**Solution:** This is usually fixed by making the bucket public. If it persists:
1. Check Supabase CORS settings
2. Verify the bucket policy allows public access

#### Issue: "404 Not Found" for images
**Solution:** 
1. Verify the file actually exists in storage (check Supabase dashboard)
2. Verify the path in the database matches the actual file path
3. Check if the file was uploaded successfully (see upload logs)

### 4. For Existing Events with Images

If you have existing events with images that aren't loading:

1. **Check the database**: Look at the `image_url` column in the `events` table
2. **If URLs are incomplete**: The fix should automatically handle this
3. **If URLs are NULL**: Re-upload the images through the admin panel

### 5. Monitor and Verify

After deploying this fix:
1. Upload a new event with an image
2. Check the console logs to see the upload process
3. Verify the image shows in both the list and detail views
4. Check a few existing events to ensure their images load

## Technical Details

### URL Format
The helper ensures URLs follow this format:
```
https://{supabase-project}.supabase.co/storage/v1/object/public/{bucket}/{path}
```

### Supported Input Formats
- Relative paths: `events/123/image.jpg`
- Paths with leading slash: `/events/123/image.jpg`
- Complete URLs: `https://...` (passed through unchanged)

### Storage Bucket
- Name: `post-images`
- Must be: **Public**
- Contains: Events, causes, opportunities, and other images

## Files Modified

1. ✅ `utils/storageHelpers.ts` (new)
2. ✅ `scripts/verify-storage.ts` (new)
3. ✅ `services/eventsService.ts`
4. ✅ `services/causesService.ts`
5. ✅ `components/cards/EventCard.tsx`
6. ✅ `app/events/[id].tsx`
7. ✅ `app/(admin)/events/create.tsx`
8. ✅ `app/(admin)/events/edit/[id].tsx`

## Testing Checklist

- [ ] Run storage verification script
- [ ] Verify bucket is public
- [ ] Upload new event with image
- [ ] Check image loads in events list
- [ ] Check image loads in event detail
- [ ] Check existing events with images
- [ ] Test on mobile and web
- [ ] Check console for any errors

## Need Help?

If images are still not loading after following these steps:
1. Check the console logs for detailed error messages
2. Run the verification script to diagnose bucket issues
3. Check the Supabase dashboard to verify files exist
4. Ensure the bucket is public
5. Try uploading a new image and check the logs

The detailed logging added throughout the codebase will help pinpoint exactly where the issue occurs.

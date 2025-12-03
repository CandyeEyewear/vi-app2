# Mobile Web Image Loading Fix

## Issue
Images not loading in events on mobile web browsers.

## Mobile Web-Specific Considerations

### 1. CORS (Cross-Origin Resource Sharing)
Mobile web browsers strictly enforce CORS policies. If images aren't loading:
- The Supabase storage bucket MUST be public
- CORS headers must be properly configured

### 2. Browser Caching
Mobile browsers aggressively cache images. If you see old/broken images:
- Clear browser cache
- Use incognito/private browsing mode
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### 3. Network Security
- Images must be served over HTTPS (Supabase handles this)
- Mixed content (HTTP images on HTTPS site) will be blocked

### 4. Image Format Support
- All modern mobile browsers support JPEG, PNG, WebP
- Check the uploaded image format is valid

## Quick Fix Steps for Mobile Web

### Step 1: Verify Storage Bucket is Public

**In Supabase Dashboard:**
1. Go to **Storage** → **Buckets**
2. Find `post-images` bucket
3. Click on it
4. Go to **Configuration** tab
5. Ensure **"Public bucket"** is enabled
6. Click **"Save"**

### Step 2: Check CORS Configuration

**In Supabase Dashboard:**
1. Go to **Storage** → **Policies**
2. Ensure there's a policy for public access
3. Or go to **Settings** → **API** → **CORS**
4. Add your domain if not already there:
   - `https://vibe.volunteersinc.org`
   - Or `*` for all domains (less secure but works for testing)

### Step 3: Test with Browser DevTools

**On Mobile Chrome:**
1. Open your app
2. Menu → **More tools** → **Remote devices** (on desktop)
3. Connect your phone
4. Open **DevTools** → **Console** tab
5. Look for these logs:
   ```
   [transformEvent] Event: Event Name
     - Raw image_url: events/123/image.jpg
     - Processed imageUrl: https://...
   [EventCard] Image load started: https://...
   ```
6. Check **Network** tab for failed image requests
7. Look for errors like:
   - `CORS policy` errors
   - `404 Not Found` 
   - `403 Forbidden`

**On Mobile Safari:**
1. iPhone Settings → Safari → Advanced → **Web Inspector**
2. Connect to Mac
3. Safari on Mac → Develop → [Your iPhone]
4. Select your app
5. Check Console and Network tabs

### Step 4: Clear Cache and Test

**Mobile Chrome:**
1. Settings → Privacy → Clear browsing data
2. Select "Cached images and files"
3. Clear data
4. Reload the app

**Mobile Safari:**
1. Settings → Safari → Clear History and Website Data
2. Confirm
3. Reload the app

## Common Mobile Web Issues

### Issue 1: "Failed to load resource: CORS policy"

**Solution:**
```sql
-- In Supabase SQL Editor, ensure RLS is configured:
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Add policy for public read access
CREATE POLICY "Public events are viewable by everyone"
ON events FOR SELECT
USING (status = 'upcoming' OR status = 'ongoing');
```

Then ensure storage bucket has CORS enabled in Supabase Settings.

### Issue 2: Images show as broken icon

**Check:**
1. Image URL in console logs
2. Copy the URL and paste in new browser tab
3. If it loads there but not in app → caching issue
4. If it doesn't load anywhere → storage/permissions issue

### Issue 3: Images load on desktop but not mobile

**Check:**
1. Mobile browser cache (clear it)
2. Mobile data vs WiFi (network restrictions)
3. Browser compatibility (test in different browser)

### Issue 4: Placeholder shows but real image never loads

**Check console for:**
- Network errors
- The actual URL being attempted
- HTTP status codes in Network tab

## Testing Checklist for Mobile Web

- [ ] Clear browser cache
- [ ] Test in Chrome mobile
- [ ] Test in Safari mobile (iOS)
- [ ] Test on WiFi
- [ ] Test on mobile data
- [ ] Check DevTools Console for errors
- [ ] Check DevTools Network tab for failed requests
- [ ] Verify image URLs start with `https://`
- [ ] Copy image URL to new tab - does it load?
- [ ] Test with newly uploaded image
- [ ] Test with existing event images

## Debugging Commands

### Test Image URL in Browser Console
```javascript
// Run this in browser console on your app
const testImageUrl = 'https://drshtkrhszeaxpmectex.supabase.co/storage/v1/object/public/post-images/events/123/test.jpg';

fetch(testImageUrl, { method: 'HEAD' })
  .then(response => {
    console.log('Image accessible:', response.ok);
    console.log('Status:', response.status);
    console.log('Headers:', [...response.headers.entries()]);
  })
  .catch(error => {
    console.error('Image fetch failed:', error);
  });
```

### Check if Bucket is Accessible
```javascript
// Test in browser console
fetch('https://drshtkrhszeaxpmectex.supabase.co/storage/v1/bucket/post-images')
  .then(r => r.json())
  .then(data => console.log('Bucket info:', data))
  .catch(err => console.error('Bucket access failed:', err));
```

## Additional Mobile Web Optimizations

### 1. Add Image Loading Attribute
For better performance on mobile web, we can add `loading="lazy"`:

```typescript
<Image
  source={{ uri: event.imageUrl }}
  style={styles.image}
  loading="lazy" // This is web-only
  resizeMode="cover"
/>
```

### 2. Add Referrer Policy
```typescript
<Image
  source={{ uri: event.imageUrl }}
  referrerPolicy="no-referrer" // Helps with CORS
/>
```

### 3. Handle Slow Networks
Mobile networks can be slow. The loading indicator should help, but you can also:
- Show low-res placeholder first
- Add retry logic for failed loads
- Show "slow network" warning after X seconds

## Environment-Specific URLs

Make sure your `.env` or environment variables are set correctly:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://drshtkrhszeaxpmectex.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-key-here
```

## If Nothing Works

1. **Verify the bucket exists and is public** (most common issue)
2. **Check Supabase dashboard** → Storage → post-images → Files
   - Are the image files actually there?
   - Can you open them by clicking?
3. **Test upload flow:**
   - Create new event with image
   - Check logs during upload
   - Verify file appears in Supabase storage
   - Check database to confirm URL was saved
4. **Network Inspector:**
   - Look at the actual HTTP request/response
   - Check response headers
   - Look for redirects or errors

## Success Indicators

When everything is working, you should see:

✅ Console logs showing proper image URLs  
✅ Images load in events list  
✅ Images load in event details  
✅ No CORS errors in console  
✅ No 404/403 errors in Network tab  
✅ Images load on both WiFi and mobile data  

## Need More Help?

If images still don't load:
1. Share the console logs (especially the transformed URLs)
2. Share any Network tab errors
3. Confirm the bucket is public in Supabase dashboard
4. Try uploading a new image and share the upload logs

# Quick Debug Guide - Event Images Not Loading (Mobile Web)

## 🚀 Quick Start

### 1. Open Browser DevTools on Mobile
- **Chrome Mobile**: Connect to desktop → Chrome DevTools → Remote Devices
- **Safari iOS**: iPhone Settings → Safari → Advanced → Web Inspector → Connect to Mac

### 2. Check Console Logs
You should see these logs when viewing events:
```
[EventCard: Event Name] Image Debug Info
  URL: https://drshtkrhszeaxpmectex.supabase.co/storage/...
  Protocol: HTTPS ✅
  Supabase URL: ✅
  Bucket: post-images
```

### 3. Look for Errors
Common error messages:
- ❌ `CORS policy` → Bucket not public or CORS not configured
- ❌ `404 Not Found` → File doesn't exist in storage
- ❌ `403 Forbidden` → Permission issue, bucket not public

### 4. Test Image URL Directly
1. Find the image URL in console logs
2. Copy it
3. Paste in new browser tab
4. If it loads there but not in app → **caching issue**
5. If it doesn't load anywhere → **storage/permission issue**

## 🔍 Advanced Debugging (Browser Console)

The app now exposes debugging tools. In browser console, run:

```javascript
// Check everything
window.imageDebug.runDiagnostics()

// Test specific image
window.imageDebug.runDiagnostics('https://your-image-url.jpg')

// Test storage configuration
window.imageDebug.testStorage()

// Check browser cache
window.imageDebug.checkCache()
```

## 🛠️ Most Common Fix

**99% of the time, the issue is that the storage bucket is not public.**

### Fix it:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Storage** → **Buckets**
4. Click on `post-images` bucket
5. Click **Configuration** tab
6. Toggle **"Public bucket"** to ON
7. Click **Save**
8. Clear browser cache
9. Reload app

## 📋 Quick Checklist

- [ ] Storage bucket `post-images` exists
- [ ] Bucket is set to **Public**
- [ ] Image files are actually uploaded (check Supabase Storage browser)
- [ ] Image URLs in database start with `https://`
- [ ] Browser cache cleared
- [ ] No CORS errors in console
- [ ] No 404/403 errors in Network tab

## 🆘 Still Not Working?

### Check These:

1. **Database has correct URLs?**
   ```sql
   SELECT id, title, image_url 
   FROM events 
   WHERE image_url IS NOT NULL 
   LIMIT 5;
   ```

2. **Files exist in storage?**
   - Go to Supabase Dashboard → Storage → post-images
   - Browse the folders
   - Can you see and open the images?

3. **Network tab shows what?**
   - Open DevTools → Network tab
   - Filter by "Img"
   - Refresh page
   - Click on failed image requests
   - Check status code and error

4. **Try uploading new image**
   - Create/edit an event
   - Upload an image
   - Watch console logs
   - Check if it saves to storage
   - Check if URL saves to database

## 💡 Pro Tips

### Clear Cache Properly
- **Chrome Mobile**: Settings → Privacy → Clear browsing data → Cached images
- **Safari iOS**: Settings → Safari → Clear History and Website Data
- **Or use Incognito/Private mode**

### Test on Different Networks
- Try WiFi vs mobile data
- Some networks block certain content

### Check Image Format
- Ensure images are JPEG, PNG, or WebP
- Avoid unusual formats

### Check Image Size
- Very large images (>10MB) might timeout
- Compress images if needed

## 📞 Get Help

If still stuck, share in your report:
1. Console logs (especially image URLs)
2. Network tab errors (screenshots)
3. Whether bucket is public (screenshot from Supabase)
4. Whether files exist in storage
5. Whether new uploads work

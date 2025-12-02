# 🗺️ Google Maps API Setup Guide

## Overview
This app uses Google Maps Geocoding API to convert location names into GPS coordinates for opportunities, events, and causes.

## ✅ Changes Made

### 1. API Key Configuration
- ✅ Created `.env.example` with Google Maps API key placeholders
- ✅ Added Android Google Maps configuration to `app.config.js`
- ✅ Standardized debounce timing to 800ms across all screens

### 2. Debounce Timing Updates
All geocoding now uses a consistent 800ms debounce delay:
- `app/create-opportunity.tsx` - Changed from 500ms → 800ms
- `app/edit-opportunity/[id].tsx` - Changed from 500ms → 800ms  
- `app/(admin)/events/create.tsx` - Changed from 1000ms → 800ms
- `app/(admin)/events/edit/[id].tsx` - Changed from 1000ms → 800ms

## 🚀 Setup Instructions

### Step 1: Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Geocoding API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Geocoding API"
   - Click "Enable"
4. Create credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy your API key

### Step 2: Configure API Key Restrictions (Recommended)

For security, restrict your API key:

1. Click on your API key in the Credentials page
2. Under "API restrictions":
   - Select "Restrict key"
   - Choose "Geocoding API" from the list
3. Under "Application restrictions" (for production):
   - **For Android**: Add your package name: `org.volunteersinc.vibe`
   - **For iOS**: Add your bundle ID: `org.volunteersinc.vibe`
4. Save changes

### Step 3: Add API Key to Your Project

#### For Local Development:

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your API key:
   ```env
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
   GOOGLE_MAPS_ANDROID_API_KEY=your_actual_api_key_here
   ```

3. Restart your Expo development server:
   ```bash
   # Stop current server (Ctrl+C), then:
   npx expo start --clear
   ```

#### For EAS Builds:

Set the API keys as EAS secrets:

```bash
# Set the geocoding API key
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value your_actual_api_key_here

# Set the Android Maps API key
eas secret:create --scope project --name GOOGLE_MAPS_ANDROID_API_KEY --value your_actual_api_key_here
```

## 🧪 Testing the Geocoding

### Test Locations:
Try entering these locations to verify geocoding works:

- ✅ **Kingston, Jamaica** → Should return coordinates near 18.0179° N, 76.8099° W
- ✅ **Devon House, Kingston** → Should return specific coordinates and formatted address
- ✅ **New York, USA** → Should return coordinates near 40.7128° N, 74.0060° W
- ❌ **asdfghjkl** → Should show "Location not found" error

### What to Look For:

1. **Auto-geocoding**: Type a location and wait 800ms - it should automatically fetch coordinates
2. **Location suggestions**: A green box should appear with formatted address and lat/long
3. **Auto-populated Map Link**: After selecting a location, the Google Maps link should auto-fill
4. **Success indicators**: Green checkmark with "Location confirmed" message

### Debug Logs:
Watch the console for these logs:
```
[GEOCODING] Requesting coordinates for: Kingston, Jamaica
[GEOCODING] Response status: OK
[GEOCODING] ✅ Success: { location, latitude, longitude, formattedAddress }
```

## 🐛 Troubleshooting

### Error: "Geocoding service not configured"
**Cause**: API key is not set or not found  
**Fix**: 
1. Make sure `.env` file exists in project root
2. Verify `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is set correctly
3. Restart Expo dev server with `--clear` flag

### Error: "API request denied"
**Cause**: API key restrictions or invalid key  
**Fix**:
1. Check if Geocoding API is enabled in Google Cloud Console
2. Verify API key restrictions allow your app's package name
3. For development, temporarily remove all restrictions to test

### Error: "Location not found"
**Cause**: User entered invalid location or geocoding returned no results  
**Fix**: This is normal - try a more specific location (e.g., "Kingston, Jamaica" instead of "Kingston")

### No Autocomplete/Suggestions
**Cause**: Typing too fast or network issues  
**Fix**: 
1. Wait 800ms after typing stops
2. Check internet connection
3. Verify API key is working (check console logs)

## 📊 API Usage & Billing

- **Geocoding API** costs $5 per 1,000 requests (after first 40,000/month free)
- **Best practices to reduce costs**:
  - Debounced requests (✅ already implemented at 800ms)
  - Cache results (consider implementing if high usage)
  - Use Place Autocomplete for predictions instead of full geocoding

Monitor usage at: [Google Cloud Console Billing](https://console.cloud.google.com/billing)

## 🔒 Security Notes

1. ✅ `.env` is gitignored - never commit API keys to Git
2. ✅ Use separate API keys for development and production
3. ✅ Set up API key restrictions in Google Cloud Console
4. ✅ For production builds, use EAS secrets instead of local .env
5. ⚠️ Monitor API usage to detect unusual activity

## 📚 Additional Resources

- [Google Maps Geocoding API Docs](https://developers.google.com/maps/documentation/geocoding)
- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- [EAS Secrets Documentation](https://docs.expo.dev/build-reference/variables/)

## 🎯 What's Still Missing

**⚠️ Causes don't have location/geocoding yet**
- Causes (create & edit) have no location field
- Consider adding location support similar to opportunities and events
- Would allow causes to be displayed on a map view

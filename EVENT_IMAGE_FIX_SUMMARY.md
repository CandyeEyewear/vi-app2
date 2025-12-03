# Event Poster Image Loading Fix

## Problem
Event poster images were appearing to fail when loading because there was no error handling on the Image components. When an image URL failed to load, it would just show a blank/broken image instead of gracefully falling back to a placeholder.

## Root Cause
The `EventCard` and `SharedEventCard` components were missing error handling callbacks on their Image components:
- No `onError` handler to detect load failures
- No `onLoadStart` / `onLoadEnd` handlers to track loading state
- No fallback UI when images fail to load

This contrasted with the event detail screen (`app/events/[id].tsx`) which had proper error handling implemented.

## Solution
Added comprehensive image error handling to both components:

### 1. EventCard Component (`components/cards/EventCard.tsx`)
**Changes:**
- Added state variables: `imageError` and `imageLoading`
- Added `ActivityIndicator` import for loading state
- Updated Image component with:
  - `onLoadStart` - Sets loading state to true
  - `onLoadEnd` - Sets loading state to false
  - `onError` - Sets error state and stops loading
- Added loading overlay with spinner while image loads
- Added fallback to colorful emoji placeholder when image fails
- Added `imageLoadingOverlay` style for the loading state

### 2. SharedEventCard Component (`components/SharedEventCard.tsx`)
**Changes:**
- Added state variables: `imageError` and `imageLoading`
- Added `ActivityIndicator` import for loading state
- Updated Image component with same error handlers as EventCard
- Added `imageContainer`, `imageLoadingOverlay`, `imagePlaceholder`, and `placeholderEmoji` styles
- Graceful fallback to category emoji when images fail to load

## Benefits
1. **Better UX**: Users see a nice emoji placeholder instead of a broken image
2. **Loading feedback**: Small spinner shows while image is loading
3. **Consistency**: All event image displays now handle errors the same way
4. **Accessibility**: Failed images don't break the UI or confuse users
5. **Professional appearance**: No more broken/failed image states

## Technical Details
The fix uses React's `useState` hook to track image loading and error states:

```typescript
const [imageError, setImageError] = useState(false);
const [imageLoading, setImageLoading] = useState(true);
```

The Image component now includes proper lifecycle callbacks:
```typescript
<Image
  source={{ uri: event.imageUrl }}
  style={styles.image}
  resizeMode="cover"
  onLoadStart={() => setImageLoading(true)}
  onLoadEnd={() => setImageLoading(false)}
  onError={() => {
    setImageError(true);
    setImageLoading(false);
  }}
/>
```

## Files Modified
1. `/workspace/components/cards/EventCard.tsx`
2. `/workspace/components/SharedEventCard.tsx`

## Testing
- Event images that load successfully will display normally
- Images that fail will show a colorful placeholder with category emoji
- Loading states show a subtle spinner overlay
- All existing functionality remains intact

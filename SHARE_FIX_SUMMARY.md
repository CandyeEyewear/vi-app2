# Share to Feed - Fix Summary

## Problem
Users were unable to share causes and events to the feed. Only opportunities were working correctly.

## Root Cause
The share functionality was implemented in the backend (`FeedContext.tsx`) with functions `shareCauseToFeed`, `shareEventToFeed`, and `shareOpportunityToFeed`, but the feed display logic was incomplete:

1. **Missing Rendering**: `FeedPostCard.tsx` only rendered `SharedOpportunityCard` but not `SharedCauseCard` or `SharedEventCard`
2. **Missing Data Loading**: The `loadFeed()` function only fetched opportunity data for existing posts, not cause or event data
3. **Missing Real-time Updates**: The real-time subscription handler only fetched opportunity data for new posts, not cause or event data
4. **Missing Field Mapping**: The Post objects weren't including `causeId` and `eventId` fields when loaded from the database

## Changes Made

### 1. FeedPostCard.tsx
Added rendering for shared causes and events:

```typescript
{/* NEW: Render Shared Cause if this post references a cause */}
{post.cause && !post.sharedPost && (
  <SharedCauseCard cause={post.cause} />
)}

{/* NEW: Render Shared Event if this post references an event */}
{post.event && !post.sharedPost && (
  <SharedEventCard event={post.event} />
)}
```

Also updated the media rendering condition to exclude causes and events:
```typescript
{!post.sharedPost && !post.opportunity && !post.cause && !post.event && post.mediaUrls...
```

### 2. FeedContext.tsx - loadFeed() Function

#### Added causeId and eventId to Post objects:
```typescript
causeId: post.cause_id,
eventId: post.event_id,
```

#### Added cause data fetching:
```typescript
// Fetch causes for posts that reference them
const postsWithCauses = await Promise.all(
  postsWithOpportunities.map(async (post) => {
    if (post.causeId) {
      // Fetch and transform cause data
      return { ...post, cause };
    }
    return post;
  })
);
```

#### Added event data fetching:
```typescript
// Fetch events for posts that reference them
const postsWithEvents = await Promise.all(
  postsWithCauses.map(async (post) => {
    if (post.eventId) {
      // Fetch and transform event data
      return { ...post, event };
    }
    return post;
  })
);
```

#### Updated the shared post mapping:
Changed from `postsWithOpportunities` to `postsWithEvents` to include all loaded data.

### 3. FeedContext.tsx - Real-time Subscriptions

#### Added causeId and eventId to newPost object:
```typescript
causeId: newPostData.cause_id || undefined,
eventId: newPostData.event_id || undefined,
```

#### Added cause data fetching in real-time handler:
```typescript
// Fetch cause data if post references a cause
if (newPostData.cause_id) {
  console.log('[FEED] 💝 New post with cause, fetching cause data...');
  // Fetch and attach cause data to newPost
}
```

#### Added event data fetching in real-time handler:
```typescript
// Fetch event data if post references an event
if (newPostData.event_id) {
  console.log('[FEED] 🎉 New post with event, fetching event data...');
  // Fetch and attach event data to newPost
}
```

## Files Modified

1. `/workspace/components/cards/FeedPostCard.tsx`
   - Added `SharedCauseCard` and `SharedEventCard` rendering
   - Updated media rendering condition

2. `/workspace/contexts/FeedContext.tsx`
   - Added `causeId` and `eventId` to Post object creation
   - Added cause and event data fetching in `loadFeed()`
   - Added cause and event data fetching in real-time handler

## Testing

To verify the fix works:

1. Navigate to a cause (e.g., `/causes/[id]`)
2. Click the share button
3. Add an optional comment
4. Select visibility (General Feed or My Circle)
5. Click "Share to Feed"
6. Navigate to the feed
7. Verify the shared cause appears with full details

Repeat for events:
1. Navigate to an event (e.g., `/events/[id]`)
2. Follow the same steps

## Expected Behavior

After these changes:
- ✅ Users can share causes to feed with optional comments
- ✅ Users can share events to feed with optional comments
- ✅ Users can share opportunities to feed (was already working)
- ✅ Shared causes display correctly with image, progress bar, and donation info
- ✅ Shared events display correctly with image, date/time, and location info
- ✅ Shared opportunities display correctly with image, date, and spot info
- ✅ Real-time updates work for all three types
- ✅ Loading existing posts from database works for all three types

## Database Requirements

The `posts` table must have these columns (should already exist):
- `cause_id` (uuid, nullable, foreign key to `causes.id`)
- `event_id` (uuid, nullable, foreign key to `events.id`)
- `opportunity_id` (uuid, nullable, foreign key to `opportunities.id`)

If these columns don't exist, run:
```sql
ALTER TABLE posts 
  ADD COLUMN IF NOT EXISTS cause_id uuid REFERENCES causes(id),
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES events(id),
  ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES opportunities(id);
```

## Related Components

- `ShareCauseModal.tsx` - Modal for sharing causes (already working)
- `ShareEventModal.tsx` - Modal for sharing events (already working)
- `ShareOpportunityModal.tsx` - Modal for sharing opportunities (already working)
- `SharedCauseCard.tsx` - Display component for shared causes (now working)
- `SharedEventCard.tsx` - Display component for shared events (now working)
- `SharedOpportunityCard.tsx` - Display component for shared opportunities (already working)

## Notes

- The share functions (`shareCauseToFeed`, `shareEventToFeed`, `shareOpportunityToFeed`) were already implemented correctly in `FeedContext.tsx`
- The issue was purely in the display/rendering layer
- The TypeScript types (`Post` interface) already included `causeId`, `eventId`, `cause`, and `event` fields
- The fix ensures feature parity across all three shareable content types

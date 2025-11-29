# Share to Feed Debugging Guide

## Issue
User reports: "I am unable to share to feed"

## Components Involved

### 1. Share Modal Components
- `ShareCauseModal.tsx` - Modal for sharing causes
- `ShareEventModal.tsx` - Modal for sharing events  
- `ShareOpportunityModal.tsx` - Modal for sharing opportunities

### 2. Card Components (Trigger Share)
- `CauseCard.tsx` - Has share button that opens ShareCauseModal
- `EventCard.tsx` - Has share button that opens ShareEventModal
- `OpportunityCard.tsx` - Has share button that opens ShareOpportunityModal

### 3. FeedContext Functions
- `shareCauseToFeed()` - Lines 1377-1474
- `shareEventToFeed()` - Lines 1476-1579
- `shareOpportunityToFeed()` - Lines 1271-1375

## Expected Flow

1. User clicks share button on a Cause/Event/Opportunity card
2. ShareModal opens with:
   - Optional comment textarea
   - Visibility selector (General Feed / My Circle)
   - Preview of the item being shared
3. User clicks "Share to Feed" or "Share to Circle" button
4. Modal calls `onShare(comment, visibility)`
5. Card component calls the appropriate FeedContext function:
   - `shareCauseToFeed(causeId, comment, visibility)`
   - `shareEventToFeed(eventId, comment, visibility)`
   - `shareOpportunityToFeed(opportunityId, comment, visibility)`
6. FeedContext creates a post with:
   - `user_id`: current user
   - `text`: optional comment
   - `cause_id`/`event_id`/`opportunity_id`: reference to shared item
   - `media_urls`: image from the item
   - `visibility`: 'public' or 'circle'
7. Post is added to database
8. Post is added optimistically to feed state
9. Success toast shown, modal closes

## Database Schema Requirements

The `posts` table needs these columns:
- `cause_id` (uuid, nullable, foreign key to causes)
- `event_id` (uuid, nullable, foreign key to events)  
- `opportunity_id` (uuid, nullable, foreign key to opportunities)

## Common Issues to Check

### 1. Database Schema
```sql
-- Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'posts' 
  AND column_name IN ('cause_id', 'event_id', 'opportunity_id');
```

### 2. RLS Policies
Check that users have INSERT permission on posts table:
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'posts';
```

### 3. Console Errors
Check browser console for:
- Network errors (4xx/5xx responses)
- JavaScript errors
- Supabase errors

### 4. Toast Messages
Check if error toast appears with message:
- "Failed to share cause/event/opportunity"
- Any custom error message from the API

## Testing Steps

1. **Open Developer Console** (F12)
2. **Navigate** to a cause/event/opportunity
3. **Click Share Button**
4. **Fill out modal** (optional comment + visibility)
5. **Click "Share to Feed"**
6. **Check Console** for:
   - `[FEED] 📤 Sharing cause/event/opportunity to feed: {id}`
   - `[FEED] Creating post with cause/event/opportunity reference...`
   - Success or error messages
7. **Check Network Tab** for:
   - POST to Supabase
   - Response status
   - Response body
8. **Check Feed** to see if post appears

## Code Locations

### FeedContext.tsx (Lines to check)
- **shareCauseToFeed**: Lines 1377-1474
- **shareEventToFeed**: Lines 1476-1579  
- **shareOpportunityToFeed**: Lines 1271-1375

### Key Code Sections

#### Insert Statement (e.g., for Cause)
```typescript
const { data, error } = await supabase
  .from('posts')
  .insert({
    user_id: user.id,
    text: customMessage || '',
    cause_id: causeId,  // ← Foreign key reference
    media_urls: causeData.image_url ? [causeData.image_url] : [],
    media_types: causeData.image_url ? ['image'] : [],
    visibility: visibility,
    likes: [],
    shares: 0,
  })
  .select()
  .single();
```

## Fixes to Try

### Fix 1: Add Missing Columns
If columns don't exist in database:

```sql
ALTER TABLE posts 
  ADD COLUMN cause_id uuid REFERENCES causes(id),
  ADD COLUMN event_id uuid REFERENCES events(id),
  ADD COLUMN opportunity_id uuid REFERENCES opportunities(id);
```

### Fix 2: Update RLS Policies
If INSERT is blocked:

```sql
-- Allow authenticated users to insert posts
CREATE POLICY "Users can insert their own posts"
  ON posts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

### Fix 3: Check for Null Handling
Ensure code handles missing data gracefully:
- What if `causeData.image_url` is null?
- What if user is not authenticated?
- What if visibility is undefined?

### Fix 4: Add Error Handling
Wrap database calls in try-catch and log errors:

```typescript
try {
  const response = await shareCauseToFeed(cause.id, comment, visibility);
  if (!response.success) {
    console.error('Share failed:', response.error);
    // Show user-friendly error
  }
} catch (error) {
  console.error('Share error:', error);
}
```

## Next Steps

1. Run the test steps above
2. Note any errors in console
3. Check database schema
4. Verify RLS policies
5. Test with a minimal example
6. Report findings back for further debugging

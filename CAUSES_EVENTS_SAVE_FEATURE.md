# Causes & Events Save Feature Implementation

## Summary
Added bookmark/save functionality for Causes and Events with the same look and feel as the Opportunities section, including animated filter pills and quick filters.

## Changes Made

### 1. Database Migration
**File:** `supabase/migrations/create_saved_causes_events.sql`
- Created `saved_causes` table with user_id and cause_id
- Created `saved_events` table with user_id and event_id
- Added indexes for performance
- Enabled Row Level Security (RLS)
- Created policies for viewing, saving, and unsaving

### 2. CauseCard Component Updates
**File:** `components/cards/CauseCard.tsx`
- Added `Bookmark` icon import
- Added `isSaved` and `onToggleSave` props
- Added bookmark button with filled/unfilled states
- Grouped share and bookmark buttons in `actionButtons` container
- Updated styles for new button layout

**Visual Changes:**
- Bookmark button appears next to share button on card images
- Filled bookmark when saved, outlined when not saved
- Smooth press animations matching opportunities cards

### 3. EventCard Component Updates
**File:** `components/cards/EventCard.tsx`
- Added `Bookmark` icon import
- Added `isSaved` and `onToggleSave` props
- Added bookmark button with filled/unfilled states
- Grouped share and bookmark buttons in `actionButtons` container
- Updated styles for new button layout

**Visual Changes:**
- Bookmark button appears next to share button on card images
- Filled bookmark when saved, outlined when not saved
- Smooth press animations matching opportunities cards

### 4. CausesList Component Updates
**File:** `components/CausesList.tsx`

**New Imports:**
- `Bookmark`, `TrendingUp`, `Zap` icons
- `supabase` for database operations
- `showToast` for user feedback

**Quick Filters Added:**
- **Trending**: Sorts by most donors
- **Ending Soon**: Shows causes ending within 7 days
- **Saved**: Shows only bookmarked causes

**New State:**
- `savedCauseIds`: Array of saved cause IDs
- `selectedQuickFilter`: Currently selected quick filter

**New Functions:**
- `loadSavedCauseIds()`: Fetches user's saved causes from database
- `handleToggleSave()`: Adds/removes cause from saved list
- `filteredCauses`: Computed property that applies quick filters

**UI Changes:**
- Added quick filter pills after category pills
- Added vertical divider between categories and quick filters
- Pills use same animated style as opportunities
- Shows saved status on each card
- Updates results count based on filters

### 5. EventsList Component Updates
**File:** `components/EventsList.tsx`

**New Imports:**
- `Bookmark`, `TrendingUp`, `Zap` icons
- `supabase` for database operations
- `showToast` for user feedback

**Quick Filters Added:**
- **Featured**: Shows only featured events
- **This Week**: Shows events happening within 7 days
- **Saved**: Shows only bookmarked events

**New State:**
- `savedEventIds`: Array of saved event IDs
- `selectedQuickFilter`: Currently selected quick filter

**New Functions:**
- `loadSavedEventIds()`: Fetches user's saved events from database
- `handleToggleSave()`: Adds/removes event from saved list
- `filteredEvents`: Computed property that applies quick filters

**UI Changes:**
- Added quick filter pills after category pills
- Added vertical divider between categories and quick filters
- Pills use same animated style as opportunities
- Shows saved status on each card
- Updates results count based on filters

## Animated Filter Pill Style

### Visual Design
- **Border radius**: 20 (full pill shape)
- **Padding**: 12px horizontal, 8px vertical
- **Font**: 13px, weight 500 (600 when selected)
- **Colors**: 
  - Unselected: card background with border
  - Selected: primary color with white text

### Animations
- **Scale animation**: Shrinks to 0.95 on press
- **Spring animation**: Bouncy feedback (friction: 3)
- **Background fade**: 200ms color transition
- **Border fade**: Animated border color change

### Features
- Checkmark appears when selected
- Icons for quick filters (TrendingUp, Zap, Bookmark)
- Smooth, polished micro-interactions
- Maintains style consistency with opportunities section

## User Experience

### Save/Bookmark Flow
1. User taps bookmark icon on cause/event card
2. Icon fills with animation
3. Toast notification appears ("Saved for later!" or "Removed from saved")
4. Database updates in background
5. Item appears/disappears from "Saved" filter

### Quick Filter Flow
1. User taps a quick filter pill
2. Pill animates to selected state with checkmark
3. List instantly filters to show matching items
4. Results count updates
5. Can toggle off by tapping again

### Integration with Categories
- Selecting a category deselects quick filters
- Selecting a quick filter resets category to "All"
- Smooth transitions between filter states
- Persistent saved state across app sessions

## Database Schema

### saved_causes Table
```sql
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key -> users)
- cause_id: UUID (Foreign Key -> causes)
- created_at: TIMESTAMP
- UNIQUE(user_id, cause_id)
```

### saved_events Table
```sql
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key -> users)
- event_id: UUID (Foreign Key -> events)
- created_at: TIMESTAMP
- UNIQUE(user_id, event_id)
```

## Testing Checklist

- [ ] Bookmark button appears on cause cards
- [ ] Bookmark button appears on event cards
- [ ] Tapping bookmark saves/unsaves item
- [ ] Toast notifications appear correctly
- [ ] "Saved" filter shows only saved items
- [ ] Quick filters work correctly
- [ ] Category pills still work as expected
- [ ] Animations are smooth and responsive
- [ ] Database operations complete successfully
- [ ] RLS policies enforce user permissions
- [ ] Saved state persists across sessions

## Next Steps

1. Test the database migration
2. Verify all animations work smoothly
3. Test on different screen sizes
4. Ensure data persists correctly
5. Test with multiple users

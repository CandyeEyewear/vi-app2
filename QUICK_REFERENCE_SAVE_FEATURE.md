# Quick Reference: Save Feature for Causes & Events

## What Was Added

### 🎯 Bookmark Buttons on Cards
Both `CauseCard` and `EventCard` now have bookmark buttons that:
- Appear in top-right corner next to share button
- Fill with white when saved, outlined when not saved
- Have smooth press animations
- Show toast notifications on tap

### 🔖 Quick Filter Pills
Added to both `CausesList` and `EventsList`:

**Causes Quick Filters:**
- 📈 **Trending** - Most popular by donor count
- ⚡ **Ending Soon** - Causes ending within 7 days  
- 🔖 **Saved** - Your bookmarked causes

**Events Quick Filters:**
- 📈 **Featured** - Featured events only
- ⚡ **This Week** - Events happening within 7 days
- 🔖 **Saved** - Your bookmarked events

### 💾 Database Tables
- `saved_causes` - Stores user's saved causes
- `saved_events` - Stores user's saved events
- Both with RLS policies for security

## Visual Consistency

All filter pills now match the Opportunities section:
- Same pill shape (borderRadius: 20)
- Same animations (scale, spring, fade)
- Same checkmark icon when selected
- Same color transitions
- Same spacing and layout

## Code Files Changed

1. ✅ `supabase/migrations/create_saved_causes_events.sql` - NEW
2. ✅ `components/cards/CauseCard.tsx` - UPDATED
3. ✅ `components/cards/EventCard.tsx` - UPDATED
4. ✅ `components/CausesList.tsx` - UPDATED
5. ✅ `components/EventsList.tsx` - UPDATED

## Key Functions Added

### CausesList & EventsList
```typescript
loadSavedCauseIds() / loadSavedEventIds()
// Fetches saved items from database

handleToggleSave(item)
// Adds/removes from saved list with toast notification

filteredCauses / filteredEvents
// Computed property that applies quick filters
```

## How It Works

1. **User saves an item**: 
   - Taps bookmark → database insert → state updates → toast shows

2. **User views saved items**:
   - Taps "Saved" filter → list filters instantly → shows only saved items

3. **User unsaves an item**:
   - Taps filled bookmark → database delete → state updates → toast shows

## Database Operations

```typescript
// Save
await supabase.from('saved_causes').insert({
  user_id: user.id,
  cause_id: cause.id,
});

// Unsave  
await supabase.from('saved_causes').delete()
  .eq('user_id', user.id)
  .eq('cause_id', cause.id);

// Load saved IDs
await supabase.from('saved_causes')
  .select('cause_id')
  .eq('user_id', user.id);
```

## UI Components

### Bookmark Button (Both Cards)
```tsx
<Pressable onPress={handleSavePress}>
  <Bookmark 
    size={18} 
    color="#FFFFFF" 
    fill={isSaved ? "#FFFFFF" : "none"}
  />
</Pressable>
```

### Quick Filter Pill
```tsx
<AnimatedFilterChip
  label="Saved"
  isSelected={selectedQuickFilter === 'saved'}
  onPress={() => setSelectedQuickFilter('saved')}
  colors={colors}
/>
```

## User Experience Flow

```
User opens Causes/Events tab
    ↓
Sees category pills + quick filter pills
    ↓
Can filter by category OR quick filter
    ↓
Taps bookmark on a card
    ↓
Item saves to database
    ↓
Toast notification appears
    ↓
Taps "Saved" filter
    ↓
Sees all saved items
```

## Important Notes

- ⚠️ Users must be logged in to save items
- 🔄 Saved state syncs across app sessions
- 🎨 All animations match Opportunities section exactly
- 🔒 RLS policies ensure users only see their own saved items
- 📱 Responsive on all screen sizes

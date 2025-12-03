# Events Quick Fix Guide 🚀
**Priority Issues & Solutions**

---

## 🔴 CRITICAL FIX #1: Hardcoded Colors (30 locations)

### Problem
Colors like `#38B6FF`, `#4CAF50`, etc. are hardcoded throughout the codebase instead of using theme colors.

### Files to Update:
1. `components/cards/EventCard.tsx` - Lines 52-59, 249
2. `components/SharedEventCard.tsx` - Lines 33-41, 134, 151-176
3. `components/EventsList.tsx` - Multiple locations
4. `app/events/[id].tsx` - Multiple locations
5. `app/(admin)/events/` - All screens

### Solution:

#### Step 1: Add to `constants/colors.ts`

```typescript
// Add these new color constants
export const EventCategoryColors = {
  meetup: '#2196F3',
  gala: '#9C27B0',
  fundraiser: '#E91E63',
  workshop: '#FF9800',
  celebration: '#4CAF50',
  networking: '#00BCD4',
  other: '#757575',
};

// Update Colors light/dark with event-specific colors
export const Colors = {
  light: {
    // ... existing colors
    eventFeaturedGold: '#FFD700',
    eventTodayRed: '#FF5722',
    // Or just use existing: star, warning, etc.
  },
  dark: {
    // ... same as light for now
  },
};
```

#### Step 2: Create Shared Category Config

Create new file: `constants/eventCategories.ts`

```typescript
import { EventCategory } from '../types';
import { EventCategoryColors } from './colors';

export const EVENT_CATEGORY_CONFIG: Record<
  EventCategory, 
  { label: string; color: string; emoji: string }
> = {
  meetup: { label: 'Meetup', color: EventCategoryColors.meetup, emoji: '🤝' },
  gala: { label: 'Gala', color: EventCategoryColors.gala, emoji: '✨' },
  fundraiser: { label: 'Fundraiser', color: EventCategoryColors.fundraiser, emoji: '💝' },
  workshop: { label: 'Workshop', color: EventCategoryColors.workshop, emoji: '🛠️' },
  celebration: { label: 'Celebration', color: EventCategoryColors.celebration, emoji: '🎉' },
  networking: { label: 'Networking', color: EventCategoryColors.networking, emoji: '🔗' },
  other: { label: 'Event', color: EventCategoryColors.other, emoji: '📅' },
};

// Optional: Helper function for dark mode adjustment
export function getCategoryColor(category: EventCategory, isDark: boolean): string {
  const baseColor = EVENT_CATEGORY_CONFIG[category].color;
  // Could adjust opacity or hue for dark mode if needed
  return baseColor;
}
```

#### Step 3: Update Components

**Before (EventCard.tsx):**
```typescript
const CATEGORY_CONFIG: Record<EventCategory, { label: string; color: string; emoji: string }> = {
  meetup: { label: 'Meetup', color: '#2196F3', emoji: '🤝' },
  // ... etc
};

export function EventCard({ event, onPress, onRegisterPress }: EventCardProps) {
  const categoryConfig = CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.other;
  // ...
}
```

**After (EventCard.tsx):**
```typescript
import { EVENT_CATEGORY_CONFIG } from '../../constants/eventCategories';

export function EventCard({ event, onPress, onRegisterPress }: EventCardProps) {
  const categoryConfig = EVENT_CATEGORY_CONFIG[event.category] || EVENT_CATEGORY_CONFIG.other;
  // ...
}
```

#### Step 4: Replace Inline Colors

Find and replace in all event files:

```typescript
// OLD → NEW
'#38B6FF' → colors.primary
'#4CAF50' → colors.success  
'#FF9800' → colors.warning
'#F44336' → colors.error
'#FFD700' → colors.star (or add as colors.eventFeaturedGold)
'#FF5722' → colors.destructive (or add as colors.eventTodayRed)
```

**Example Before:**
```typescript
<Text style={[styles.freeText, { color: '#4CAF50' }]}>FREE</Text>
```

**Example After:**
```typescript
<Text style={[styles.freeText, { color: colors.success }]}>FREE</Text>
```

---

## 🔴 CRITICAL FIX #2: SharedEventCard Image Logic

### Problem
Complex nested ternaries make image rendering hard to understand and maintain.

### File: `components/SharedEventCard.tsx` (lines 65-87)

### Solution:

**Before:**
```typescript
{event.imageUrl && !imageError ? (
  <View style={styles.imageContainer}>
    <Image 
      source={{ uri: event.imageUrl }} 
      style={styles.image}
      onLoadStart={() => setImageLoading(true)}
      onLoadEnd={() => setImageLoading(false)}
      onError={() => {
        setImageError(true);
        setImageLoading(false);
      }}
    />
    {imageLoading && (
      <View style={styles.imageLoadingOverlay}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    )}
  </View>
) : event.imageUrl ? (
  <View style={[styles.imagePlaceholder, { backgroundColor: categoryConfig.color }]}>
    <Text style={styles.placeholderEmoji}>{categoryConfig.emoji}</Text>
  </View>
) : null}
```

**After:**
```typescript
// Add helper function in component
const renderEventImage = () => {
  // No image URL provided
  if (!event.imageUrl) {
    return null;
  }

  // Image failed to load - show placeholder
  if (imageError) {
    return (
      <View style={[styles.imagePlaceholder, { backgroundColor: categoryConfig.color }]}>
        <Text style={styles.placeholderEmoji}>{categoryConfig.emoji}</Text>
      </View>
    );
  }

  // Show image with loading state
  return (
    <View style={styles.imageContainer}>
      <Image 
        source={{ uri: event.imageUrl }} 
        style={styles.image}
        onLoadStart={() => setImageLoading(true)}
        onLoadEnd={() => setImageLoading(false)}
        onError={() => {
          setImageError(true);
          setImageLoading(false);
        }}
      />
      {imageLoading && (
        <View style={styles.imageLoadingOverlay}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
    </View>
  );
};

// In JSX:
return (
  <AnimatedPressable ...>
    {renderEventImage()}
    {/* rest of component */}
  </AnimatedPressable>
);
```

---

## 🟡 MEDIUM FIX #1: Add Featured Badge to Event Detail Screen

### Problem
Featured events show badge in cards but not on detail screen.

### File: `app/events/[id].tsx`

### Solution:

Add after the category badge (around line 306):

```typescript
{/* Category Badge */}
<View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color }]}>
  <Text style={[styles.categoryBadgeText, { color: colors.textOnPrimary }]}>
    {categoryConfig.emoji} {categoryConfig.label}
  </Text>
</View>

{/* Featured Badge - ADD THIS */}
{event.isFeatured && (
  <View style={[styles.featuredBadge, { backgroundColor: colors.star || '#FFD700' }]}>
    <Star size={14} color="#000" fill="#000" />
    <Text style={[styles.featuredText, { color: '#000' }]}>Featured</Text>
  </View>
)}
```

Add styles:

```typescript
featuredBadge: {
  position: 'absolute',
  top: Spacing.lg,
  right: Spacing.lg,
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 20,
  gap: 4,
  ...Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    android: {
      elevation: 4,
    },
  }),
},
featuredText: {
  fontSize: 12,
  fontWeight: '700',
},
```

---

## 🟡 MEDIUM FIX #2: Standardize Loading Skeletons

### Problem
Mix of custom skeletons and ShimmerSkeleton component.

### Files:
- `components/EventsList.tsx` (lines 58-79)
- `app/(admin)/events/index.tsx` (lines 78-106)

### Solution:

**Replace custom skeleton with:**

```typescript
import { ShimmerSkeleton } from './ShimmerSkeleton';

function EventsLoadingSkeleton({ colors }: { colors: any }) {
  return (
    <View style={styles.listContent}>
      {[...Array(3)].map((_, index) => (
        <View 
          key={`skeleton-${index}`}
          style={[styles.skeletonCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          {/* Image skeleton */}
          <ShimmerSkeleton 
            colors={colors} 
            style={{ width: '100%', height: 140, borderTopLeftRadius: 16, borderTopRightRadius: 16 }} 
          />
          
          {/* Content skeletons */}
          <View style={{ padding: 16, gap: 12 }}>
            <ShimmerSkeleton colors={colors} style={{ width: '80%', height: 20, borderRadius: 8 }} />
            <ShimmerSkeleton colors={colors} style={{ width: '60%', height: 14, borderRadius: 6 }} />
            <ShimmerSkeleton colors={colors} style={{ width: '70%', height: 14, borderRadius: 6 }} />
            <ShimmerSkeleton colors={colors} style={{ width: '100%', height: 44, borderRadius: 10, marginTop: 8 }} />
          </View>
        </View>
      ))}
    </View>
  );
}
```

---

## 🟡 MEDIUM FIX #3: Theme-Aware Loading Overlays

### Problem
Loading overlays use hardcoded white background.

### Files: Multiple (EventCard, Event detail screen, etc.)

### Solution:

**Add to colors.ts:**
```typescript
export const Colors = {
  light: {
    // ... existing
    overlayLight: 'rgba(255, 255, 255, 0.8)',
    overlayDark: 'rgba(0, 0, 0, 0.5)',
  },
  dark: {
    // ... existing  
    overlayLight: 'rgba(255, 255, 255, 0.1)',
    overlayDark: 'rgba(0, 0, 0, 0.7)',
  },
};
```

**Update style:**
```typescript
// Before
imageLoadingOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
},

// After
imageLoadingOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: colors.overlayLight,
},
```

---

## 🟢 LOW PRIORITY: Image Optimization

### Add to `services/eventsService.ts`

```typescript
/**
 * Get optimized image URL with width parameter
 * Works with Supabase Storage image transformations
 */
export function getOptimizedImageUrl(
  url: string | undefined, 
  width: number = 800
): string | undefined {
  if (!url) return undefined;
  
  // Only optimize Supabase storage URLs
  if (!url.includes('supabase.co/storage')) return url;
  
  // Add width transformation
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}width=${width}&quality=80`;
}

/**
 * Preload critical event images
 */
export async function preloadEventImages(events: Event[]): Promise<void> {
  const imageUrls = events
    .map(e => e.imageUrl)
    .filter((url): url is string => !!url);
  
  if (imageUrls.length === 0) return;
  
  const { Image } = await import('react-native');
  
  await Promise.allSettled(
    imageUrls.map(url => 
      Image.prefetch(url).catch(err => {
        console.warn('Failed to prefetch image:', url, err);
      })
    )
  );
}
```

**Usage in EventsList:**

```typescript
useEffect(() => {
  if (events.length > 0) {
    // Preload images for better UX
    preloadEventImages(events.slice(0, 5)); // First 5 images
  }
}, [events]);
```

---

## 📝 TESTING CHECKLIST

After making fixes, test:

### Image Loading
- [ ] Slow network (throttle to 3G in DevTools)
- [ ] Broken image URLs
- [ ] Missing images (null/undefined URLs)
- [ ] Very large images (>5MB)
- [ ] Different aspect ratios

### UI Consistency  
- [ ] All colors use theme
- [ ] Featured badge appears everywhere
- [ ] Loading states are consistent
- [ ] Dark mode works correctly
- [ ] Small screen (< 380px)
- [ ] Tablet (>= 768px)

### Functionality
- [ ] Create event with image
- [ ] Edit event and change image
- [ ] Share event to feed
- [ ] Register for event
- [ ] View event details

---

## 📊 ESTIMATED TIME

| Priority | Task | Time |
|----------|------|------|
| 🔴 HIGH | Color system standardization | 2-3h |
| 🔴 HIGH | Fix SharedEventCard image logic | 30m |
| 🔴 HIGH | Create shared category config | 20m |
| 🟡 MEDIUM | Add featured badge to detail | 15m |
| 🟡 MEDIUM | Standardize skeletons | 1h |
| 🟡 MEDIUM | Theme-aware overlays | 30m |
| 🟢 LOW | Image optimization | 2h |

**Total: 6-7 hours for high/medium priority items**

---

## 🚀 IMPLEMENTATION ORDER

### Day 1: Color System (3 hours)
1. Add color constants to `colors.ts`
2. Create `eventCategories.ts`
3. Update EventCard, SharedEventCard, EventsList
4. Test on light/dark mode

### Day 2: Image & UI Fixes (2 hours)
5. Fix SharedEventCard image logic
6. Add featured badge to detail screen
7. Update loading overlays to use theme
8. Standardize skeletons

### Day 3: Polish & Test (2 hours)
9. Add image optimization (optional)
10. Run through testing checklist
11. Fix any issues found

---

## 🎯 SUCCESS CRITERIA

- ✅ No hardcoded colors in event components
- ✅ All image loading states work correctly
- ✅ Featured badge visible everywhere
- ✅ Dark mode fully supported
- ✅ Consistent loading skeletons
- ✅ All tests pass

---

**Next Steps:**
1. Start with color system fixes (highest impact)
2. Test as you go on both light and dark mode
3. Use the testing checklist to verify each fix
4. Create a PR with before/after screenshots

Good luck! 🎉

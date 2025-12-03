# Event Screen Crash Fix

## Issue
The event details screen (`app/events/[id].tsx`) was crashing during the build due to an undefined variable reference.

## Root Cause
The file referenced `screenWidth` on line 721 in the loading skeleton component, but the variable was never defined. This caused a runtime error when the loading skeleton was displayed.

```typescript
// Line 721 - ERROR: screenWidth is not defined
<ShimmerSkeleton 
  key={i}
  colors={colors} 
  style={{ 
    width: screenWidth > 600 ? '23%' : '48%',  // ❌ screenWidth was undefined
    height: 100, 
    borderRadius: 12 
  }} 
/>
```

## Solution
Added the missing `screenWidth` constant at the top of the file (line 70), following the same pattern used in other component files:

```typescript
// Screen width constant
const screenWidth = Dimensions.get('window').width;
```

## Files Modified
- `/workspace/app/events/[id].tsx` - Added `screenWidth` constant definition

## Verification
- ✅ No linter errors
- ✅ All other event-related files (`EventCard.tsx`, `EventsList.tsx`, `CauseCard.tsx`, `CausesList.tsx`, `register.tsx`) already have proper `screenWidth` definitions
- ✅ No similar issues found in other files

## Testing
The fix ensures that:
1. The event details screen loads without crashing
2. The loading skeleton properly displays with responsive width calculations
3. The screen adapts to different screen sizes (mobile < 600px, tablet/desktop >= 600px)

## Build Status
Ready for deployment to Vercel. The build should now complete successfully without runtime errors.

---
**Fixed by:** Background Agent
**Date:** December 3, 2025

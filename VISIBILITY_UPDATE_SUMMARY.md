# Visibility Type Implementation Summary

## Overview
Added `VisibilityType` support to Events, Causes, and Opportunities to enable content visibility control between 'public' and 'members_only'.

## Changes Made

### 1. Types (`types/index.ts`)
Added new type and updated interfaces:
- **Line 7**: Added `export type VisibilityType = 'public' | 'members_only';`
- **Line 123**: Added `visibility: VisibilityType;` to `Opportunity` interface
- **Line 499**: Added `visibility: VisibilityType;` to `Cause` interface
- **Line 752**: Added `visibility: VisibilityType;` to `Event` interface

### 2. Events Service (`services/eventsService.ts`)
Updated transform, create, and update functions:

#### transformEvent (Line 58)
```typescript
visibility: row.visibility || 'public',
```

#### createEvent Parameters (Line 220)
```typescript
visibility?: 'public' | 'members_only';
```

#### createEvent Insert (Line 252)
```typescript
visibility: eventData.visibility || 'public',
```

#### updateEvent Parameters (Line 301)
```typescript
visibility: 'public' | 'members_only';
```

#### updateEvent Body (Line 333)
```typescript
if (updates.visibility !== undefined) updateData.visibility = updates.visibility;
```

### 3. Causes Service (`services/causesService.ts`)
Updated transform, create, and update functions:

#### transformCause (Line 40)
```typescript
visibility: row.visibility || 'public',
```

#### createCause Parameters (Line 231)
```typescript
visibility?: 'public' | 'members_only';
```

#### createCause Insert (Line 247)
```typescript
visibility: causeData.visibility || 'public',
```

#### updateCause Parameters (Line 282)
```typescript
visibility: 'public' | 'members_only';
```

#### updateCause Body (Line 299)
```typescript
if (updates.visibility !== undefined) updateData.visibility = updates.visibility;
```

## Database Requirements

The following columns should exist (or be added) in the database:

```sql
-- Events table
ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public' CHECK (visibility IN ('public', 'members_only'));

-- Causes table
ALTER TABLE causes 
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public' CHECK (visibility IN ('public', 'members_only'));

-- Opportunities table
ALTER TABLE opportunities 
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public' CHECK (visibility IN ('public', 'members_only'));
```

## Default Behavior

- All functions default to `'public'` visibility if not specified
- Existing records without visibility will be treated as `'public'`
- This ensures backward compatibility with existing data

## Usage Examples

### Creating an Event with Visibility
```typescript
await createEvent({
  title: "Premium Member Workshop",
  description: "Exclusive workshop for members",
  visibility: 'members_only',
  // ... other fields
});
```

### Updating Event Visibility
```typescript
await updateEvent(eventId, {
  visibility: 'members_only'
});
```

### Creating a Cause with Visibility
```typescript
await createCause({
  title: "Member Fundraiser",
  description: "Special fundraising campaign",
  visibility: 'members_only',
  // ... other fields
});
```

### Updating Cause Visibility
```typescript
await updateCause(causeId, {
  visibility: 'public'
});
```

## Implementation Notes

1. **Type Safety**: All visibility fields are properly typed with `VisibilityType` or the literal union `'public' | 'members_only'`
2. **Backward Compatibility**: Default value of `'public'` ensures existing functionality continues to work
3. **Transform Functions**: Automatically convert database snake_case `visibility` to camelCase
4. **Update Functions**: Only update visibility if explicitly provided in updates object
5. **Consistency**: Same implementation pattern used across Events, Causes, and Opportunities

## Testing Checklist

- [ ] Create new event with `visibility: 'public'` - should work
- [ ] Create new event with `visibility: 'members_only'` - should work
- [ ] Create new event without visibility - should default to `'public'`
- [ ] Update event visibility from `'public'` to `'members_only'` - should work
- [ ] Update event visibility from `'members_only'` to `'public'` - should work
- [ ] Repeat above tests for causes
- [ ] Repeat above tests for opportunities
- [ ] Verify transformed objects include visibility field
- [ ] Verify backward compatibility with existing records

## Next Steps

To fully implement visibility filtering:
1. Update query functions to filter by visibility based on user membership status
2. Add UI controls for admins to set visibility when creating/editing content
3. Update feed/list views to respect visibility settings
4. Add membership checks before displaying members-only content

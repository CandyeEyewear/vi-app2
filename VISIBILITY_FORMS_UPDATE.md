# Visibility Forms Update - Complete

## Summary
Successfully added `VisibilityType` support to all 6 create/edit forms for Opportunities, Events, and Causes.

## Files Updated

### 1. ✅ app/create-opportunity.tsx
- Added `Switch` to react-native imports
- Added `Globe, Lock` to lucide-react-native imports  
- Added `import { VisibilityType } from '../types';`
- Added state: `const [visibility, setVisibility] = useState<VisibilityType>('public');`
- Added state: `const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);`
- Added visibility toggle UI before Create button
- Added `visibility,` to Supabase `.insert()` at line 572
- Added toggle styles: `toggleRow`, `toggleInfo`, `toggleLabel`, `toggleDescription`

### 2. ✅ app/edit-opportunity/[id].tsx
- Added `Switch` to react-native imports
- Added `Globe, Lock` to lucide-react-native imports
- Added `import { VisibilityType } from '../../types';`
- Added state: `const [visibility, setVisibility] = useState<VisibilityType>('public');`
- Added state: `const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);`
- Added `setVisibility(data.visibility || 'public');` in loadOpportunityData at line 262
- Added visibility toggle UI before Update button
- Added `visibility,` to Supabase `.update()` at line 467
- Added toggle styles: `toggleRow`, `toggleInfo`, `toggleLabel`, `toggleDescription`

### 3. ✅ app/(admin)/events/create.tsx
- Added `Globe, Lock` to lucide-react-native imports
- Added `VisibilityType` to types import: `import { EventCategory, VisibilityType } from '../../../types';`
- Added state: `const [visibility, setVisibility] = useState<VisibilityType>('public');`
- Added state: `const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);`
- Added Settings section with visibility toggle UI
- Added `visibility,` to `createEvent()` call at line 342
- Added toggle styles: `toggleRow`, `toggleInfo`, `toggleLabel`, `toggleDescription`

### 4. ✅ app/(admin)/events/edit/[id].tsx
- Added `Globe, Lock` to lucide-react-native imports
- Added `VisibilityType` to types import: `import { Event, EventCategory, EventStatus, VisibilityType } from '../../../../types';`
- Added state: `const [visibility, setVisibility] = useState<VisibilityType>('public');`
- Added state: `const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);`
- Added `setVisibility(event.visibility || 'public');` in useEffect at line 183
- Added visibility toggle UI before Featured toggle
- Added `visibility,` to `updateEvent()` call at line 399
- Toggle styles already exist in file

### 5. ✅ app/(admin)/causes/create.tsx
- Added `Globe, Lock` to lucide-react-native imports
- Added `VisibilityType` to types import: `import { CauseCategory, VisibilityType } from '../../../types';`
- Added state: `const [visibility, setVisibility] = useState<VisibilityType>('public');`
- Added state: `const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);`
- Added visibility toggle UI before Public Donations toggle (first in Settings section)
- Added `visibility,` to `createCause()` call at line 271
- Toggle styles already exist in file

### 6. ✅ app/(admin)/causes/edit/[id].tsx
- Added `Globe, Lock` to lucide-react-native imports
- Added `VisibilityType` to types import: `import { CauseCategory, CauseStatus, Cause, VisibilityType } from '../../../../types';`
- Added state: `const [visibility, setVisibility] = useState<VisibilityType>('public');`
- Added state: `const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);`
- Added `setVisibility(data.visibility || 'public');` in useEffect at line 145
- Added visibility toggle UI before Featured toggle
- Added `visibility,` to Supabase `.update()` at line 325
- Toggle styles already exist in file

## Visibility Toggle UI

The toggle UI added to all 6 forms:

```tsx
{/* Visibility */}
<View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
  <View style={styles.toggleInfo}>
    {visibility === 'public' ? (
      <Globe size={20} color="#4CAF50" />
    ) : (
      <Lock size={20} color="#FF9800" />
    )}
    <View style={{ flex: 1 }}>
      <Text style={[styles.toggleLabel, { color: colors.text }]}>
        {visibility === 'public' ? 'Public' : 'Members Only'}
      </Text>
      <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
        {visibility === 'public' 
          ? 'Visible to everyone, including visitors' 
          : 'Only visible to logged-in members'}
      </Text>
    </View>
  </View>
  <Switch
    value={visibility === 'members_only'}
    onValueChange={(value) => setVisibility(value ? 'members_only' : 'public')}
    trackColor={{ false: colors.border, true: '#FF9800' }}
    thumbColor="#FFFFFF"
  />
</View>
```

## Toggle Styles Added

For files that didn't have toggle styles (opportunities forms):

```typescript
toggleRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 16,
  borderWidth: 1,
  borderRadius: 12,
},
toggleInfo: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  flex: 1,
},
toggleLabel: {
  fontSize: 16,
  fontWeight: '600',
  marginBottom: 2,
},
toggleDescription: {
  fontSize: 13,
  lineHeight: 18,
},
```

## Import Path Reference

| File | VisibilityType Import Path |
|------|---------------------------|
| `app/create-opportunity.tsx` | `'../types'` |
| `app/edit-opportunity/[id].tsx` | `'../../types'` |
| `app/(admin)/events/create.tsx` | `'../../../types'` |
| `app/(admin)/events/edit/[id].tsx` | `'../../../../types'` |
| `app/(admin)/causes/create.tsx` | `'../../../types'` |
| `app/(admin)/causes/edit/[id].tsx` | `'../../../../types'` |

## Database Integration

### Create Forms
- **Opportunities**: Direct Supabase `.insert()` includes `visibility,`
- **Events**: `createEvent()` service call includes `visibility,`
- **Causes**: `createCause()` service call includes `visibility,`

### Edit Forms  
- **Opportunities**: Direct Supabase `.update()` includes `visibility,`
- **Events**: `updateEvent()` service call includes `visibility,`
- **Causes**: Direct Supabase `.update()` includes `visibility,`

### Edit Forms Data Loading
All 3 edit forms load existing visibility in their useEffect/loadData functions:
```typescript
setVisibility(data.visibility || 'public');
```

## Visual Indicators

- **Public**: Green globe icon (#4CAF50)
- **Members Only**: Orange lock icon (#FF9800)
- Toggle switch: Orange track (#FF9800) when members_only

## Testing Checklist

- [ ] Create new opportunity with public visibility
- [ ] Create new opportunity with members_only visibility
- [ ] Edit opportunity and change visibility
- [ ] Create new event with public visibility
- [ ] Create new event with members_only visibility
- [ ] Edit event and change visibility
- [ ] Edit event loads existing visibility correctly
- [ ] Create new cause with public visibility
- [ ] Create new cause with members_only visibility
- [ ] Edit cause and change visibility
- [ ] Edit cause loads existing visibility correctly
- [ ] Verify UI displays correct icon and label
- [ ] Verify toggle switch works correctly
- [ ] Verify data saves to database correctly

## Notes

- Default visibility is `'public'` for all forms
- Edit forms properly load existing visibility or default to `'public'`
- UI uses intuitive icons (Globe for public, Lock for members only)
- Color scheme respects light/dark mode
- Toggle switch is properly bound to visibility state
- All database operations include the visibility field

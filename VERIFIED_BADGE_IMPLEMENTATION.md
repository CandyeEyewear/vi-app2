# Verified Badge Implementation Guide

## ✅ Completed

1. **Components Created:**
   - `components/VerifiedBadge.tsx` - Checkmark badge component
   - `components/AvatarWithBadge.tsx` - Avatar with border and badge
   - `components/UserNameWithBadge.tsx` - Username with inline badge
   - `components/index.ts` - Central export file

2. **Type Updated:**
   - Added `membershipTier?: 'free' | 'premium'` to User interface in `types/index.ts`

3. **Screens Updated:**
   - ✅ `components/cards/FeedPostCard.tsx` - Post headers and comments
   - ✅ `app/conversation/[id].tsx` - Chat header
   - ✅ `app/(tabs)/messages.tsx` - Conversation list

## 🔄 Remaining Updates Needed

### 1. Profile Screen (`app/profile/[id].tsx`)

**Find the avatar display section (around line 800):**
```typescript
// Replace:
{profileUser.avatarUrl ? (
  <Image source={{ uri: profileUser.avatarUrl }} style={styles.avatar} />
) : (
  <View style={styles.avatarPlaceholder}>
    <Text style={styles.avatarText}>
      {profileUser.fullName.charAt(0).toUpperCase()}
    </Text>
  </View>
)}

// With:
import { AvatarWithBadge, UserNameWithBadge } from '../../components/index';

<AvatarWithBadge
  uri={profileUser.avatarUrl || null}
  name={profileUser.fullName}
  size={80} // or whatever size is used
  role={profileUser.role || 'volunteer'}
  membershipTier={profileUser.membershipTier || 'free'}
/>
```

**Find username display and add badge:**
```typescript
// Replace:
<Text style={styles.name}>{profileUser.fullName}</Text>

// With:
<UserNameWithBadge
  name={profileUser.fullName}
  role={profileUser.role || 'volunteer'}
  membershipTier={profileUser.membershipTier || 'free'}
  style={styles.name}
/>
```

### 2. Opportunity Group Chat (`components/OpportunityGroupChat.tsx`)

**Find message sender name (around line 319):**
```typescript
// Add import:
import { UserNameWithBadge } from './index';

// Replace:
<Text style={styles.senderName}>{messageUser?.fullName || 'Unknown'}</Text>

// With:
<UserNameWithBadge
  name={messageUser?.fullName || 'Unknown'}
  role={messageUser?.role || 'volunteer'}
  membershipTier={messageUser?.membershipTier || 'free'}
  style={styles.senderName}
  badgeSize={14}
/>
```

**Note:** You'll need to ensure the user cache includes `role` and `membershipTier` fields when fetching user data.

### 3. Post Detail Screen (`app/post/[id].tsx`)

**Find post author display:**
```typescript
// Add import:
import { AvatarWithBadge, UserNameWithBadge } from '../../components/index';

// Replace avatar and name with badge components
```

### 4. Edit Profile Screen (`app/edit-profile.tsx`)

**If showing current user's avatar/name:**
```typescript
// Add import and use AvatarWithBadge for preview
```

### 5. Search Results / User Lists

**Any component showing user search results should use:**
- `AvatarWithBadge` for avatars
- `UserNameWithBadge` for names

## Database Migration

Ensure your Supabase `users` table has:
- `role` column (text): 'volunteer' or 'admin'
- `membership_tier` column (text): 'free' or 'premium'

## Usage Examples

### Avatar with Badge
```typescript
<AvatarWithBadge
  uri={user.avatarUrl || null}
  name={user.fullName}
  size={40}
  role={user.role || 'volunteer'}
  membershipTier={user.membershipTier || 'free'}
/>
```

### Username with Badge
```typescript
<UserNameWithBadge
  name={user.fullName}
  role={user.role || 'volunteer'}
  membershipTier={user.membershipTier || 'free'}
  style={styles.userName}
  badgeSize={16}
/>
```

## Component Props

### VerifiedBadge
- `type: 'premium' | 'admin'` - Badge type
- `size?: number` - Badge size (default: 16)

### AvatarWithBadge
- `uri: string | null` - Avatar image URL
- `name: string` - User's full name (for fallback)
- `size?: number` - Avatar size (default: 40)
- `role: string` - User role ('volunteer' or 'admin')
- `membershipTier: string` - Membership tier ('free' or 'premium')
- `style?: ViewStyle` - Additional styles

### UserNameWithBadge
- `name: string` - User's full name
- `role: string` - User role
- `membershipTier: string` - Membership tier
- `style?: TextStyle` - Text style
- `badgeSize?: number` - Badge size (default: 16)

## Priority Logic

1. **Admin** → Black badge + black border (highest priority)
2. **Premium** → Blue badge + blue border
3. **Regular** → No badge, no border


# Messaging Features Debug Guide

## Problem
Online status indicators and typing indicators are not showing in the app.

## Root Causes Found

### 1. **Realtime Configuration Issue**
The presence channels require Supabase Realtime to be properly configured with Broadcast and Presence enabled.

### 2. **Potential Channel Naming Conflict**
Multiple screens might be creating channels with the same name, causing conflicts.

### 3. **Timing Issue**
The presence tracking happens asynchronously, and there might be race conditions.

## How to Debug

### Step 1: Check Supabase Realtime Configuration

1. Go to your Supabase Dashboard
2. Navigate to **Database** → **Replication**
3. Ensure the `conversations` and `messages` tables have **Realtime** enabled
4. Navigate to **Settings** → **API**
5. Verify that **Realtime** is enabled for your project

### Step 2: Test with Debug Version

I've created a debug version: `app/(tabs)/messages_debug.tsx`

**To use it:**
1. Temporarily rename your current `messages.tsx` to `messages_original.tsx`
2. Rename `messages_debug.tsx` to `messages.tsx`
3. Run the app and check the console logs

**Look for these logs:**
```
[ONLINE_STATUS] Setting up presence for X conversations
[ONLINE_STATUS] Subscribe status for XXXXX: SUBSCRIBED
[ONLINE_STATUS] SYNC for XXXXX: N presences
[ONLINE_STATUS] Other user NAME online: true/false
```

### Step 3: Test End-to-End

**Test Scenario:**
1. Device A: Login as User A
2. Device B: Login as User B
3. Device A: Open Messages tab → should see User B offline (⚫)
4. Device B: Open conversation with User A
5. Device A: Check Messages tab → should see User B online (🟢) **within 2-3 seconds**

### Step 4: Check for Errors

Common errors to look for:

#### Error: "Channel not found" or "Failed to subscribe"
**Solution:** Ensure Supabase Realtime is enabled in your project settings

#### Error: "Presence tracking failed"
**Solution:** Check that your Supabase plan supports Realtime Presence (not available on free tier)

#### No errors, but status not updating
**Solution:** Check browser/app console for blocked WebSocket connections

## Technical Implementation Details

### How Online Status Works

```typescript
// User in MESSAGES LIST (monitoring only)
presenceChannel.track({
  user_id: user.id,
  online: false,  // ❌ Not in chat
  typing: false
});

// User in CONVERSATION SCREEN (actively chatting)
presenceChannel.track({
  user_id: user.id,
  online: true,   // ✅ In chat
  typing: false
});
```

### How Typing Indicator Works

```typescript
// When user types in conversation
presenceChannel.track({
  user_id: user.id,
  online: true,
  typing: true    // ✅ Typing
});

// After 2 seconds of no typing
presenceChannel.track({
  user_id: user.id,
  online: true,
  typing: false   // ❌ Not typing
});
```

## Common Issues and Fixes

### Issue 1: Green Dot Never Shows

**Possible Causes:**
- Supabase Realtime not enabled
- WebSocket connection blocked
- Presence channels not supported on your plan

**Fix:**
```typescript
// Add to supabase.ts
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});
```

### Issue 2: Typing Indicator Never Shows

**Check:**
1. Is `otherUserTyping` state being set?
2. Is `TypingIndicator` component rendering?
3. Console log the presence sync event

**Add to conversation/[id].tsx:**
```typescript
.on('presence', { event: 'sync' }, () => {
  const state = presenceChannel.presenceState();
  console.log('Presence state:', state);  // ADD THIS
  const presences = Object.values(state).flat() as any[];
  
  const someoneTyping = presences.some(
    (p: any) => p.user_id !== user.id && p.typing
  );
  console.log('Someone typing:', someoneTyping);  // ADD THIS
  setOtherUserTyping(someoneTyping);
});
```

### Issue 3: Status Shows Briefly Then Disappears

**Cause:** Cleanup function firing too early

**Fix:** Ensure proper cleanup in useEffect dependencies

### Issue 4: OnlineStatusDot Component Not Rendering

**Check rendering conditions:**
```typescript
// In messages.tsx line 236-240
{isOnline && (
  <View style={{ position: 'absolute', bottom: -2, right: -2 }}>
    <OnlineStatusDot isOnline={true} size={14} />
  </View>
)}
```

**Verify:**
1. `isOnline` is `true` (add console.log)
2. `OnlineStatusDot` component is imported correctly
3. No styling issues hiding the dot

## Testing Checklist

- [ ] Supabase Realtime enabled in dashboard
- [ ] Console shows "SUBSCRIBED" for presence channels
- [ ] Console shows presence sync events
- [ ] No WebSocket errors in console
- [ ] Tested with 2 different devices/browsers
- [ ] Tested in both dev and production builds
- [ ] Checked that components are properly exported/imported

## Quick Fix Attempts

### Attempt 1: Force Re-render
Add this to see if the component is rendering:

```typescript
// In messages.tsx, add to renderConversation
console.log(`Conversation ${item.id}: isOnline=${isOnline}, statusMap=`, onlineStatusMap);
```

### Attempt 2: Simplify Presence Check
Change line 137 in messages.tsx from:
```typescript
const otherUserPresence = presences.find(
  (p: any) => p.user_id === otherUserId && p.online === true
);
```

To:
```typescript
const otherUserPresence = presences.find(
  (p: any) => p.user_id === otherUserId
);
// Any presence = online (simpler check)
```

### Attempt 3: Verify Component Visibility
Add temporary styling to make the dot more visible:

```typescript
<View style={{ 
  position: 'absolute', 
  bottom: -2, 
  right: -2,
  backgroundColor: 'red',  // DEBUG: Make it obvious
  width: 20,
  height: 20,
  borderRadius: 10,
}}>
  <OnlineStatusDot isOnline={true} size={14} />
</View>
```

## Next Steps if Still Not Working

1. **Check Supabase Dashboard Logs**
   - Go to Logs → Realtime Logs
   - Look for presence channel subscriptions

2. **Test Presence Directly**
   ```typescript
   // Add this to conversation screen on mount
   const testChannel = supabase.channel('test-presence');
   testChannel.on('presence', { event: 'sync' }, () => {
     console.log('Test presence sync:', testChannel.presenceState());
   }).subscribe();
   ```

3. **Verify Supabase Plan**
   - Free tier might have limitations on Realtime Presence
   - Check: https://supabase.com/pricing

4. **Check for Middleware/Proxy Issues**
   - Corporate networks might block WebSockets
   - Try on mobile data vs WiFi

## Contact Points for Further Help

If still not working after trying above:
1. Share console logs from debug version
2. Share Supabase project settings (Realtime section)
3. Share network tab showing WebSocket connections
4. Confirm Supabase plan/tier

# Quick Fix Checklist - Online Status & Typing Indicators

## ✅ What I Fixed

### 1. Added Realtime Configuration to Supabase Client
**File:** `services/supabase.ts`

**Before:**
```typescript
export const supabase = createClient(url, key, {
  auth: { /* ... */ }
});
```

**After:**
```typescript
export const supabase = createClient(url, key, {
  auth: { /* ... */ },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
```

This was **THE CRITICAL FIX** - without this, presence channels don't work.

## 🔍 What I Verified

✅ **Components Exist:**
- `OnlineStatusDot.tsx` - Renders green/blue dot
- `TypingIndicator.tsx` - Shows animated "is typing..." 
- Both properly exported

✅ **Styling Correct:**
- `position: 'relative'` on avatar containers
- `position: 'absolute'` on status dots
- No z-index issues

✅ **Logic Implemented:**
- Messages screen subscribes to presence for all conversations
- Conversation screen tracks online/typing status
- Proper event handlers (sync, join, leave, update)

✅ **Realtime Config:**
- Enabled in `supabase/config.toml`
- Now properly configured in client

## 🚀 What You Need To Do

### Step 1: Restart Your App (REQUIRED!)
The Supabase client is initialized once. You MUST fully restart:

```bash
# Stop all processes
# Then:
npm start -- --reset-cache

# OR for Expo:
expo start -c
```

### Step 2: Test It

**Two Users, Two Devices:**

1. **Device A** (User A):
   - Login
   - Go to Messages tab
   - Leave it open

2. **Device B** (User B):
   - Login  
   - Open conversation with User A
   - Start typing

3. **Device A** should show:
   - Green/blue dot next to User B's avatar (online)
   - "User B is typing..." when they type

### Step 3: Check Console

Open React Native debugger or browser console and look for:

**✅ Good:**
```
SUBSCRIBED
Presence state synced
```

**❌ Bad:**
```
CHANNEL_ERROR
TIMED_OUT
WebSocket connection failed
```

## 🐛 If Still Not Working

### Issue A: No WebSocket Connection

**Symptoms:** Console shows `CHANNEL_ERROR` or `TIMED_OUT`

**Fixes:**
1. Check Supabase Dashboard → Project Settings → API → Realtime is ON
2. Try different network (mobile data vs WiFi)
3. Check firewall isn't blocking WebSockets
4. Verify Supabase project isn't paused/suspended

### Issue B: Channels Subscribe But No Presence

**Symptoms:** Console shows `SUBSCRIBED` but no presence events

**Fixes:**
1. Check Supabase plan - Free tier has presence limits
2. Run test script: `import { testRealtimeConnection } from './test-realtime-connection'`
3. Enable Realtime in Dashboard → Database → Replication

### Issue C: Green Dot Not Visible

**Symptoms:** Everything works in console but no dot shows

**Fixes:**
1. Add debugging to see if `isOnline` is true:
```typescript
console.log('Is online?', isOnline, onlineStatusMap);
```

2. Make dot more visible temporarily:
```typescript
<View style={{ 
  position: 'absolute', 
  bottom: -2, 
  right: -2,
  backgroundColor: 'red',  // DEBUG
  width: 20, 
  height: 20,
  borderRadius: 10,
  zIndex: 999,  // DEBUG
}}>
  <OnlineStatusDot isOnline={true} size={14} />
</View>
```

3. Check if `OnlineStatusDot` is rendering:
```typescript
// In OnlineStatusDot.tsx, add:
console.log('OnlineStatusDot render:', isOnline);
if (!isOnline) {
  console.log('Not rendering dot - isOnline is false');
  return null;
}
```

## 📊 Test Script Available

I created `test-realtime-connection.ts` that you can run to verify everything:

```typescript
import { testRealtimeConnection } from './test-realtime-connection';

// In your app
useEffect(() => {
  testRealtimeConnection();
}, []);
```

It will test:
1. Basic channel subscription
2. Presence tracking
3. Multiple channels (like messages screen)

## 🎯 Expected Behavior

### In Messages List
- Green/blue dot appears next to users who are ACTIVELY in a conversation
- Dot appears within 2-3 seconds when they open conversation
- Dot disappears when they close conversation

### In Conversation Screen
- "Online" text shows in header when other user is in the conversation
- "User is typing..." shows when they type
- Disappears 2 seconds after they stop typing

## 📝 Debug Version Available

I created `app/(tabs)/messages_debug.tsx` with extensive logging.

**To use:**
```bash
mv app/\(tabs\)/messages.tsx app/\(tabs\)/messages_backup.tsx
mv app/\(tabs\)/messages_debug.tsx app/\(tabs\)/messages.tsx
```

Restart app and you'll see debug logs at the top of the screen + console.

## ❓ Still Need Help?

If it's still not working after:
1. ✅ Restarting app with cache clear
2. ✅ Checking console for errors
3. ✅ Running test script
4. ✅ Trying debug version

Then share:
- Console output from debug version
- Supabase Dashboard screenshots (Realtime settings)
- Network tab showing WebSocket connections
- Your Supabase plan/tier

## Summary

**The Main Fix:** Added realtime configuration to Supabase client

**What was wrong:** Without explicit realtime config, the JS client creates channels but doesn't establish proper WebSocket connections for presence tracking

**What should happen now:** After restarting, presence channels should work and you'll see online status dots and typing indicators in real-time

**Time to see results:** 2-3 seconds after users enter/leave conversations

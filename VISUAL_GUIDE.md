# 📱 Visual Guide - What You Should See

## Online Status Indicator

### In Messages List

```
┌───────────────────────────────────────┐
│  Messages                             │
├───────────────────────────────────────┤
│                                       │
│  ╭─────╮                              │
│  │ 👤  │ ⚫  John Doe          2:30 PM│  ← Offline (no green dot)
│  ╰─────╯     Hey, how are you?       │
│                                       │
│  ╭─────╮                              │
│  │ 👤  │ 🟢  Jane Smith       now    │  ← Online (green dot visible!)
│  ╰─────╯     You: Thanks!            │
│         └─ GREEN DOT HERE!            │
│                                       │
│  ╭─────╮                              │
│  │ 👤  │ ⚫  Mike Johnson     1h     │  ← Offline
│  ╰─────╯     See you tomorrow        │
│                                       │
└───────────────────────────────────────┘
```

**Key Points:**
- 🟢 Green dot = User is ACTIVELY in a conversation right now
- ⚫ No dot = User is offline or just browsing messages list
- Dot appears in **bottom-right** corner of avatar
- Updates within **2-3 seconds** of status change

### In Conversation Header

```
┌───────────────────────────────────────┐
│  ← ╭───╮ Jane Smith                  │
│     │👤 │ 🟢 Online                  │  ← Shows "Online" text
│     ╰───╯                             │      when user is in chat
├───────────────────────────────────────┤
│                                       │
│           Hey! How are you?  10:30 AM│
│                                       │
│  Good, thanks!         10:31 AM ✓✓   │
│                                       │
└───────────────────────────────────────┘
```

## Typing Indicator

### When Other User is Typing

```
┌───────────────────────────────────────┐
│  ← ╭───╮ Jane Smith                  │
│     │👤 │ 🟢 Online                  │
│     ╰───╯                             │
├───────────────────────────────────────┤
│                                       │
│           Hey! How are you?  10:30 AM│
│                                       │
│  Good, thanks!         10:31 AM ✓✓   │
│                                       │
│  ╭─────────────────────────────────╮ │
│  │ Jane Smith is typing ⚫ ⚫ ⚫     │ │  ← Typing indicator!
│  ╰─────────────────────────────────╯ │      Dots are animated
│                                       │
│ ┌──────────────────────────────────┐ │
│ │ Message...                    📎 │ │
│ └──────────────────────────────────┘ │
└───────────────────────────────────────┘
```

**Key Points:**
- Shows user's name + "is typing"
- Three animated dots that bounce
- Appears immediately when they start typing
- Disappears 2 seconds after they stop

### Typing Indicator Animation

The three dots animate like this:
```
Frame 1: ⚫ ⚪ ⚪  (first dot up)
Frame 2: ⚪ ⚫ ⚪  (second dot up)
Frame 3: ⚪ ⚪ ⚫  (third dot up)
Frame 4: ⚪ ⚪ ⚪  (reset)
Repeat...
```

## Message Status (Read Receipts)

```
┌───────────────────────────────────────┐
│                                       │
│  Good, thanks!    10:31 AM ✓         │  ← ✓ = Sent
│                                       │
│  What's up?       10:32 AM ✓✓        │  ← ✓✓ = Delivered
│                                       │
│  See you soon!    10:33 AM ✓✓        │  ← ✓✓ (green) = Read
│                                       │
└───────────────────────────────────────┘
```

**Status Progression:**
1. **✓** (single check) = Message sent to server
2. **✓✓** (double check) = Message delivered to recipient's device
3. **✓✓** (green) = Message read by recipient

## Real-World Test Scenario

### Scenario: Two Friends Chatting

**Device A (Alice):**
1. Opens Messages tab
2. Sees Bob **offline** (no green dot)
3. Waits...

**Device B (Bob):**
1. Opens conversation with Alice
2. Types "Hey Alice!"

**What Alice Sees (Device A):**
```
Step 1: Bob's avatar in list
╭─────╮
│ 👤  │ ⚫  Bob Wilson         ← No dot (offline)
╰─────╯

Step 2: Bob opens conversation (2-3 seconds later)
╭─────╮
│ 👤  │ 🟢  Bob Wilson         ← Green dot appears!
╰─────╯

Step 3: Alice opens conversation with Bob
┌─────────────────────────────┐
│  ← ╭───╮ Bob Wilson         │
│     │👤 │ 🟢 Online          │  ← "Online" in header
│     ╰───╯                    │
├─────────────────────────────┤
│                              │
│  (messages here)             │
└─────────────────────────────┘

Step 4: Bob starts typing
┌─────────────────────────────┐
│  ← ╭───╮ Bob Wilson         │
│     │👤 │ 🟢 Online          │
│     ╰───╯                    │
├─────────────────────────────┤
│                              │
│  ╭───────────────────────╮  │
│  │ Bob Wilson is typing  │  │  ← Indicator appears
│  │ ⚫ ⚫ ⚫               │  │    with bouncing dots
│  ╰───────────────────────╯  │
└─────────────────────────────┘

Step 5: Bob stops typing (2 seconds)
┌─────────────────────────────┐
│  ← ╭───╮ Bob Wilson         │
│     │👤 │ 🟢 Online          │
│     ╰───╯                    │
├─────────────────────────────┤
│                              │
│  (typing indicator gone)     │  ← Indicator disappears
│                              │
└─────────────────────────────┘

Step 6: Bob sends message
┌─────────────────────────────┐
│           Hey Alice! 3:45 PM │  ← Bob's message appears
│                              │
│  (Alice's messages here)     │
└─────────────────────────────┘

Step 7: Bob closes conversation
Back in Messages list:
╭─────╮
│ 👤  │ ⚫  Bob Wilson         ← Dot disappears!
╰─────╯     Hey Alice!
```

## Size & Color Reference

### Online Status Dot
- **Size:** 12-14px diameter
- **Color:** `#2196F3` (blue) - matches app primary color
- **Position:** Bottom-right of avatar, slightly overlapping
- **Border:** 2px white border for contrast

### Typing Indicator
- **Background:** White with subtle border
- **Text:** Gray, 14px, italic
- **Dots:** Blue circles, 6px diameter
- **Animation:** 400ms per dot, continuous loop

### Avatar Sizes (where dot appears)
- **Messages list:** 50px avatar → 14px dot
- **Conversation header:** 40px avatar → 12px dot
- **Small (xs):** 24px avatar → 8px dot

## Debugging: Making It Obvious

If you can't see the dot, temporarily make it HUGE and RED:

```typescript
<View style={{ 
  position: 'absolute', 
  bottom: -2, 
  right: -2,
  backgroundColor: 'red',     // Make it red
  width: 30,                  // Make it bigger
  height: 30,
  borderRadius: 15,
  zIndex: 9999,               // Bring to front
  borderWidth: 3,
  borderColor: 'yellow',      // Yellow border
}}>
  <OnlineStatusDot isOnline={true} size={20} />
</View>
```

If you still don't see it with these settings, the issue is with rendering/subscriptions, not styling.

## Expected Timeline

```
User A opens conversation
         ↓
   WebSocket connects
         ↓ (< 1 second)
 Presence channel subscribes
         ↓ (< 1 second)
   Track online=true
         ↓ (< 1 second)
Other users receive presence sync
         ↓ (< 1 second)
  State updates (isOnline=true)
         ↓ (< 1 second)
   Component re-renders
         ↓
 🟢 Green dot visible!
 
Total time: 2-3 seconds
```

## Common Visual Issues

### Issue: Dot appears but quickly disappears
**Cause:** Presence channel unsubscribing too early
**Fix:** Check cleanup in useEffect dependencies

### Issue: Dot is there but hard to see
**Cause:** Low contrast with avatar
**Fix:** Increase border width or change dot color

### Issue: Typing indicator shows but doesn't animate
**Cause:** Animation not running
**Fix:** Check that Animated.loop is called in useEffect

### Issue: Everything works but text says "User is typing" without name
**Cause:** userName prop not passed correctly
**Fix:** Verify otherUser.fullName is available

## Platform Differences

### iOS
- Dot renders with smooth shadows
- Animations are 60fps
- Haptic feedback available (optional)

### Android
- Dot might have slightly different shadow
- Animations still smooth
- Material Design ripple effects

### Web
- Dot renders with CSS box-shadow
- Animations use CSS transitions
- Hover states available

All platforms should show the same behavior, just with slight styling differences.

## Summary

After the fix, you should see:

**Messages List:**
- 🟢 Green dot next to users in conversations
- Updates within 2-3 seconds

**Conversation:**
- "Online" in header when user is active
- "User is typing..." with animated dots
- Read receipts (✓ ✓✓)

**Timing:**
- Instant: Typing indicator appears/disappears
- 2-3 seconds: Online status updates
- No delay: Read receipts

If you don't see these, check:
1. App fully restarted with cache cleared
2. Console shows "SUBSCRIBED"
3. Two different users/devices for testing
4. Both users have internet connection

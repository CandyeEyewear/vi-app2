# 🚀 Developer Quick Reference

## UI Consistency Fix - Implementation Guide

---

## ✅ What Was Done

### 1. **Pressable Pattern** (Recommended Standard)

**Always use this pattern for buttons:**

```typescript
<Pressable
  style={({ pressed }) => [
    styles.yourButton,
    pressed && { 
      opacity: 0.8, 
      transform: [{ scale: 0.98 }] 
    }
  ]}
  onPress={handleYourAction}
  accessibilityRole="button"
  accessibilityLabel="Descriptive label"
>
  <Text>Your Button</Text>
</Pressable>
```

**Do NOT use:**
```typescript
// ❌ Old pattern - don't use
<TouchableOpacity activeOpacity={0.7} onPress={...}>
```

---

### 2. **Color System** (Always Use Theme)

**Always reference theme colors:**

```typescript
const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

// Use these:
backgroundColor: colors.primary        ✅
borderColor: colors.primary           ✅
color: colors.textOnPrimary          ✅
tintColor: colors.primary            ✅

// Never use:
backgroundColor: '#38B6FF'            ❌
borderColor: '#38B6FF'               ❌
color: '#FFFFFF'                     ❌
```

---

### 3. **AnimatedFilterChip Component**

**For category filters, use this reusable component:**

```typescript
// Add to your file:
import { Check } from 'lucide-react-native';
import { Animated } from 'react-native';

const AnimatedFilterChip = React.memo(({
  label,
  isSelected,
  onPress,
  colors,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  colors: any;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bgAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(bgAnim, { 
      toValue: isSelected ? 1 : 0, 
      duration: 200, 
      useNativeDriver: false 
    }).start();
  }, [isSelected]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  };

  const backgroundColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.card, colors.primary],
  });

  const borderColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Animated.View
          style={[
            styles.filterChip,
            { backgroundColor, borderColor }
          ]}
        >
          {isSelected && (
            <View style={styles.chipCheckmark}>
              <Check size={12} color={colors.textOnPrimary} strokeWidth={3} />
            </View>
          )}
          <Text 
            style={[
              styles.filterChipText, 
              { color: isSelected ? colors.textOnPrimary : colors.text },
              isSelected && styles.filterChipTextSelected
            ]}
          >
            {label}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
});

// Styles:
const styles = StyleSheet.create({
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  chipCheckmark: {
    marginRight: 6,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  filterChipTextSelected: {
    fontWeight: '600',
  },
});
```

**Usage:**
```typescript
{CATEGORIES.map((category) => (
  <AnimatedFilterChip
    key={category.value}
    label={category.label}
    isSelected={selectedCategory === category.value}
    onPress={() => setSelectedCategory(category.value)}
    colors={colors}
  />
))}
```

---

### 4. **Notification Category Colors**

**If adding new notification types:**

```typescript
const getCategoryConfig = (type: string) => {
  switch (type) {
    case 'your_new_type':
      return { 
        icon: YourIcon, 
        color: '#YOUR_COLOR',
        gradient: ['#YOUR_COLOR', '#DARKER_SHADE']
      };
    // ... other cases
  }
};
```

**Current color scheme:**
- Announcements: Blue `#38B6FF`
- Opportunities: Purple `#9C27B0`
- Causes: Pink `#E91E63`
- Events: Orange `#FF9800`
- Circle Requests: Green `#4CAF50`
- Messages: Blue `#38B6FF`

---

### 5. **NEW Badge Pattern**

**For unread items:**

```typescript
{!item.is_read && (
  <View style={[styles.newBadge, { backgroundColor: categoryColor }]}>
    <Sparkles size={10} color="#FFFFFF" />
    <Text style={styles.newBadgeText}>NEW</Text>
  </View>
)}

// Styles:
newBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 8,
  gap: 3,
},
newBadgeText: {
  color: '#FFFFFF',
  fontSize: 10,
  fontWeight: '700',
  letterSpacing: 0.5,
},
```

---

### 6. **Gradient Accent Bars**

**For category-based lists:**

```typescript
import { LinearGradient } from 'expo-linear-gradient';

<View style={styles.card}>
  <LinearGradient
    colors={categoryConfig.gradient}
    start={{ x: 0, y: 0 }}
    end={{ x: 0, y: 1 }}
    style={styles.gradientAccent}
  />
  {/* ... card content */}
</View>

// Styles:
card: {
  position: 'relative',
  overflow: 'hidden',
  // ... other styles
},
gradientAccent: {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: 4,
},
```

---

## 🎯 Checklist for New Components

When creating new interactive components:

- [ ] Use `Pressable` instead of `TouchableOpacity`
- [ ] Add scale transform on press: `{ scale: 0.98 }`
- [ ] Use theme colors: `colors.primary`, not hardcoded
- [ ] Add accessibility labels
- [ ] Test in both light and dark modes
- [ ] If using filters, use `AnimatedFilterChip`
- [ ] Add checkmarks to selected states
- [ ] Use 200ms timing for color transitions
- [ ] Use spring animations with friction: 3

---

## 📝 Common Patterns

### Button with Icon
```typescript
<Pressable
  style={({ pressed }) => [
    styles.button,
    { backgroundColor: colors.primary },
    pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
  ]}
  onPress={handlePress}
>
  <YourIcon size={16} color="#FFFFFF" />
  <Text style={styles.buttonText}>Button Text</Text>
</Pressable>
```

### Icon-Only Button
```typescript
<Pressable
  onPress={handlePress}
  style={({ pressed }) => [
    styles.iconButton,
    pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }
  ]}
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
>
  <YourIcon size={20} color={colors.primary} />
</Pressable>
```

### Card with Press Feedback
```typescript
<Pressable
  style={({ pressed }) => [
    styles.card,
    { backgroundColor: colors.card, borderColor: colors.border },
    pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }
  ]}
  onPress={onPress}
>
  {/* Card content */}
</Pressable>
```

---

## 🚫 Anti-Patterns to Avoid

### ❌ Don't Do This:
```typescript
// Hardcoded colors
backgroundColor: '#38B6FF'

// Old TouchableOpacity
<TouchableOpacity activeOpacity={0.7}>

// No press feedback
<Pressable onPress={...}>
  <View style={styles.button}>

// Inconsistent chip styles
<TouchableOpacity style={[
  { backgroundColor: isSelected ? 'blue' : 'gray' }
]}>
```

### ✅ Do This Instead:
```typescript
// Theme colors
backgroundColor: colors.primary

// Modern Pressable
<Pressable style={({ pressed }) => [
  styles.button,
  pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
]}>

// Proper press feedback
<Pressable
  style={({ pressed }) => [
    styles.button,
    pressed && pressedStyle
  ]}
  onPress={...}
>

// AnimatedFilterChip component
<AnimatedFilterChip
  label={label}
  isSelected={isSelected}
  onPress={onPress}
  colors={colors}
/>
```

---

## 🔍 Testing Checklist

Before submitting PR:

- [ ] Run linter: No errors
- [ ] Test light mode: Colors correct
- [ ] Test dark mode: Colors correct
- [ ] Test press feedback: Smooth animations
- [ ] Test on iOS: Works as expected
- [ ] Test on Android: Works as expected
- [ ] Test on Web: Works as expected
- [ ] Verify no hardcoded colors: Use grep
- [ ] Verify no TouchableOpacity: Use grep
- [ ] Check accessibility labels: Present

---

## 📚 Files to Reference

**Good Examples:**
- `app/(tabs)/discover.tsx` - AnimatedFilterChip master
- `app/notifications.tsx` - Category colors & gradients
- `components/cards/EventCard.tsx` - Pressable pattern
- `components/CausesList.tsx` - Filter chip implementation
- `components/EventsList.tsx` - Filter chip implementation

---

## 🆘 Need Help?

**Check these docs:**
- `UI_CONSISTENCY_FIX_COMPLETE.md` - Full overview
- `BEFORE_AFTER_COMPARISON.md` - Visual guide
- This file - Quick patterns

**Common Issues:**

1. **"My colors don't work in dark mode"**
   - Use `colors.primary` not `'#38B6FF'`

2. **"My chip doesn't animate"**
   - Use `AnimatedFilterChip` component

3. **"My button feels laggy"**
   - Check if using `useNativeDriver: true` for transforms

4. **"My press feedback is different"**
   - Use standard: `{ opacity: 0.8, transform: [{ scale: 0.98 }] }`

---

## 🎉 Summary

**Key Principles:**
1. Always use `Pressable` (not TouchableOpacity)
2. Always use theme colors (not hardcoded)
3. Always add press feedback (scale + opacity)
4. Always test dark mode
5. Always use `AnimatedFilterChip` for filters

**Result:** Consistent, modern, maintainable UI! 🚀

---

*Developer Quick Reference - December 3, 2025*

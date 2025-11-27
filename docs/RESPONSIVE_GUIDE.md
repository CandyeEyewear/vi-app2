# Responsive Design Guide

This guide explains how to optimize the app for both mobile and web platforms.

## Quick Start

### 1. Use the `useResponsive` Hook

```tsx
import { useResponsive } from '../hooks/useResponsive';

function MyComponent() {
  const { isWeb, width, breakpoint, isSmallScreen, showSidebar } = useResponsive();
  
  return (
    <View style={{ padding: isWeb ? 24 : 16 }}>
      {/* Your content */}
    </View>
  );
}
```

### 2. Use Responsive Container

```tsx
import ResponsiveContainer from '../components/ResponsiveContainer';

function MyScreen() {
  return (
    <ResponsiveContainer padding={16} maxWidth={1200}>
      {/* Your content - automatically centered on web */}
    </ResponsiveContainer>
  );
}
```

### 3. Use Web Layout (for complex layouts)

```tsx
import WebLayout from '../components/WebLayout';

function MyScreen() {
  return (
    <WebLayout sidebar={<SidebarContent />}>
      {/* Main content */}
    </WebLayout>
  );
}
```

## Platform Detection

### Direct Platform Checks

```tsx
import { isWeb, isIOS, isAndroid, isMobile, isTablet } from '../utils/platform';

if (isWeb) {
  // Web-specific code
}

if (isMobile) {
  // Mobile-specific code
}
```

### Responsive Values

```tsx
import { responsiveValue } from '../utils/platform';

const padding = responsiveValue(16, 24, 32); // mobile, tablet, desktop
const fontSize = responsiveValue(14, 16, 18);
```

## Breakpoints

The app uses these breakpoints:
- `xs`: < 576px (small phones)
- `sm`: ≥ 576px (large phones)
- `md`: ≥ 768px (tablets)
- `lg`: ≥ 992px (small desktops)
- `xl`: ≥ 1200px (desktops)
- `xxl`: ≥ 1400px (large desktops)

## Best Practices

### 1. Mobile-First Design
Always design for mobile first, then enhance for larger screens:

```tsx
const styles = StyleSheet.create({
  container: {
    padding: 16, // Mobile default
    ...(isWeb && {
      padding: 24, // Web enhancement
      maxWidth: 1200,
    }),
  },
});
```

### 2. Touch vs Click
- Use `TouchableOpacity` for mobile (works on web too)
- Consider hover states for web:

```tsx
<TouchableOpacity
  style={[
    styles.button,
    isWeb && {
      cursor: 'pointer',
      ':hover': { opacity: 0.8 }, // Web hover
    },
  ]}
>
```

### 3. Layout Patterns

#### Cards Grid
```tsx
const numColumns = responsiveValue(1, 2, 3); // 1 col mobile, 2 tablet, 3 desktop
<FlatList numColumns={numColumns} ... />
```

#### Sidebar Navigation
```tsx
const { showSidebar } = useResponsive();

{showSidebar ? (
  <SidebarNavigation />
) : (
  <TabBar />
)}
```

### 4. Typography
```tsx
const fontSize = responsiveValue(16, 18, 20);
const lineHeight = fontSize * 1.5;
```

### 5. Spacing
```tsx
import { getResponsiveSpacing } from '../utils/platform';

const padding = getResponsiveSpacing(16, 24, 32);
```

## Common Patterns

### Responsive Screen Container
```tsx
import { useResponsive } from '../hooks/useResponsive';
import ResponsiveContainer from '../components/ResponsiveContainer';

function MyScreen() {
  const { isWeb } = useResponsive();
  
  return (
    <ResponsiveContainer
      maxWidth={1200}
      padding={isWeb ? { horizontal: 24, vertical: 16 } : 16}
      centered={isWeb}
    >
      {/* Screen content */}
    </ResponsiveContainer>
  );
}
```

### Responsive FlatList Columns
```tsx
const { width, isWeb } = useResponsive();
const numColumns = useMemo(() => {
  if (isWeb) {
    if (width >= 1400) return 4;
    if (width >= 992) return 3;
    return 2;
  }
  return 1;
}, [width, isWeb]);
```

### Conditional Rendering
```tsx
const { isWeb, isSmallScreen } = useResponsive();

{isWeb && !isSmallScreen && <DesktopSidebar />}
{!isWeb && <MobileTabBar />}
```

## Testing

1. **Mobile**: Test on various screen sizes (iPhone SE, iPhone 14, iPad)
2. **Web**: Test at different browser widths:
   - Mobile: 375px - 767px
   - Tablet: 768px - 991px
   - Desktop: 992px+
3. **Interaction**: Test touch vs mouse interactions

## Performance Tips

1. Use `useMemo` for responsive calculations
2. Avoid re-renders with proper dependency arrays
3. Use `StyleSheet.create` for styles (better performance)
4. Consider lazy loading for web-only features

## Migration Checklist

When updating existing screens:
- [ ] Add `useResponsive` hook
- [ ] Replace hardcoded `Dimensions.get('window')` calls
- [ ] Wrap content in `ResponsiveContainer` if needed
- [ ] Test on mobile and web
- [ ] Check breakpoints at different sizes
- [ ] Verify touch/click interactions work


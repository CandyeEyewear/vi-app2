/**
 * Admin Events Layout
 * File: app/admin/events/_layout.tsx
 */

import { Stack } from 'expo-router';

export default function AdminEventsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}

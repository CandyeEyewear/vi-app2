/**
 * Root App Layout
 * Wraps the entire app with providers
 */

import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { AuthProvider } from '../contexts/AuthContext';
import { FeedProvider } from '../contexts/FeedContext';
import { MessagingProvider } from '../contexts/MessagingContext';

function AppContent() {
  const router = useRouter();
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      if (data.type && data.id) {
        switch (data.type) {
          case 'circle_request':
            router.push(`/profile/${data.id}` as any);
            break;
          case 'announcement':
            router.push('/(tabs)' as any);
            break;
          case 'opportunity':
            router.push(`/opportunity/${data.id}` as any);
            break;
          case 'message':
            router.push(`/conversation/${data.id}` as any);
            break;
          case 'post':
            router.push(`/post/${data.id}` as any);
            break;
        }
      }
    });

    // Deep link handler
    const handleDeepLink = (event: { url: string }) => {
      console.log('[DEEP LINK] Received:', event.url);
      const parsed = Linking.parse(event.url);
      
      // Handle vi-app://post/[id] format
      if (parsed.path) {
        const pathParts = parsed.path.split('/').filter(Boolean);
        if (pathParts[0] === 'post' && pathParts[1]) {
          const postId = pathParts[1];
          console.log('[DEEP LINK] Navigating to post:', postId);
          router.push(`/post/${postId}` as any);
          return;
        }
      }
      
      // Fallback: check queryParams
      if (parsed.queryParams?.id) {
        const postId = Array.isArray(parsed.queryParams.id) ? parsed.queryParams.id[0] : parsed.queryParams.id;
        console.log('[DEEP LINK] Navigating to post (from query):', postId);
        router.push(`/post/${postId}` as any);
      }
    };

    // Handle initial URL (app opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('[DEEP LINK] Initial URL:', url);
        handleDeepLink({ url });
      }
    });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      subscription.remove();
    };
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="conversation/[id]" />
      <Stack.Screen name="opportunity/[id]" />
      <Stack.Screen name="profile/[id]" />
      <Stack.Screen name="post/[id]" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <FeedProvider>
        <MessagingProvider>
          <AppContent />
        </MessagingProvider>
      </FeedProvider>
    </AuthProvider>
  );
}
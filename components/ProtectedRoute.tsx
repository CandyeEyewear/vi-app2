/**
 * Protected Route Component
 * Wraps routes that require authentication
 * Automatically redirects to login if user is not authenticated
 */

import { useEffect } from 'react';
import { useRouter, useSegments, usePathname } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

  // Define public routes
  const publicRoutes = ['login', 'register', 'forgot-password', 'reset-password'];
  const currentRoute = segments[0] || pathname?.split('/')[1] || '';
  const isPublicRoute = publicRoutes.includes(currentRoute);

  useEffect(() => {
    if (!loading) {
      if (!user && !isPublicRoute) {
        // Redirect to login if not authenticated and not on a public route
        router.replace('/login');
      }
    }
  }, [loading, user, isPublicRoute, currentRoute, router, pathname]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.light.background }}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  // Don't render protected content if user is not authenticated
  if (!user && !isPublicRoute) {
    return null; // Will redirect via useEffect
  }

  return <>{children}</>;
}


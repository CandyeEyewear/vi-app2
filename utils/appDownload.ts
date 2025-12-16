/**
 * App Download Detection and Deep Linking Utilities
 * Detects mobile browsers and handles app opening/download prompts
 */

import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

// App configuration
const APP_SCHEME = 'vibe';
const IOS_BUNDLE_ID = 'org.volunteersinc.vibe';
const ANDROID_PACKAGE = 'org.volunteersinc.vibe';

// App Store URLs
// TODO: Update IOS_APP_STORE_URL with your actual App Store ID after publishing to the App Store
// You can find your App Store ID in App Store Connect or in your app's App Store URL
const IOS_APP_STORE_URL = 'https://apps.apple.com/app/id/YOUR_APP_ID'; // Replace YOUR_APP_ID with your actual App Store ID
// Android Play Store URL (verify this matches your package name)
const ANDROID_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=org.volunteersinc.vibe';

/**
 * Detects if the user is on a mobile device using user agent
 */
export function isMobileDevice(): boolean {
  if (!Platform.OS || Platform.OS !== 'web') {
    return false;
  }

  if (typeof window === 'undefined' || !window.navigator) {
    return false;
  }

  const userAgent = window.navigator.userAgent || window.navigator.vendor || (window as any).opera;
  
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
}

/**
 * Detects if the user is on iOS
 */
export function isIOSDevice(): boolean {
  if (!Platform.OS || Platform.OS !== 'web') {
    return false;
  }

  if (typeof window === 'undefined' || !window.navigator) {
    return false;
  }

  const userAgent = window.navigator.userAgent || window.navigator.vendor || (window as any).opera;
  
  return /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
}

/**
 * Detects if the user is on Android
 */
export function isAndroidDevice(): boolean {
  if (!Platform.OS || Platform.OS !== 'web') {
    return false;
  }

  if (typeof window === 'undefined' || !window.navigator) {
    return false;
  }

  const userAgent = window.navigator.userAgent || window.navigator.vendor || (window as any).opera;
  
  return /android/i.test(userAgent);
}

/**
 * Attempts to open the app using deep linking
 * Falls back to app store if app is not installed
 */
export async function openApp(path: string = ''): Promise<void> {
  try {
    const deepLink = path ? `${APP_SCHEME}://${path}` : `${APP_SCHEME}://`;
    
    // On web mobile, try to open the app directly
    // The browser will handle the deep link attempt
    if (Platform.OS === 'web' && isMobileDevice() && typeof window !== 'undefined') {
      // Use expo-linking which works on web
      await Linking.openURL(deepLink);
      
      // Set a timeout to redirect to store if app doesn't open
      // On mobile, if the app opens, the page will lose focus
      setTimeout(() => {
        if (document.hasFocus()) {
          // Page still has focus, app likely didn't open
          openAppStore();
        }
      }, 2500);
    } else {
      // On native platforms, check if we can open the URL first
      const canOpen = await Linking.canOpenURL(deepLink);
      if (canOpen) {
        await Linking.openURL(deepLink);
      } else if (Platform.OS === 'web') {
        // On web desktop or if can't open, redirect to store
        openAppStore();
      }
    }
  } catch (error) {
    console.error('Error opening app:', error);
    // Fallback to app store on web
    if (Platform.OS === 'web') {
      openAppStore();
    }
  }
}

/**
 * Opens the appropriate app store based on platform
 */
export function openAppStore(): void {
  if (Platform.OS !== 'web') {
    return;
  }

  const url = isIOSDevice() ? IOS_APP_STORE_URL : ANDROID_PLAY_STORE_URL;
  
  if (typeof window !== 'undefined' && url) {
    window.open(url, '_blank');
  }
}

/**
 * Gets the current page path for deep linking
 */
export function getCurrentPath(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return '';
  }

  // Remove leading slash and query params for cleaner deep links
  const path = window.location.pathname.slice(1);
  const search = window.location.search;
  
  if (search) {
    // Convert query params to a format suitable for deep linking
    const params = new URLSearchParams(search);
    const paramString = Array.from(params.entries())
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    return path ? `${path}?${paramString}` : paramString;
  }
  
  return path;
}


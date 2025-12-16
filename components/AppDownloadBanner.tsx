/**
 * App Download Banner Component
 * Shows a banner prompting users to open the app or download it from app stores
 * Only displays on mobile web browsers
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { useColorScheme } from 'react-native';
import { X, Smartphone, ExternalLink } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { isMobileDevice, isIOSDevice, isAndroidDevice, openApp, openAppStore, getCurrentPath } from '../utils/appDownload';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BANNER_DISMISSED_KEY = '@app_download_banner_dismissed';
const BANNER_DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

interface AppDownloadBannerProps {
  /** Custom message to display */
  message?: string;
  /** Whether to show the banner even if dismissed */
  forceShow?: boolean;
}

export default function AppDownloadBanner({ message, forceShow = false }: AppDownloadBannerProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { width } = useWindowDimensions();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Only show on web and mobile devices
    if (Platform.OS !== 'web' || !isMobileDevice()) {
      return;
    }

    // Check if banner was dismissed
    const checkDismissed = async () => {
      if (forceShow) {
        setIsVisible(true);
        return;
      }

      try {
        const dismissedTime = await AsyncStorage.getItem(BANNER_DISMISSED_KEY);
        if (dismissedTime) {
          const dismissedTimestamp = parseInt(dismissedTime, 10);
          const now = Date.now();
          const timeSinceDismiss = now - dismissedTimestamp;

          // Show again after 7 days
          if (timeSinceDismiss < BANNER_DISMISS_DURATION) {
            setIsDismissed(true);
            setIsVisible(false);
            return;
          }
        }
        setIsVisible(true);
      } catch (error) {
        console.error('Error checking banner dismissed state:', error);
        setIsVisible(true);
      }
    };

    checkDismissed();
  }, [forceShow]);

  const handleDismiss = async () => {
    setIsVisible(false);
    setIsDismissed(true);
    
    try {
      await AsyncStorage.setItem(BANNER_DISMISSED_KEY, Date.now().toString());
    } catch (error) {
      console.error('Error saving banner dismissed state:', error);
    }
  };

  const handleOpenApp = async () => {
    const currentPath = getCurrentPath();
    await openApp(currentPath);
  };

  const handleDownload = () => {
    openAppStore();
  };

  // Don't render if not visible
  if (!isVisible || isDismissed) {
    return null;
  }

  // Don't show on desktop
  if (width >= 768) {
    return null;
  }

  const platformName = isIOSDevice() ? 'iOS' : isAndroidDevice() ? 'Android' : 'mobile';
  const displayMessage = message || `Get the best experience with our ${platformName} app`;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Smartphone size={20} color={colors.primary} />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text }]}>VIbe App</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>{displayMessage}</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.openButton, { backgroundColor: colors.primary }]}
            onPress={handleOpenApp}
            activeOpacity={0.7}
          >
            <Text style={styles.openButtonText}>Open</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.downloadButton, { borderColor: colors.border }]}
            onPress={handleDownload}
            activeOpacity={0.7}
          >
            <ExternalLink size={16} color={colors.primary} />
            <Text style={[styles.downloadButtonText, { color: colors.primary }]}>Get App</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  iconContainer: {
    marginRight: 4,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
    lineHeight: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  openButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  downloadButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dismissButton: {
    padding: 4,
    marginLeft: 4,
  },
});


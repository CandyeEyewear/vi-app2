/**
 * Platform Detection and Responsive Utilities
 * Provides utilities for platform detection and responsive design
 */

import { Platform, Dimensions, useWindowDimensions } from 'react-native';

// Platform detection
export const isWeb = Platform.OS === 'web';
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isMobile = !isWeb;
export const isTablet = isWeb ? false : Dimensions.get('window').width >= 768;

// Get screen dimensions
export const getScreenDimensions = () => {
  const { width, height } = Dimensions.get('window');
  return { width, height };
};

// Breakpoints for responsive design
export const BREAKPOINTS = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1400,
};

// Get current breakpoint
export const getBreakpoint = (width?: number) => {
  const screenWidth = width || Dimensions.get('window').width;
  
  if (screenWidth >= BREAKPOINTS.xxl) return 'xxl';
  if (screenWidth >= BREAKPOINTS.xl) return 'xl';
  if (screenWidth >= BREAKPOINTS.lg) return 'lg';
  if (screenWidth >= BREAKPOINTS.md) return 'md';
  if (screenWidth >= BREAKPOINTS.sm) return 'sm';
  return 'xs';
};

// Check if screen is above a breakpoint
export const isBreakpoint = (breakpoint: keyof typeof BREAKPOINTS, width?: number) => {
  const screenWidth = width || Dimensions.get('window').width;
  return screenWidth >= BREAKPOINTS[breakpoint];
};

// Responsive value helper
export const responsiveValue = <T,>(
  mobile: T,
  tablet?: T,
  desktop?: T,
  width?: number
): T => {
  const screenWidth = width || Dimensions.get('window').width;
  const currentBreakpoint = getBreakpoint(screenWidth);
  
  if (isWeb && desktop && currentBreakpoint >= 'lg') {
    return desktop;
  }
  
  if ((isTablet || currentBreakpoint >= 'md') && tablet !== undefined) {
    return tablet;
  }
  
  return mobile;
};

// Max content width for web
export const MAX_CONTENT_WIDTH = 1200;
export const WEB_SIDEBAR_WIDTH = 280;

// Get optimal content width for web
export const getContentWidth = (fullWidth?: number) => {
  if (!isWeb) return '100%';
  
  const screenWidth = fullWidth || Dimensions.get('window').width;
  if (screenWidth >= MAX_CONTENT_WIDTH) {
    return MAX_CONTENT_WIDTH;
  }
  return screenWidth;
};

// Check if should show sidebar on web
export const shouldShowSidebar = (width?: number) => {
  if (!isWeb) return false;
  const screenWidth = width || Dimensions.get('window').width;
  return screenWidth >= BREAKPOINTS.xl;
};

// Spacing scale for responsive padding/margins
export const getResponsiveSpacing = (
  mobile: number,
  tablet?: number,
  desktop?: number
): number => {
  return responsiveValue(mobile, tablet, desktop);
};

// Font size scale
export const getResponsiveFontSize = (
  mobile: number,
  tablet?: number,
  desktop?: number
): number => {
  return responsiveValue(mobile, tablet, desktop);
};


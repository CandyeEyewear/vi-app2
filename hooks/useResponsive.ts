/**
 * useResponsive Hook
 * Provides responsive design values based on screen size and platform
 */

import { useState, useEffect } from 'react';
import { Dimensions, ScaledSize } from 'react-native';
import {
  getBreakpoint,
  isBreakpoint,
  responsiveValue,
  shouldShowSidebar,
  getContentWidth,
  isWeb,
  isTablet,
  BREAKPOINTS,
} from '../utils/platform';

export interface ResponsiveValues {
  // Platform
  isWeb: boolean;
  isMobile: boolean;
  isTablet: boolean;
  
  // Dimensions
  width: number;
  height: number;
  breakpoint: string;
  
  // Responsive checks
  isXs: boolean;
  isSm: boolean;
  isMd: boolean;
  isLg: boolean;
  isXl: boolean;
  isXxl: boolean;
  
  // Layout helpers
  contentWidth: number | string;
  showSidebar: boolean;
  isSmallScreen: boolean;
  isLargeScreen: boolean;
}

export function useResponsive(): ResponsiveValues {
  const [dimensions, setDimensions] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }: { window: ScaledSize }) => {
      setDimensions({ width: window.width, height: window.height });
    });

    return () => subscription?.remove();
  }, []);

  const breakpoint = getBreakpoint(dimensions.width);
  const contentWidth = getContentWidth(dimensions.width);
  const showSidebar = shouldShowSidebar(dimensions.width);
  
  const isSmallScreen = dimensions.width < BREAKPOINTS.md;
  const isLargeScreen = dimensions.width >= BREAKPOINTS.lg;

  return {
    // Platform
    isWeb,
    isMobile: !isWeb,
    isTablet,
    
    // Dimensions
    width: dimensions.width,
    height: dimensions.height,
    breakpoint,
    
    // Responsive checks
    isXs: breakpoint === 'xs',
    isSm: breakpoint === 'sm',
    isMd: breakpoint === 'md',
    isLg: breakpoint === 'lg',
    isXl: breakpoint === 'xl',
    isXxl: breakpoint === 'xxl',
    
    // Layout helpers
    contentWidth,
    showSidebar,
    isSmallScreen,
    isLargeScreen,
  };
}

// Helper hook for responsive values
export function useResponsiveValue<T>(
  mobile: T,
  tablet?: T,
  desktop?: T
): T {
  const { width } = useResponsive();
  return responsiveValue(mobile, tablet, desktop, width);
}


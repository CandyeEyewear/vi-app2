/**
 * Hook to get the real visible viewport height on mobile web
 * Uses visualViewport API which accounts for:
 * - Browser address bar
 * - Virtual keyboard
 * - Bottom navigation bar
 */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

interface ViewportDimensions {
  height: number;
  width: number;
  isKeyboardVisible: boolean;
}

export function useMobileWebViewport(): ViewportDimensions {
  const [dimensions, setDimensions] = useState<ViewportDimensions>({
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    isKeyboardVisible: false,
  });

  useEffect(() => {
    // Only run on web
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const updateViewport = () => {
      const viewport = window.visualViewport;

      if (viewport) {
        const newHeight = viewport.height;
        const fullHeight = window.innerHeight;

        // Keyboard is likely visible if viewport height is significantly less than window height
        const isKeyboardVisible = fullHeight - newHeight > 150;

        setDimensions({
          height: newHeight,
          width: viewport.width,
          isKeyboardVisible,
        });

        // Update CSS custom property for use in stylesheets
        document.documentElement.style.setProperty('--viewport-height', `${newHeight}px`);
      } else {
        // Fallback for browsers without visualViewport
        setDimensions({
          height: window.innerHeight,
          width: window.innerWidth,
          isKeyboardVisible: false,
        });
        document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
      }
    };

    // Initial update
    updateViewport();

    // Listen to visualViewport events
    const viewport = window.visualViewport;
    if (viewport) {
      viewport.addEventListener('resize', updateViewport);
      viewport.addEventListener('scroll', updateViewport);
    }

    // Also listen to window resize as fallback
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);

    return () => {
      if (viewport) {
        viewport.removeEventListener('resize', updateViewport);
        viewport.removeEventListener('scroll', updateViewport);
      }
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  return dimensions;
}

export default useMobileWebViewport;

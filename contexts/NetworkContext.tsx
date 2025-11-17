/**
 * Network Context
 * Provides global network status and offline handling
 * 
 * Note: Using a simple fetch-based approach instead of NetInfo
 * to avoid native dependency issues. Can be upgraded to NetInfo later.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';

interface NetworkContextType {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string | null;
  isOffline: boolean;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [networkState, setNetworkState] = useState({
    isConnected: true,
    isInternetReachable: true,
    type: null as string | null,
    details: null as any,
  });

  useEffect(() => {
    let isMounted = true;
    let checkInterval: NodeJS.Timeout;

    // Simple network check using fetch
    const checkNetworkStatus = async () => {
      try {
        // Try to fetch a small resource to check connectivity
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

        const response = await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal,
          cache: 'no-cache',
        });

        clearTimeout(timeoutId);

        if (isMounted) {
          setNetworkState({
            isConnected: true,
            isInternetReachable: true,
            type: null,
            details: null,
          });
        }
      } catch (error) {
        if (isMounted) {
          setNetworkState({
            isConnected: false,
            isInternetReachable: false,
            type: null,
            details: null,
          });
        }
      }
    };

    // Check immediately
    checkNetworkStatus();

    // Check every 10 seconds
    checkInterval = setInterval(checkNetworkStatus, 10000);

    // Also listen to online/offline events if available (web only)
    // Use Platform.OS check instead of typeof window for React Native compatibility
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => {
        if (isMounted) {
          setNetworkState(prev => ({
            ...prev,
            isConnected: true,
            isInternetReachable: true,
          }));
        }
      };

      const handleOffline = () => {
        if (isMounted) {
          setNetworkState(prev => ({
            ...prev,
            isConnected: false,
            isInternetReachable: false,
          }));
        }
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        isMounted = false;
        if (checkInterval) {
          clearInterval(checkInterval);
        }
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    // For React Native, rely on fetch-based polling only
    // Optionally, you can add NetInfo support here if the package is installed
    // Example:
    // try {
    //   const NetInfo = require('@react-native-community/netinfo').default;
    //   const unsubscribe = NetInfo.addEventListener(state => {
    //     if (isMounted) {
    //       setNetworkState({
    //         isConnected: state.isConnected ?? false,
    //         isInternetReachable: state.isInternetReachable ?? false,
    //         type: state.type,
    //         details: state.details,
    //       });
    //     }
    //   });
    //   return () => {
    //     isMounted = false;
    //     if (checkInterval) {
    //       clearInterval(checkInterval);
    //     }
    //     unsubscribe();
    //   };
    // } catch (e) {
    //   // NetInfo not available, fall back to fetch-based polling
    // }

    return () => {
      isMounted = false;
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, []);

  const value: NetworkContextType = {
    isConnected: networkState.isConnected ?? false,
    isInternetReachable: networkState.isInternetReachable ?? false,
    type: networkState.type,
    isOffline: !networkState.isConnected || !networkState.isInternetReachable,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextType {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}


/**
 * User Status Utilities
 * Helper functions for determining online status
 */

/**
 * Determines if a user is currently online based on their last_seen timestamp
 * A user is considered online if they were active within the last 60 seconds
 * 
 * @param lastSeen - ISO timestamp string of when the user was last seen
 * @returns boolean indicating if the user is currently online
 */
export function isUserOnline(lastSeen?: string): boolean {
  if (!lastSeen) return false;
  
  try {
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeenDate.getTime();
    
    // User is online if last seen within 60 seconds
    const ONLINE_THRESHOLD_MS = 60 * 1000; // 60 seconds
    
    return diffMs < ONLINE_THRESHOLD_MS;
  } catch (error) {
    console.error('Error parsing lastSeen date:', error);
    return false;
  }
}

/**
 * Formats the last seen time in a human-readable format
 * e.g., "Active now", "Active 5m ago", "Active 2h ago", "Active yesterday"
 * 
 * @param lastSeen - ISO timestamp string of when the user was last seen
 * @returns formatted string
 */
export function formatLastSeen(lastSeen?: string): string {
  if (!lastSeen) return 'Offline';
  
  try {
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMs < 60000) return 'Active now';
    if (diffMinutes < 60) return `Active ${diffMinutes}m ago`;
    if (diffHours < 24) return `Active ${diffHours}h ago`;
    if (diffDays === 1) return 'Active yesterday';
    if (diffDays < 7) return `Active ${diffDays}d ago`;
    
    return 'Offline';
  } catch (error) {
    console.error('Error formatting lastSeen date:', error);
    return 'Offline';
  }
}

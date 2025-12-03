/**
 * Event Categories Configuration
 * Shared constants for event category colors, labels, and emojis
 * File: constants/eventCategories.ts
 */

import { EventCategory } from '../types';

/**
 * Category color palette
 * These are the base colors for each event category
 */
export const EventCategoryColors = {
  meetup: '#2196F3',
  gala: '#9C27B0',
  fundraiser: '#E91E63',
  workshop: '#FF9800',
  celebration: '#4CAF50',
  networking: '#00BCD4',
  other: '#757575',
} as const;

/**
 * Complete category configuration
 * Used across all event components for consistent rendering
 */
export const EVENT_CATEGORY_CONFIG: Record<
  EventCategory, 
  { label: string; color: string; emoji: string }
> = {
  meetup: { 
    label: 'Meetup', 
    color: EventCategoryColors.meetup, 
    emoji: '🤝' 
  },
  gala: { 
    label: 'Gala', 
    color: EventCategoryColors.gala, 
    emoji: '✨' 
  },
  fundraiser: { 
    label: 'Fundraiser', 
    color: EventCategoryColors.fundraiser, 
    emoji: '💝' 
  },
  workshop: { 
    label: 'Workshop', 
    color: EventCategoryColors.workshop, 
    emoji: '🛠️' 
  },
  celebration: { 
    label: 'Celebration', 
    color: EventCategoryColors.celebration, 
    emoji: '🎉' 
  },
  networking: { 
    label: 'Networking', 
    color: EventCategoryColors.networking, 
    emoji: '🔗' 
  },
  other: { 
    label: 'Event', 
    color: EventCategoryColors.other, 
    emoji: '📅' 
  },
};

/**
 * Get category configuration with optional dark mode adjustment
 * @param category - The event category
 * @param isDark - Whether dark mode is active (future enhancement)
 */
export function getCategoryConfig(
  category: EventCategory,
  isDark: boolean = false
): { label: string; color: string; emoji: string } {
  const config = EVENT_CATEGORY_CONFIG[category] || EVENT_CATEGORY_CONFIG.other;
  
  // Future: Could adjust colors for dark mode if needed
  // For now, return base config
  return config;
}

/**
 * Get just the color for a category
 * Useful for inline styles
 */
export function getCategoryColor(category: EventCategory): string {
  return EVENT_CATEGORY_CONFIG[category]?.color || EventCategoryColors.other;
}

/**
 * Get category label
 */
export function getCategoryLabel(category: EventCategory): string {
  return EVENT_CATEGORY_CONFIG[category]?.label || 'Event';
}

/**
 * Get category emoji
 */
export function getCategoryEmoji(category: EventCategory): string {
  return EVENT_CATEGORY_CONFIG[category]?.emoji || '📅';
}

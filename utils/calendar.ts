/**
 * Calendar utility for adding events to device calendar
 * Uses expo-calendar for cross-platform calendar integration
 */

import { Platform, Linking, Alert } from 'react-native';

// Lazy load expo-calendar to prevent route registration errors
// This prevents the native module from being loaded during route registration
let CalendarModule: any = null;
const getCalendar = async (): Promise<any> => {
  if (CalendarModule !== null) {
    return CalendarModule === false ? null : CalendarModule;
  }
  
  if (Platform.OS === 'web') {
    CalendarModule = false; // Mark as checked, not available
    return null;
  }
  
  try {
    // Dynamic import - only loads when function is called, not at module load time
    // expo-calendar uses named exports at the root level
    const calendarModule = await import('expo-calendar');
    
    // expo-calendar exports are at root level, try both default and direct access
    let module = calendarModule;
    
    // If there's a default export, use it; otherwise use the module itself
    if (calendarModule.default && typeof calendarModule.default.getCalendarPermissionsAsync === 'function') {
      module = calendarModule.default;
    } else if (typeof calendarModule.getCalendarPermissionsAsync !== 'function') {
      // Neither structure works, log for debugging
      console.warn('[Calendar] expo-calendar module structure unexpected. Available keys:', Object.keys(calendarModule));
      CalendarModule = false;
      return null;
    }
    
    CalendarModule = module;
    return module;
  } catch (error: any) {
    // If it's a native module error on web, that's expected
    if (error?.message?.includes('native module') || error?.message?.includes('ExpoCalendar')) {
      console.log('[Calendar] expo-calendar native module not available (expected on web)');
    } else {
      console.warn('[Calendar] expo-calendar import failed:', error);
    }
    CalendarModule = false; // Mark as checked, not available
    return null;
  }
};

export interface CalendarEvent {
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
  timeZone?: string;
}

/**
 * Request calendar permissions
 */
export async function requestCalendarPermissions(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      // Web doesn't support native calendar, use calendar link instead
      return false;
    }

    const CalendarModule = await getCalendar();
    if (!CalendarModule || !CalendarModule.requestCalendarPermissionsAsync) {
      return false;
    }

    const { status } = await CalendarModule.requestCalendarPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting calendar permissions:', error);
    return false;
  }
}

/**
 * Check if calendar permissions are granted
 */
export async function hasCalendarPermissions(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      return false;
    }

    const CalendarModule = await getCalendar();
    if (!CalendarModule) return false;

    const { status } = await CalendarModule.getCalendarPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error checking calendar permissions:', error);
    return false;
  }
}

/**
 * Get default calendar for the device
 */
async function getDefaultCalendar(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return null;
    }

    const CalendarModule = await getCalendar();
    if (!CalendarModule || !CalendarModule.getCalendarsAsync || !CalendarModule.EntityTypes) {
      return null;
    }

    const calendars = await CalendarModule.getCalendarsAsync(CalendarModule.EntityTypes.EVENT);
    if (calendars.length === 0) {
      return null;
    }

    // Prefer default calendar or first writable calendar
    const defaultCalendar = calendars.find(cal => cal.isPrimary) || calendars.find(cal => cal.allowsModifications);
    return defaultCalendar?.id || calendars[0]?.id || null;
  } catch (error) {
    console.error('Error getting default calendar:', error);
    return null;
  }
}

/**
 * Add event to device calendar
 */
export async function addEventToCalendar(event: CalendarEvent): Promise<{ success: boolean; error?: string }> {
  try {
    if (Platform.OS === 'web') {
      // For web, generate a calendar link (ICS file or Google Calendar link)
      return addEventViaCalendarLink(event);
    }

    // Check permissions
    const hasPermission = await hasCalendarPermissions();
    if (!hasPermission) {
      const granted = await requestCalendarPermissions();
      if (!granted) {
        return { success: false, error: 'Calendar permissions are required to add events' };
      }
    }

    // Get default calendar
    const calendarId = await getDefaultCalendar();
    if (!calendarId) {
      return { success: false, error: 'No calendar available on this device' };
    }

    // Get calendar module
    const CalendarModule = await getCalendar();
    if (!CalendarModule || !CalendarModule.createEventAsync || !CalendarModule.AlarmMethod) {
      return { success: false, error: 'Calendar module not available' };
    }

    // Create calendar event
    const eventId = await CalendarModule.createEventAsync(calendarId, {
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.location,
      notes: event.notes,
      timeZone: event.timeZone,
      alarms: [
        { relativeOffset: -1440, method: CalendarModule.AlarmMethod.ALERT }, // 1 day before
        { relativeOffset: -60, method: CalendarModule.AlarmMethod.ALERT }, // 1 hour before
      ],
    });

    return { success: true };
  } catch (error) {
    console.error('Error adding event to calendar:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add event to calendar',
    };
  }
}

/**
 * Generate calendar link for web platforms
 * Creates a Google Calendar link that can be opened in browser
 */
function addEventViaCalendarLink(event: CalendarEvent): { success: boolean; error?: string } {
  try {
    // Format dates for Google Calendar URL
    const formatDate = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const startDate = formatDate(event.startDate);
    const endDate = formatDate(event.endDate);

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      dates: `${startDate}/${endDate}`,
      details: event.notes || '',
      location: event.location || '',
    });

    const googleCalendarUrl = `https://calendar.google.com/calendar/render?${params.toString()}`;

    // Open in new window/tab
    if (typeof window !== 'undefined') {
      window.open(googleCalendarUrl, '_blank');
      return { success: true };
    }

    return { success: false, error: 'Unable to open calendar link' };
  } catch (error) {
    console.error('Error generating calendar link:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate calendar link',
    };
  }
}

/**
 * Format date and time for calendar event
 */
export function createEventDateTime(dateString: string, timeString?: string, timezone?: string): Date {
  try {
    // If timeString is provided, combine with date
    if (timeString) {
      const [hours, minutes] = timeString.split(':').map(Number);
      const date = new Date(dateString);
      date.setHours(hours || 9, minutes || 0, 0, 0);
      return date;
    }

    // Otherwise, use date as-is (assumes start of day)
    return new Date(dateString);
  } catch (error) {
    console.error('Error creating event date:', error);
    return new Date();
  }
}

/**
 * Calculate end date from start date and duration
 * Defaults to 2 hours if no end time provided
 */
export function calculateEndDate(startDate: Date, endTimeString?: string, durationHours: number = 2): Date {
  if (endTimeString) {
    const [hours, minutes] = endTimeString.split(':').map(Number);
    const endDate = new Date(startDate);
    endDate.setHours(hours || startDate.getHours() + durationHours, minutes || 0, 0, 0);
    return endDate;
  }

  // Default to start date + durationHours
  const endDate = new Date(startDate);
  endDate.setHours(endDate.getHours() + durationHours);
  return endDate;
}

/**
 * Geocoding Service
 * Converts location names to GPS coordinates using Google Maps API
 */

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export interface GeocodeResult {
  success: boolean;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
  error?: string;
}

/**
 * Convert location name to GPS coordinates
 * Example: "Kingston, Jamaica" → { latitude: 17.9714, longitude: -76.7931 }
 */
export async function geocodeLocation(location: string): Promise<GeocodeResult> {
  if (!location || location.trim().length === 0) {
    return {
      success: false,
      error: 'Location cannot be empty',
    };
  }

  if (!GOOGLE_MAPS_API_KEY) {
    console.error('[GEOCODING] API key not found in environment variables');
    return {
      success: false,
      error: 'Geocoding service not configured. Contact support.',
    };
  }

  try {
    console.log('[GEOCODING] Requesting coordinates for:', location);

    const encodedLocation = encodeURIComponent(location);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedLocation}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    console.log('[GEOCODING] Response status:', data.status);

    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];
      const latitude = result.geometry.location.lat;
      const longitude = result.geometry.location.lng;
      const formattedAddress = result.formatted_address;

      console.log('[GEOCODING] ✅ Success:', {
        location,
        latitude,
        longitude,
        formattedAddress,
      });

      return {
        success: true,
        latitude,
        longitude,
        formattedAddress,
      };
    }

    if (data.status === 'ZERO_RESULTS') {
      console.warn('[GEOCODING] ⚠️ Location not found:', location);
      return {
        success: false,
        error: `"${location}" not found. Please check the spelling and try again.`,
      };
    }

    if (data.status === 'REQUEST_DENIED') {
      console.error('[GEOCODING] ❌ API request denied:', data.error_message);
      return {
        success: false,
        error: 'Geocoding service access denied. Please contact support.',
      };
    }

    console.error('[GEOCODING] ❌ Unexpected status:', data.status, data.error_message);
    return {
      success: false,
      error: data.error_message || 'Unable to find location. Please try again.',
    };
  } catch (error: any) {
    console.error('[GEOCODING] ❌ Network error:', error.message);
    return {
      success: false,
      error: 'Network error. Please check your internet connection and try again.',
    };
  }
}


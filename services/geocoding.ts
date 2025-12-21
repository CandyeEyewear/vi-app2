/**
 * Geocoding Service
 * Converts location names to GPS coordinates using Google Maps API
 */

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
// Fallback to production URL so geocoding doesn't hard-fail if env injection is misconfigured.
// NOTE: For OTA updates, prefer setting this via EAS "Environment variables" (production/preview).
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://vibe.volunteersinc.org';

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

  try {
    console.log('[GEOCODING] Requesting coordinates for:', location);

    const encodedLocation = encodeURIComponent(location);
    // Prefer direct Google calls only when the key is shipped to the client (EXPO_PUBLIC_*).
    // If the key is stored in Vercel, use the server-side proxy: GET {EXPO_PUBLIC_API_URL}/api/geocode?address=...
    const url = GOOGLE_MAPS_API_KEY
      ? `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedLocation}&key=${GOOGLE_MAPS_API_KEY}`
      : API_BASE_URL
        ? `${API_BASE_URL.replace(/\/+$/, '')}/api/geocode?address=${encodedLocation}`
        : null;

    if (!url) {
      console.error('[GEOCODING] No API key and no API base URL configured');
      return {
        success: false,
        error: 'Geocoding service not configured. Contact support.',
      };
    }

    const response = await fetch(url);
    const data = await response.json();

    const status = data.status;
    console.log('[GEOCODING] Response status:', status);

    // The Vercel proxy returns: { status, formatted_address, location: {lat,lng}, error_message }
    // The Google API returns: { status, results: [{ formatted_address, geometry: { location: {lat,lng} } }], error_message }
    const hasProxyShape = data && typeof data === 'object' && data.location && typeof data.location.lat === 'number';

    if (status === 'OK') {
      const latitude = hasProxyShape ? data.location.lat : data.results?.[0]?.geometry?.location?.lat;
      const longitude = hasProxyShape ? data.location.lng : data.results?.[0]?.geometry?.location?.lng;
      const formattedAddress = hasProxyShape ? data.formatted_address : data.results?.[0]?.formatted_address;

      if (typeof latitude === 'number' && typeof longitude === 'number') {
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
    }

    if (status === 'ZERO_RESULTS') {
      console.warn('[GEOCODING] ⚠️ Location not found:', location);
      return {
        success: false,
        error: `"${location}" not found. Please check the spelling and try again.`,
      };
    }

    if (status === 'REQUEST_DENIED') {
      console.error('[GEOCODING] ❌ API request denied:', data.error_message);
      return {
        success: false,
        error: 'Geocoding service access denied. Please contact support.',
      };
    }

    console.error('[GEOCODING] ❌ Unexpected status:', status, data.error_message);
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


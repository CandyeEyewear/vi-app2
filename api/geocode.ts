/**
 * Vercel API Route: /api/geocode
 * Server-side proxy for Google Geocoding API.
 *
 * Why: keeps the Google API key on Vercel (not shipped to clients).
 *
 * Query params:
 * - address: string (required)
 *
 * Env vars:
 * - GOOGLE_MAPS_API_KEY (required)  // keep this in Vercel env, not EXPO_PUBLIC_*
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export default async function handler(req: any, res: any) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(200).end();
  }

  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Geocoding API key not configured' });
  }

  const address = (req.query?.address ?? req.query?.q ?? '').toString();
  if (!address || address.trim().length === 0) {
    return res.status(400).json({ error: 'Missing required query param: address' });
  }

  try {
    const encoded = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    // Pass-through a minimal, stable shape to clients
    const first = Array.isArray(data?.results) ? data.results[0] : undefined;
    const lat = first?.geometry?.location?.lat;
    const lng = first?.geometry?.location?.lng;

    return res.status(200).json({
      status: data?.status,
      error_message: data?.error_message,
      formatted_address: first?.formatted_address,
      location: typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : undefined,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Geocoding request failed',
      message: error?.message,
    });
  }
}


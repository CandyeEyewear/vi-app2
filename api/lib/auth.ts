/**
 * Shared authentication and security utilities for API routes
 * All payment-related endpoints should use these helpers
 */

import { createClient } from '@supabase/supabase-js';

// Allowed origins - only your app can call these APIs
const ALLOWED_ORIGINS = [
  'https://vibe.volunteersinc.org',
  'https://www.vibe.volunteersinc.org',
  'http://localhost:3000',
  'http://localhost:8081',
];

const ALLOWED_APP_IDENTIFIER = 'org.volunteersinc.vibe';

export function getCorsHeaders(requestOrigin: string | undefined): Record<string, string> {
  const origin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Identifier',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json',
  };
}

export function handleCorsPreflightResponse(res: any, origin: string | undefined): void {
  const headers = getCorsHeaders(origin);
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  res.status(200).end();
}

export function setCorsHeaders(res: any, origin: string | undefined): void {
  const headers = getCorsHeaders(origin);
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

export async function verifyAuthToken(
  authHeader: string | undefined
): Promise<{ userId: string; email: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email || '',
    };
  } catch (error) {
    return null;
  }
}

export function verifyRequestOrigin(req: any): boolean {
  const origin = req.headers?.origin;
  const appIdentifier = req.headers?.['x-app-identifier'];

  if (appIdentifier === ALLOWED_APP_IDENTIFIER) {
    return true;
  }

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  if (!origin) {
    return true;
  }

  return false;
}

export function unauthorizedResponse(res: any, message: string = 'Unauthorized'): void {
  res.status(401).json({ error: message });
}

export function forbiddenResponse(res: any, message: string = 'Forbidden'): void {
  res.status(403).json({ error: message });
}

export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

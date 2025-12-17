// @ts-nocheck
export type CorsOptions = {
  allowHeaders?: string;
  allowMethods?: string;
};

const DEFAULT_ALLOW_HEADERS =
  'authorization, x-client-info, apikey, content-type, x-cron-secret, x-function-secret, x-website-signup-secret';
const DEFAULT_ALLOW_METHODS = 'GET,POST,OPTIONS';

function parseAllowedOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getCorsHeaders(req: Request, options: CorsOptions = {}) {
  const requestOrigin = req.headers.get('origin') ?? '';
  const allowedOrigins = parseAllowedOrigins(Deno.env.get('ALLOWED_ORIGINS'));

  // If no allow-list is configured, default to '*' (dev-friendly).
  // If an allow-list exists, echo back the request origin only if it matches.
  const allowOrigin =
    allowedOrigins.length === 0
      ? '*'
      : allowedOrigins.includes(requestOrigin)
        ? requestOrigin
        : allowedOrigins[0]; // deterministic fallback

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': options.allowHeaders ?? DEFAULT_ALLOW_HEADERS,
    'Access-Control-Allow-Methods': options.allowMethods ?? DEFAULT_ALLOW_METHODS,
    // Helps caches/proxies vary by origin when we echo back specific origins.
    ...(allowedOrigins.length > 0 ? { Vary: 'Origin' } : {}),
  };
}

export function handleCorsPreflight(req: Request, options: CorsOptions = {}) {
  if (req.method !== 'OPTIONS') return null;
  return new Response('ok', { headers: getCorsHeaders(req, options) });
}


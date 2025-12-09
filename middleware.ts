// List of known social media and bot crawlers
const CRAWLER_USER_AGENTS = [
  'facebookexternalhit',
  'Facebot',
  'WhatsApp',
  'Twitterbot',
  'LinkedInBot',
  'Slackbot',
  'TelegramBot',
  'Discordbot',
  'Pinterest',
  'Googlebot',
  'bingbot',
  'Embedly',
  'Quora Link Preview',
  'Showyoubot',
  'outbrain',
  'vkShare',
  'W3C_Validator',
];

function isCrawler(userAgent: string): boolean {
  return CRAWLER_USER_AGENTS.some(crawler => 
    userAgent.toLowerCase().includes(crawler.toLowerCase())
  );
}

export default function middleware(request: Request) {
  const userAgent = request.headers.get('user-agent') || '';
  const url = new URL(request.url);
  const { pathname } = url;

  // Only intercept these paths for crawlers
  const ogPaths = [
    { pattern: /^\/post\/([^/]+)$/, type: 'post', param: 'id' },
    { pattern: /^\/causes\/([^/]+)$/, type: 'cause', param: 'slug' },
    { pattern: /^\/events\/([^/]+)$/, type: 'event', param: 'slug' },
    { pattern: /^\/opportunity\/([^/]+)$/, type: 'opportunity', param: 'slug' },
  ];

  for (const route of ogPaths) {
    const match = pathname.match(route.pattern);
    if (match) {
      // Only redirect crawlers to the OG API
      if (isCrawler(userAgent)) {
        const value = match[1];
        const ogUrl = new URL(`/api/og`, url.origin);
        ogUrl.searchParams.set('type', route.type);
        ogUrl.searchParams.set(route.param, value);
        
        // Rewrite to the OG API
        return fetch(new Request(ogUrl, request));
      }
      // Regular users continue to the web app
      break;
    }
  }

  // Continue to next handler
  return fetch(request);
}

export const config = {
  matcher: [
    '/post/:path*',
    '/causes/:path*',
    '/events/:path*',
    '/opportunity/:path*',
  ],
};

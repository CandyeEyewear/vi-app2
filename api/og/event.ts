/**
 * API Route: Generate Open Graph metadata for events
 * Handles /api/og/event/[slug]
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: any, res: any) {
  const { slug } = req.query;

  if (!slug) {
    return res.status(400).send('Event slug is required');
  }

  try {
    // Fetch event data from Supabase
    const { data: event, error } = await supabase
      .from('events')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !event) {
      return res.status(404).send('Event not found');
    }

    // Format date and time
    const eventDate = new Date(event.event_date);
    const formattedDate = eventDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const formattedTime = event.start_time || 'TBD';
    const location = event.is_virtual ? 'Virtual Event' : event.location;

    const title = `Event: ${event.title}`;
    const description = `📅 ${formattedDate} ⏰ ${formattedTime} 📍 ${location}\n\n${event.description?.substring(0, 100) || ''}...`;
    const image = event.image_url || 'https://vibe.volunteersinc.org/assets/default-event-og-image.png';
    const url = `https://vibe.volunteersinc.org/events/${slug}`;

    // Check if request is from a social media crawler
    const userAgent = req.headers['user-agent'] || '';
    const isCrawler = /facebookexternalhit|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot/i.test(userAgent);

    if (isCrawler) {
      const html = generateOGHtml({
        title,
        description,
        image,
        url,
        type: 'website',
        siteName: 'VIbe - Volunteers Inc',
        additionalMeta: `
          <meta property="og:type" content="article" />
          <meta property="article:published_time" content="${event.event_date}" />
          <meta property="article:tag" content="event" />
          <meta property="article:tag" content="volunteering" />
        `,
      });

      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    } else {
      const html = generateRedirectHtml({
        deepLink: `vibe://events/${slug}`,
        webFallback: `https://vibe.volunteersinc.org/download`,
        title,
        description,
      });

      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }
  } catch (error) {
    console.error('Error fetching event:', error);
    return res.status(500).send('Internal server error');
  }
}

function generateOGHtml(params: {
  title: string;
  description: string;
  image: string;
  url: string;
  type: string;
  siteName: string;
  additionalMeta?: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(params.title)}</title>
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="${params.type}" />
  <meta property="og:url" content="${params.url}" />
  <meta property="og:title" content="${escapeHtml(params.title)}" />
  <meta property="og:description" content="${escapeHtml(params.description)}" />
  <meta property="og:image" content="${params.image}" />
  <meta property="og:site_name" content="${params.siteName}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${params.url}" />
  <meta name="twitter:title" content="${escapeHtml(params.title)}" />
  <meta name="twitter:description" content="${escapeHtml(params.description)}" />
  <meta name="twitter:image" content="${params.image}" />
  
  ${params.additionalMeta || ''}
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      max-width: 600px;
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      color: #2196F3;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 16px;
      color: #333;
    }
    p {
      color: #666;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: #2196F3;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
    }
    .button:hover {
      background: #1976D2;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">VIbe</div>
    <h1>${escapeHtml(params.title)}</h1>
    <p>${escapeHtml(params.description)}</p>
    <a href="vibe://events/${params.url.split('/').pop()}" class="button">Open in VIbe App</a>
    <p style="font-size: 14px; color: #999; margin-top: 24px;">
      Don't have the app? <a href="https://vibe.volunteersinc.org/download" style="color: #2196F3;">Download VIbe</a>
    </p>
  </div>
</body>
</html>`;
}

function generateRedirectHtml(params: {
  deepLink: string;
  webFallback: string;
  title: string;
  description: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(params.title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      max-width: 600px;
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      color: #2196F3;
      margin-bottom: 16px;
    }
    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #2196F3;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">VIbe</div>
    <div class="spinner"></div>
    <p>Opening VIbe...</p>
  </div>
  
  <script>
    window.location.href = '${params.deepLink}';
    setTimeout(function() {
      if (document.hasFocus()) {
        window.location.href = '${params.webFallback}';
      }
    }, 2000);
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

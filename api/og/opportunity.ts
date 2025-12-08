/**
 * API Route: Generate Open Graph metadata for opportunities
 * Handles /api/og/opportunity/[slug]
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: any, res: any) {
  const { slug } = req.query;

  if (!slug) {
    return res.status(400).send('Opportunity slug is required');
  }

  try {
    // Fetch opportunity data from Supabase - try slug first, fallback to ID
    let opportunity;
    
    // Try slug first
    const { data: slugData, error: slugError } = await supabase
      .from('opportunities')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (slugData) {
      opportunity = slugData;
    } else {
      // Fallback to ID if slug didn't work
      const { data: idData, error: idError } = await supabase
        .from('opportunities')
        .select('*')
        .eq('id', slug)
        .single();
      
      if (idError || !idData) {
        return res.status(404).send('Opportunity not found');
      }
      opportunity = idData;
    }

    if (!opportunity) {
      return res.status(404).send('Opportunity not found');
    }

    // Format date
    const oppDate = new Date(opportunity.date_start || opportunity.date);
    const formattedDate = oppDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    
    const spotsLeft = opportunity.spots_available || 0;
    const spotsTotal = opportunity.spots_total || 0;

    const title = `Volunteer Opportunity: ${opportunity.title}`;
    const description = `📅 ${formattedDate}\n📍 ${opportunity.location}\n👥 ${spotsLeft} of ${spotsTotal} spots available\n\n${opportunity.description?.substring(0, 100) || ''}...`;
    const image = opportunity.image_url || 'https://vibe.volunteersinc.org/assets/default-opportunity-og-image.png';
    const url = `https://vibe.volunteersinc.org/opportunity/${opportunity.slug || opportunity.id}`;

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
          <meta property="article:tag" content="volunteering" />
          <meta property="article:tag" content="opportunity" />
          <meta property="article:tag" content="${opportunity.category}" />
        `,
      });

      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    } else {
      const html = generateRedirectHtml({
        deepLink: `vibe://opportunity/${opportunity.slug || opportunity.id}`,
        webFallback: `https://vibe.volunteersinc.org/download`,
        title,
        description,
      });

      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }
  } catch (error) {
    console.error('Error fetching opportunity:', error);
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
    <a href="vibe://opportunity/${params.url.split('/').pop()}" class="button">Open in VIbe App</a>
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

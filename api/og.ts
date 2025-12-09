/**
 * Unified API Route: Generate Open Graph metadata for all content types
 * Handles posts, causes, events, and opportunities in one function
 * 
 * Routes:
 * - /api/og?type=post&id={id}
 * - /api/og?type=cause&slug={slug}
 * - /api/og?type=event&slug={slug}
 * - /api/og?type=opportunity&slug={slug}
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: any, res: any) {
  const { type, id, slug } = req.query;
  const userAgent = req.headers['user-agent'] || '';
  const isCrawler = /facebookexternalhit|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot/i.test(userAgent);

  try {
    switch (type) {
      case 'post':
        return await handlePost(req, res, id, isCrawler);
      case 'cause':
        return await handleCause(req, res, slug, isCrawler);
      case 'event':
        return await handleEvent(req, res, slug, isCrawler);
      case 'opportunity':
        return await handleOpportunity(req, res, slug, isCrawler);
      default:
        return res.status(400).send('Invalid type parameter');
    }
  } catch (error) {
    console.error('Error in OG handler:', error);
    return res.status(500).send('Internal server error');
  }
}

// ============================================================================
// POST HANDLER
// ============================================================================
async function handlePost(req: any, res: any, id: string, isCrawler: boolean) {
  if (!id) return res.status(400).send('Post ID is required');

  console.log('[OG] Fetching post:', id);
  console.log('[OG] Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
  
  const { data: post, error } = await supabase
    .from('posts')
    .select('id, text, media_urls, created_at, user:users(full_name, avatar_url)')
    .eq('id', id)
    .single();

  console.log('[OG] Query result - data:', post);
  console.log('[OG] Query result - error:', error);

  if (error || !post) {
    console.error('[OG] Post not found. Error:', error?.message, error?.details, error?.hint);
    return res.status(404).send(`Post not found: ${error?.message || 'No data returned'}`);
  }

  const user = Array.isArray(post.user) ? post.user[0] : post.user;
  const userName = user?.full_name || 'VIbe User';
  const previewImage = post.media_urls?.[0] || user?.avatar_url || 'https://vibe.volunteersinc.org/assets/default-og-image.png';
  const description = post.text?.substring(0, 200) || 'Check out this post on VIbe';
  const title = `${userName} on VIbe`;
  const url = `https://vibe.volunteersinc.org/post/${id}`;

  if (isCrawler) {
    return sendOGHtml(res, { title, description, image: previewImage, url, type: 'article' });
  } else {
    return sendRedirect(res, { deepLink: `vibe://post/${id}`, title, description });
  }
}

// ============================================================================
// CAUSE HANDLER
// ============================================================================
async function handleCause(req: any, res: any, slug: string, isCrawler: boolean) {
  if (!slug) return res.status(400).send('Cause slug is required');

  const { data: cause, error } = await supabase
    .from('causes')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !cause) return res.status(404).send('Cause not found');

  const goalAmount = cause.goal_amount || 0;
  const raisedAmount = cause.raised_amount || 0;
  const progress = goalAmount > 0 ? Math.round((raisedAmount / goalAmount) * 100) : 0;
  const title = `Support: ${cause.title}`;
  const description = `${progress}% funded! ${cause.description?.substring(0, 150) || ''}...`;
  const image = cause.image_url || 'https://vibe.volunteersinc.org/assets/default-cause-og-image.png';
  const url = `https://vibe.volunteersinc.org/causes/${slug}`;

  if (isCrawler) {
    return sendOGHtml(res, { title, description, image, url, type: 'article' });
  } else {
    return sendRedirect(res, { deepLink: `vibe://causes/${slug}`, title, description });
  }
}

// ============================================================================
// EVENT HANDLER
// ============================================================================
async function handleEvent(req: any, res: any, slug: string, isCrawler: boolean) {
  if (!slug) return res.status(400).send('Event slug is required');

  const { data: event, error } = await supabase
    .from('events')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !event) return res.status(404).send('Event not found');

  const eventDate = new Date(event.event_date);
  const formattedDate = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formattedTime = event.start_time || 'TBD';
  const location = event.is_virtual ? 'Virtual Event' : event.location;
  const title = `Event: ${event.title}`;
  const description = `📅 ${formattedDate} ⏰ ${formattedTime} 📍 ${location}\n\n${event.description?.substring(0, 100) || ''}...`;
  const image = event.image_url || 'https://vibe.volunteersinc.org/assets/default-event-og-image.png';
  const url = `https://vibe.volunteersinc.org/events/${slug}`;

  if (isCrawler) {
    return sendOGHtml(res, { title, description, image, url, type: 'article' });
  } else {
    return sendRedirect(res, { deepLink: `vibe://events/${slug}`, title, description });
  }
}

// ============================================================================
// OPPORTUNITY HANDLER
// ============================================================================
async function handleOpportunity(req: any, res: any, slug: string, isCrawler: boolean) {
  if (!slug) return res.status(400).send('Opportunity slug is required');

  let opportunity;
  const { data: slugData } = await supabase.from('opportunities').select('*').eq('slug', slug).maybeSingle();

  if (slugData) {
    opportunity = slugData;
  } else {
    const { data: idData, error: idError } = await supabase.from('opportunities').select('*').eq('id', slug).single();
    if (idError || !idData) return res.status(404).send('Opportunity not found');
    opportunity = idData;
  }

  if (!opportunity) return res.status(404).send('Opportunity not found');

  const oppDate = new Date(opportunity.date_start || opportunity.date);
  const formattedDate = oppDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const spotsLeft = opportunity.spots_available || 0;
  const spotsTotal = opportunity.spots_total || 0;
  const title = `Volunteer Opportunity: ${opportunity.title}`;
  const description = `📅 ${formattedDate}\n📍 ${opportunity.location}\n👥 ${spotsLeft} of ${spotsTotal} spots available\n\n${opportunity.description?.substring(0, 100) || ''}...`;
  const image = opportunity.image_url || 'https://vibe.volunteersinc.org/assets/default-opportunity-og-image.png';
  const url = `https://vibe.volunteersinc.org/opportunity/${opportunity.slug || opportunity.id}`;

  if (isCrawler) {
    return sendOGHtml(res, { title, description, image, url, type: 'article' });
  } else {
    return sendRedirect(res, { deepLink: `vibe://opportunity/${opportunity.slug || opportunity.id}`, title, description });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function sendOGHtml(res: any, params: { title: string; description: string; image: string; url: string; type: string }) {
  const html = `<!DOCTYPE html>
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
  <meta property="og:site_name" content="VIbe - Volunteers Inc" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${params.url}" />
  <meta name="twitter:title" content="${escapeHtml(params.title)}" />
  <meta name="twitter:description" content="${escapeHtml(params.description)}" />
  <meta name="twitter:image" content="${params.image}" />
  
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
    <p style="font-size: 14px; color: #999; margin-top: 24px;">
      <a href="https://vibe.volunteersinc.org/download" style="color: #2196F3;">Download VIbe App</a>
    </p>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
}

function sendRedirect(res: any, params: { deepLink: string; title: string; description: string }) {
  const html = `<!DOCTYPE html>
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
        window.location.href = 'https://vibe.volunteersinc.org/download';
      }
    }, 2000);
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
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

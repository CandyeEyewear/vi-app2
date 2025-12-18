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

/**
 * Convert mention markup to display text
 * @[Full Name](userId) -> @Full Name
 */
function mentionToDisplayText(text: string): string {
  return text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
}

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
    .select('id, text, media_urls, created_at, user:users!posts_user_id_fkey(full_name, avatar_url)')
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
  // Clean mention format before using in OG tags
  const cleanText = mentionToDisplayText(post.text || '');
  const description = cleanText.substring(0, 200) || 'Check out this post on VIbe';
  const title = `${userName}'s post on VIbe`;
  const url = `https://vibe.volunteersinc.org/post/${id}`;

  return sendOGHtml(res, { title, description, image: previewImage, url, type: 'article', deepLink: `vibe://post/${id}` });
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

  return sendOGHtml(res, { title, description, image, url, type: 'article', deepLink: `vibe://causes/${slug}` });
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

  return sendOGHtml(res, { title, description, image, url, type: 'article', deepLink: `vibe://events/${slug}` });
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

  return sendOGHtml(res, { title, description, image, url, type: 'article', deepLink: `vibe://opportunity/${opportunity.slug || opportunity.id}` });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function sendOGHtml(res: any, params: { title: string; description: string; image: string; url: string; type: string; deepLink?: string }) {
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
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .container {
      max-width: 500px;
      width: 100%;
      background: white;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .header {
      background: linear-gradient(135deg, #38B6FF 0%, #1E90FF 100%);
      padding: 20px;
      text-align: center;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      color: white;
      letter-spacing: 2px;
    }
    .image-container {
      width: 100%;
      max-height: 300px;
      overflow: hidden;
    }
    .image-container img {
      width: 100%;
      height: auto;
      object-fit: cover;
    }
    .content {
      padding: 24px;
    }
    .author {
      font-size: 18px;
      font-weight: 600;
      color: #333;
      margin-bottom: 12px;
    }
    .description {
      font-size: 16px;
      color: #555;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .buttons {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .button {
      display: block;
      padding: 14px 24px;
      text-align: center;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 600;
      font-size: 16px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .button-primary {
      background: linear-gradient(135deg, #38B6FF 0%, #1E90FF 100%);
      color: white;
    }
    .button-secondary {
      background: #f5f5f5;
      color: #333;
    }
    .footer {
      text-align: center;
      padding: 16px;
      background: #fafafa;
      border-top: 1px solid #eee;
    }
    .footer a {
      color: #38B6FF;
      text-decoration: none;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">VIbe</div>
    </div>
    
    ${params.image && params.image !== 'https://vibe.volunteersinc.org/assets/default-og-image.png' ? `
    <div class="image-container">
      <img src="${params.image}" alt="Post image" />
    </div>
    ` : ''}
    
    <div class="content">
      <div class="author">${escapeHtml(params.title)}</div>
      <p class="description">${escapeHtml(params.description)}</p>
      
      <div class="buttons">
        ${params.deepLink ? `<a href="${params.deepLink}" class="button button-primary">Open in VIbe App</a>` : ''}
        <a href="https://vibe.volunteersinc.org/download" class="button button-secondary">Download VIbe</a>
      </div>
    </div>
    
    <div class="footer">
      <a href="https://vibe.volunteersinc.org">Learn more about VIbe</a>
    </div>
  </div>
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

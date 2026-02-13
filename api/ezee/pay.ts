/**
 * Vercel API Route: /api/ezee/pay.ts
 * Generates an auto-submitting HTML form to redirect to eZeePayments payment page
 * eZeePayments requires a POST request with form data, not a GET request
 * 
 * FIXED: Correct payment URL (no /pay path per API docs)
 */

const EZEE_API_URL = process.env.EZEE_API_URL;

export default async function handler(req: any, res: any) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // Prevent caching of this page
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    token, 
    amount, 
    currency, 
    order_id, 
    email, 
    name, 
    description,
    subscription_id,
    recurring 
  } = req.query;

  if (!token || !amount || !order_id || !email) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Error</title>
      </head>
      <body>
        <h1>Payment Error</h1>
        <p>Missing required parameters: token, amount, order_id, or email</p>
      </body>
      </html>
    `);
  }

  if (!EZEE_API_URL) {
    console.error('CRITICAL: EZEE_API_URL environment variable is not set');
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Payment Error</title></head>
      <body>
        <h1>Payment Configuration Error</h1>
        <p>Payment service is not configured. Please contact support.</p>
      </body>
      </html>
    `);
  }

  // Derive secure payment page URL from API URL
  // api.ezeepayments.com → secure.ezeepayments.com
  // api-test.ezeepayments.com → secure-test.ezeepayments.com
  const paymentUrl = EZEE_API_URL.includes('test')
    ? 'https://secure-test.ezeepayments.com'
    : 'https://secure.ezeepayments.com';

  console.log('=== PAY.TS DEBUG ===');
  console.log('Payment URL:', paymentUrl);
  console.log('Token:', token);
  console.log('Amount:', amount);
  console.log('Order ID:', order_id);
  console.log('Email:', email);

  // Escape HTML to prevent XSS
  const escapeHtml = (str: string) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // Generate auto-submitting form with fallback button for reliability
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Redirecting to Payment...</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: #f5f5f5;
        }
        .container {
          text-align: center;
          padding: 2rem;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          max-width: 400px;
        }
        .spinner {
          border: 3px solid #f3f3f3;
          border-top: 3px solid #38B6FF;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .fallback-btn {
          display: none;
          background: #38B6FF;
          color: white;
          border: none;
          padding: 12px 32px;
          font-size: 16px;
          border-radius: 8px;
          cursor: pointer;
          margin-top: 1rem;
          transition: background 0.2s;
        }
        .fallback-btn:hover {
          background: #2da3e8;
        }
        .fallback-btn.show {
          display: inline-block;
        }
        .status-text {
          color: #666;
          font-size: 0.9rem;
          margin-top: 0.5rem;
        }
        .error-text {
          color: #dc3545;
          font-size: 0.9rem;
          margin-top: 0.5rem;
          display: none;
        }
        .error-text.show {
          display: block;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="spinner" id="spinner"></div>
        <p id="mainText">Redirecting to secure payment page...</p>
        <p class="status-text" id="statusText">Please wait...</p>
        <p class="error-text" id="errorText">Auto-redirect didn't work. Please click the button below.</p>
        <button type="button" class="fallback-btn" id="fallbackBtn" onclick="manualSubmit()">
          Continue to Payment
        </button>
      </div>
      <form id="paymentForm" method="POST" action="${escapeHtml(paymentUrl)}">
        <input type="hidden" name="platform" value="custom" />
        <input type="hidden" name="currency" value="JMD" />
        <input type="hidden" name="token" value="${escapeHtml(token)}" />
        <input type="hidden" name="amount" value="${escapeHtml(amount)}" />
        <input type="hidden" name="order_id" value="${escapeHtml(order_id)}" />
        <input type="hidden" name="email_address" value="${escapeHtml(email)}" />
        <input type="hidden" name="customer_name" value="${escapeHtml(name || '')}" />
        <input type="hidden" name="description" value="${escapeHtml(description || 'Payment')}" />
        ${subscription_id ? `<input type="hidden" name="subscription_id" value="${escapeHtml(subscription_id)}" />` : ''}
        ${recurring ? `<input type="hidden" name="recurring" value="true" />` : ''}
        <noscript>
          <div style="text-align: center; padding: 20px;">
            <p>JavaScript is required for automatic redirect.</p>
            <button type="submit" style="background: #38B6FF; color: white; border: none; padding: 12px 32px; font-size: 16px; border-radius: 8px; cursor: pointer;">
              Continue to Payment
            </button>
          </div>
        </noscript>
      </form>
      <script>
        // Track submission attempts
        var submitted = false;
        var attempts = 0;
        var maxAttempts = 5;

        function manualSubmit() {
          var form = document.getElementById('paymentForm');
          if (form && !submitted) {
            submitted = true;
            document.getElementById('statusText').textContent = 'Redirecting...';
            form.submit();
          }
        }

        function showFallback() {
          document.getElementById('spinner').style.display = 'none';
          document.getElementById('mainText').textContent = 'Ready to proceed';
          document.getElementById('errorText').classList.add('show');
          document.getElementById('fallbackBtn').classList.add('show');
          document.getElementById('statusText').style.display = 'none';
        }

        function trySubmit() {
          if (submitted) return;
          attempts++;

          var form = document.getElementById('paymentForm');
          if (form) {
            try {
              submitted = true;
              form.submit();
            } catch (e) {
              submitted = false;
              console.error('Form submit error:', e);
              if (attempts >= maxAttempts) {
                showFallback();
              }
            }
          } else if (attempts >= maxAttempts) {
            showFallback();
          }
        }

        // Wait for DOM to be ready before attempting submit
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function() {
            // Small delay to ensure form is fully parsed
            setTimeout(trySubmit, 50);
          });
        } else {
          // DOM already loaded, try after a small delay
          setTimeout(trySubmit, 50);
        }

        // Multiple fallback attempts with increasing delays
        setTimeout(function() { if (!submitted) trySubmit(); }, 200);
        setTimeout(function() { if (!submitted) trySubmit(); }, 500);
        setTimeout(function() { if (!submitted) trySubmit(); }, 1000);
        setTimeout(function() { if (!submitted) trySubmit(); }, 2000);

        // Show fallback button after 3 seconds if still not submitted
        setTimeout(function() {
          if (!submitted) {
            showFallback();
          }
        }, 3000);
      </script>
    </body>
    </html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}
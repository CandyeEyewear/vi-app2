/**
 * Vercel API Route: /api/ezee/pay.ts
 * Generates an auto-submitting HTML form to redirect to eZeePayments payment page
 * eZeePayments requires a POST request with form data, not a GET request
 */

const EZEE_API_URL = process.env.EZEE_API_URL || 'https://api-test.ezeepayments.com';

export default async function handler(req: any, res: any) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

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

  // Determine payment URL based on environment
  const paymentUrl = EZEE_API_URL.includes('test')
    ? 'https://secure-test.ezeepayments.com'
    : 'https://secure.ezeepayments.com';

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

  // Generate auto-submitting form
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
      </style>
    </head>
    <body onload="document.getElementById('paymentForm').submit();">
      <div class="container">
        <div class="spinner"></div>
        <p>Redirecting to secure payment page...</p>
        <p style="color: #666; font-size: 0.9rem;">Please wait...</p>
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
        ${recurring ? `<input type="hidden" name="recurring" value="${escapeHtml(recurring)}" />` : ''}
      </form>
    </body>
    </html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}


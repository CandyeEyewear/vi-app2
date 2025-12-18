/**
* Vercel API Route: /api/ezee/create-token.ts
* Creates a payment token for one-time payments
* WITH CORS SUPPORT
* Uses official eZeePayments API format with form data
*/

import { createClient } from '@supabase/supabase-js';

const EZEE_API_URL = process.env.EZEE_API_URL || 'https://api-test.ezeepayments.com';
const EZEE_LICENCE_KEY = process.env.EZEE_LICENCE_KEY;
const EZEE_SITE = process.env.EZEE_SITE;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vibe.volunteersinc.org';

const supabase = createClient(
 process.env.SUPABASE_URL!,
 process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to validate UUID
const isValidUUID = (str: string): boolean => {
  if (!str || typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// CORS headers
const corsHeaders = {
 'Access-Control-Allow-Origin': '*',
 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
 'Access-Control-Allow-Headers': 'Content-Type, Authorization',
 'Content-Type': 'application/json',
};

export default async function handler(req: any, res: any) {
  // Debug logging to diagnose environment variable issues
  console.log('🐛 ='.repeat(50));
  console.log('🐛 CREATE TOKEN DEBUG START');
  console.log('🐛 Environment Variables:');
  console.log('🐛   EZEE_SITE:', process.env.EZEE_SITE);
  console.log('🐛   EZEE_LICENCE_KEY exists:', !!process.env.EZEE_LICENCE_KEY);
  console.log('🐛   Computed EZEE_SITE:', EZEE_SITE);
  console.log('🐛   Computed EZEE_LICENCE_KEY exists:', !!EZEE_LICENCE_KEY);
  console.log('🐛 ='.repeat(50));

 // Handle CORS preflight
 if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
 }

  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

 if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
 }

 // Validate required environment variables
 if (!EZEE_SITE || !EZEE_LICENCE_KEY) {
   console.error('CRITICAL: Missing eZeePayments environment variables:', {
     EZEE_SITE: !!EZEE_SITE,
     EZEE_LICENCE_KEY: !!EZEE_LICENCE_KEY,
     EZEE_API_URL: EZEE_API_URL,
   });
   return res.status(500).json({
     error: 'Payment configuration error. Please contact support.',
     debug: process.env.NODE_ENV === 'development' ? {
       missing: {
         EZEE_SITE: !EZEE_SITE,
         EZEE_LICENCE_KEY: !EZEE_LICENCE_KEY,
       }
     } : undefined
   });
 }

 try {
   // Log request details for debugging
   const userAgent = req.headers['user-agent'] || 'unknown';
   console.log('🔵 [CREATE-TOKEN] Request received:', {
     userAgent,
     hasBody: !!req.body,
     bodyKeys: req.body ? Object.keys(req.body) : [],
   });

   const {
     amount,
     orderId,
     orderType,
     referenceId,
     userId,
     customerEmail,
     customerName,
     description,
     platform,  // 'web' or 'app'
     returnPath,  // Path to redirect to after successful payment
    } = req.body;

   // Log platform info after destructuring
   const isMobileApp = platform === 'app';
   console.log('🔵 [CREATE-TOKEN] Platform info:', {
     platform,
     isMobileApp,
   });

   // Validate required fields
   if (!amount || !orderId || !orderType || !customerEmail) {
      console.log('VALIDATION FAILED: Missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields: amount, orderId, orderType, customerEmail' 
      });
   }

    // Generate short unique order ID (max 50 chars for eZeePayments)
    // Format: ORD_timestamp_random (e.g., "ORD_1764299044_x7k9m2" ~28 chars)
    const timestamp = Date.now().toString();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const uniqueOrderId = `ORD_${timestamp}_${randomStr}`;

   // Determine redirect URLs based on platform
   const isApp = platform === 'app';
   
   // Ensure APP_URL is HTTPS (eZeePayments requirement)
   // Remove any trailing slashes and ensure it starts with https://
   let baseUrl = APP_URL.trim();
   if (!baseUrl.startsWith('https://') && !baseUrl.startsWith('http://')) {
     baseUrl = `https://${baseUrl}`;
   } else if (baseUrl.startsWith('http://')) {
     baseUrl = baseUrl.replace('http://', 'https://');
   }
   baseUrl = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
   
   const postBackUrl = `${baseUrl}/api/ezee/webhook`;
   
   // Build return URL with returnPath if provided
   // NOTE: eZeePayments requires HTTPS URLs, so we always use HTTPS baseUrl even for app platform
   // The app can handle deep link redirects on the success page itself
   // CRITICAL: Never add platform=app to URLs sent to eZeePayments - it causes rejection!
   // We'll detect mobile app in the success page using User-Agent or other methods
   const returnParams = new URLSearchParams({ orderId: uniqueOrderId });
   if (returnPath) {
     returnParams.append('returnPath', returnPath);
   }
   // DO NOT add platform=app - eZeePayments rejects URLs with this parameter
   const returnUrl = `${baseUrl}/payment/success?${returnParams.toString()}`;
   
   const cancelParams = new URLSearchParams({ orderId: uniqueOrderId });
   if (returnPath) {
     cancelParams.append('returnPath', returnPath);
   }
   // DO NOT add platform=app - eZeePayments rejects URLs with this parameter
   const cancelUrl = `${baseUrl}/payment/cancel?${cancelParams.toString()}`;
   
   // Verify URLs don't contain platform=app (safety check)
   if (returnUrl.includes('platform=app') || cancelUrl.includes('platform=app')) {
     console.error('🔴 [CREATE-TOKEN] ERROR: URLs still contain platform=app! This will cause eZeePayments to reject the request.');
     console.error('🔴 [CREATE-TOKEN] returnUrl:', returnUrl);
     console.error('🔴 [CREATE-TOKEN] cancelUrl:', cancelUrl);
   }

   // Debug logging - log the URLs being sent
   console.log('🔵 [CREATE-TOKEN] URL Debug:', {
     APP_URL,
     baseUrl,
     returnUrl,
     cancelUrl,
     postBackUrl,
     isApp,
     returnUrlStartsWithHttps: returnUrl.startsWith('https://'),
     cancelUrlStartsWithHttps: cancelUrl.startsWith('https://'),
     postBackUrlStartsWithHttps: postBackUrl.startsWith('https://'),
   });

    // Create form data (NOT JSON) - eZeePayments requires form data
    const formData = new URLSearchParams();
    formData.append('amount', amount.toString());
    formData.append('currency', 'JMD');
    formData.append('order_id', uniqueOrderId);
    formData.append('post_back_url', postBackUrl);
    formData.append('return_url', returnUrl);
    formData.append('cancel_url', cancelUrl);
    
    // Log the form data being sent
    console.log('🔵 [CREATE-TOKEN] Form data being sent to eZeePayments:', {
      amount: amount.toString(),
      currency: 'JMD',
      order_id: uniqueOrderId,
      post_back_url: postBackUrl,
      return_url: returnUrl,
      cancel_url: cancelUrl,
    });

   // Create token with eZeePayments
    // licence_key and site MUST be in headers, not body
   console.log('🔵 [CREATE-TOKEN] Calling eZeePayments API:', {
     url: `${EZEE_API_URL}/v1/custom_token/`,
     hasLicenceKey: !!EZEE_LICENCE_KEY,
     hasSite: !!EZEE_SITE,
     formDataKeys: Array.from(formData.keys()),
     platform: platform || 'unknown',
     isMobileApp,
     returnUrl,
     cancelUrl,
   });

   // Try without custom User-Agent first (eZeePayments might reject custom User-Agents)
   // If that fails, we can try with a standard browser User-Agent
   const fetchOptions: RequestInit = {
     method: 'POST',
     headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'licence_key': EZEE_LICENCE_KEY!,
        'site': EZEE_SITE!,
        // Don't send custom User-Agent - eZeePayments might reject it
        // 'User-Agent': `VIbe-App/${platform === 'app' ? 'mobile' : 'web'}`,
      },
      body: formData.toString(),
    };

   console.log('🔵 [CREATE-TOKEN] Fetch options:', {
     url: `${EZEE_API_URL}/v1/custom_token/`,
     method: fetchOptions.method,
     hasBody: !!fetchOptions.body,
     bodyLength: fetchOptions.body?.toString().length,
     headers: Object.keys(fetchOptions.headers || {}),
   });

   let tokenResponse: Response;
   try {
     tokenResponse = await fetch(`${EZEE_API_URL}/v1/custom_token/`, fetchOptions);
   } catch (fetchError: any) {
     console.error('🔴 [CREATE-TOKEN] FETCH ERROR (network/connection issue):', {
       error: fetchError?.message,
       name: fetchError?.name,
       stack: fetchError?.stack,
       url: `${EZEE_API_URL}/v1/custom_token/`,
     });
     return res.status(500).json({
       error: 'Failed to connect to payment provider',
       details: fetchError?.message || 'Network error when calling eZeePayments API',
       debug: process.env.NODE_ENV === 'development' ? {
         errorMessage: fetchError?.message,
         apiUrl: `${EZEE_API_URL}/v1/custom_token/`,
       } : undefined,
     });
   }

    // Get raw response text first
    const responseText = await tokenResponse.text();
    const responseHeaders = Object.fromEntries(tokenResponse.headers.entries());
    
    console.log('🔵 [CREATE-TOKEN] eZeePayments response:', {
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
      headers: responseHeaders,
      responseLength: responseText.length,
      responsePreview: responseText.substring(0, 500),
      isAppRequest: isMobileApp,
      platform: platform,
    });

    // Check for empty response
    if (!responseText || responseText.trim().length === 0) {
      console.error('🔴 [CREATE-TOKEN] eZeePayments returned EMPTY response:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        headers: responseHeaders,
        isAppRequest: isMobileApp,
        platform: platform,
        returnUrl,
        cancelUrl,
        formDataSent: {
          amount: formData.get('amount'),
          currency: formData.get('currency'),
          order_id: formData.get('order_id'),
          return_url: formData.get('return_url'),
          cancel_url: formData.get('cancel_url'),
        },
      });
      
      // Return the actual status code and details - this is critical for debugging
      // Return detailed error with HTTP status - this is critical for debugging
      const errorResponse: any = {
        error: 'Invalid response from payment provider. The payment service returned an empty response.',
        details: `HTTP ${tokenResponse.status}: ${tokenResponse.statusText}. This may indicate an authentication issue, invalid request parameters, or a problem with the eZeePayments service.`,
        httpStatus: tokenResponse.status,
        httpStatusText: tokenResponse.statusText,
        rawResponse: '', // Explicitly empty
      };
      
      // Always include debug info in error response (not just in development)
      // This helps diagnose the issue without needing server logs
      errorResponse.debug = {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        headers: responseHeaders,
        isAppRequest: isMobileApp,
        platform: platform,
        returnUrl,
        cancelUrl,
        apiUrl: `${EZEE_API_URL}/v1/custom_token/`,
        formDataSent: {
          hasAmount: !!formData.get('amount'),
          hasCurrency: !!formData.get('currency'),
          hasOrderId: !!formData.get('order_id'),
          hasReturnUrl: !!formData.get('return_url'),
          hasCancelUrl: !!formData.get('cancel_url'),
          hasPostBackUrl: !!formData.get('post_back_url'),
          returnUrlValue: formData.get('return_url'),
          cancelUrlValue: formData.get('cancel_url'),
        },
      };
      
      console.error('🔴 [CREATE-TOKEN] Returning error response:', JSON.stringify(errorResponse, null, 2));
      return res.status(500).json(errorResponse);
    }

    // Check if response is HTML (error page) instead of JSON
    if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
      console.error('🔴 [CREATE-TOKEN] eZeePayments returned HTML instead of JSON - likely an error page');
      return res.status(500).json({ 
        error: 'Invalid response from payment provider. The payment service returned an error page instead of a valid response.',
        details: 'This usually indicates a configuration issue with eZeePayments credentials or API endpoint.',
        responsePreview: responseText.substring(0, 1000),
      });
    }

    let tokenData;
    try {
      tokenData = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('🔴 [CREATE-TOKEN] FAILED TO PARSE JSON:', {
        error: jsonError,
        responseStatus: tokenResponse.status,
        responseText: responseText.substring(0, 1000),
        isAppRequest: isMobileApp,
      });
      return res.status(500).json({ 
        error: 'Invalid response from payment provider. The response could not be parsed as JSON.',
        details: tokenResponse.status >= 400 
          ? `HTTP ${tokenResponse.status}: ${tokenResponse.statusText}`
          : 'The payment service may be experiencing issues.',
        responsePreview: responseText.substring(0, 1000),
        rawResponse: responseText.length > 0 ? responseText : '(empty)',
      });
    }

    // Check response - note the "result" wrapper
    if (!tokenData.result || tokenData.result.status !== 1) {
     console.error('🔴 [CREATE-TOKEN] TOKEN CREATION FAILED:', {
       fullResponse: tokenData,
       result: tokenData.result,
       message: tokenData.result?.message,
       status: tokenData.result?.status,
     });
      return res.status(500).json({ 
        error: tokenData.result?.message || 'Failed to create payment token',
        details: tokenData.result || tokenData,
        debug: process.env.NODE_ENV === 'development' ? {
          apiUrl: `${EZEE_API_URL}/v1/custom_token/`,
          hasCredentials: {
            licenceKey: !!EZEE_LICENCE_KEY,
            site: !!EZEE_SITE,
          },
        } : undefined,
      });
    }

    // Token is inside result object
    const token = tokenData.result.token;

   // Store transaction in database
    // Use uniqueOrderId as order_id (this is what eZeePayments will send back as CustomOrderId)
    // Only use reference_id if it's a valid UUID (database column is UUID type)
   
   // For event_registration, extract event_id and ticket_count from orderId/description
   // OrderId format: EVT_{eventId}_{timestamp}_{random}
   // Description format: "{Event Title} - {ticketCount} ticket(s)"
   let eventMetadata: any = {};
    if (orderType === 'event_registration' && !referenceId) {
     // Extract event_id from orderId (format: EVT_{eventId}_{timestamp}_{random})
     const orderIdMatch = orderId.match(/^EVT_([^_]+)_/);
     if (orderIdMatch && orderIdMatch[1]) {
       eventMetadata.event_id = orderIdMatch[1];
     }
     
     // Extract ticket_count from description (format: "... - X ticket(s)")
     const descMatch = description?.match(/- (\d+) ticket/i);
     if (descMatch && descMatch[1]) {
       eventMetadata.ticket_count = parseInt(descMatch[1], 10);
     } else {
       eventMetadata.ticket_count = 1; // Default to 1 if not found
     }
     
    console.log('[CREATE-TOKEN] Event registration metadata:', {
      event_id: eventMetadata.event_id,
      ticket_count: eventMetadata.ticket_count,
    });
   }
   
   const { data: transaction, error: dbError } = await supabase
     .from('payment_transactions')
     .insert({
       user_id: userId || null,
        order_id: uniqueOrderId,  // Store the ID we sent to eZeePayments
       order_type: orderType,
        reference_id: (referenceId && isValidUUID(referenceId)) ? referenceId : null,  // Only use if valid UUID
       amount,
       currency: 'JMD',
       description: description || `Payment for ${orderType}`,
        ezee_token: token,
       status: 'pending',
       customer_email: customerEmail,
       customer_name: customerName,
        metadata: { 
          original_order_id: orderId,  // Always store original orderId here
          ...eventMetadata,  // Add event_id and ticket_count for event registrations
        },
     })
     .select()
     .single();

  if (dbError) {
    console.error('Database error:', dbError?.message);
      // Continue even if DB insert fails - we still return the token
   }

    // Build the redirect URL to our payment form page
    // This page will auto-submit a POST form to eZeePayments
    const paymentRedirectUrl = `${APP_URL}/api/ezee/pay?` + new URLSearchParams({
      token: token,
      amount: amount.toString(),
      currency: 'JMD',
      order_id: uniqueOrderId,
      email: customerEmail,
      name: customerName || '',
      description: description || `Payment for ${orderType}`,
    }).toString();

    return res.status(200).json({
       success: true,
      token: token,
       transactionId: transaction?.id,
      paymentUrl: paymentRedirectUrl,  // This URL will auto-POST to eZeePayments
       paymentData: {
        token: token,
        amount: amount,
        currency: 'JMD',
        order_id: uniqueOrderId,
        email_address: customerEmail,
        customer_name: customerName || 'Customer',
        description: description || `Payment for ${orderType}`,
      },
    });
  } catch (error: any) {
   console.error('🔴 [CREATE-TOKEN] UNEXPECTED ERROR:', {
     error: error?.message,
     stack: error?.stack,
     name: error?.name,
     type: typeof error,
   });
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error?.message || 'An unexpected error occurred while creating the payment token.',
      debug: process.env.NODE_ENV === 'development' ? {
        errorMessage: error?.message,
        errorName: error?.name,
      } : undefined,
    });
 }
}
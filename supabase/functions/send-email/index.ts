import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { type, to, data } = await req.json()

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured')
    }

    let subject = ''
    let html = ''

    // Generate email based on type
    switch (type) {
      case 'welcome':
        subject = 'Welcome to VIbe! 🎉'
        html = generateWelcomeEmail(data.firstName)
        break
      
      case 'event_confirmation':
        subject = `Event Confirmed: ${data.eventName}`
        html = generateEventConfirmationEmail(data)
        break
      
      case 'payment_receipt':
        subject = 'Payment Receipt - VIbe'
        html = generatePaymentReceiptEmail(data)
        break
      
      default:
        throw new Error(`Unknown email type: ${type}`)
    }

    // Send email via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'VIbe <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Resend API Error:', errorData)
      return new Response(
        JSON.stringify({ success: false, error: `Resend API error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const responseData = await response.json()
    console.log('Email sent successfully:', responseData.id)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function generateWelcomeEmail(firstName: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to VIbe! 🎉</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>Welcome to the VIbe community! We're thrilled to have you join our network of volunteers.</p>
            <p>Happy volunteering!</p>
            <p><strong>The VIbe Team</strong></p>
          </div>
        </div>
      </body>
    </html>
  `
}

function generateEventConfirmationEmail(data: any): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #9C27B0; color: white; padding: 20px; text-align: center; }
          .content { background: #f9f9f9; padding: 30px; }
          .event-details { background: white; padding: 20px; border-left: 4px solid #9C27B0; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Event Registration Confirmed! 🎟️</h1>
          </div>
          <div class="content">
            <p>Hi ${data.firstName},</p>
            <div class="event-details">
              <h2>${data.eventName}</h2>
              <p><strong>📅 Date:</strong> ${data.eventDate}</p>
              <p><strong>📍 Location:</strong> ${data.eventLocation}</p>
            </div>
            <p><strong>The VIbe Team</strong></p>
          </div>
        </div>
      </body>
    </html>
  `
}

function generatePaymentReceiptEmail(data: any): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { background: #f9f9f9; padding: 30px; }
          .receipt { background: white; padding: 20px; border: 1px solid #ddd; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Receipt 💳</h1>
          </div>
          <div class="content">
            <p>Hi ${data.firstName},</p>
            <div class="receipt">
              <p><strong>Amount:</strong> ${data.amount}</p>
              <p><strong>Transaction ID:</strong> ${data.transactionId}</p>
              <p><strong>Date:</strong> ${data.date}</p>
            </div>
            <p><strong>The VIbe Team</strong></p>
          </div>
        </div>
      </body>
    </html>
  `
}

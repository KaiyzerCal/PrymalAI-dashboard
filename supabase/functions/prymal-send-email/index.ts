// Email service for sending transactional emails
// Supports: Resend, Sendgrid, or any SMTP service

const EMAIL_SERVICE = Deno.env.get('EMAIL_SERVICE') || 'resend' // 'resend' or 'sendgrid'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')
const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL') || 'noreply@prymalai.com'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface EmailPayload {
  to: string
  subject: string
  type: 'welcome' | 'payment_confirmation' | 'trial_ending' | 'payment_failed' | 'security_alert' | 'custom'
  data?: Record<string, string>
  html?: string
}

function getEmailTemplate(type: string, data: Record<string, string> = {}): { subject: string; html: string } {
  switch (type) {
    case 'welcome':
      return {
        subject: 'Welcome to Prymal AI',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to Prymal AI! 🚀</h2>
            <p>Hi ${data.name || 'there'},</p>
            <p>Thanks for signing up. Your account is now active and ready to use.</p>
            <h3>Next Steps:</h3>
            <ol>
              <li><a href="https://prymalai.com/settings?tab=integrations">Add your Anthropic API key</a> to unlock the AI agent</li>
              <li><a href="https://prymalai.com/settings?tab=integrations">Connect your Google Workspace</a> for automation</li>
              <li>Start using the Google Agent to automate your workflows</li>
            </ol>
            <p><strong>Your Plan:</strong> ${data.plan || 'Trial (14 days free)'}</p>
            <p style="margin-top: 30px; color: #666; font-size: 12px;">
              Need help? Check our <a href="https://prymalai.com/contact">support page</a> or email <a href="mailto:support@prymalai.com">support@prymalai.com</a>
            </p>
            <footer style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; color: #999; font-size: 12px;">
              <p>Prymal AI · Building autonomous workflows for Google Workspace</p>
              <p><a href="https://prymalai.com/privacy">Privacy Policy</a> | <a href="https://prymalai.com/terms">Terms of Service</a> | <a href="https://prymalai.com/security">Security Policy</a></p>
            </footer>
          </div>
        `
      }

    case 'payment_confirmation':
      return {
        subject: 'Payment Confirmed - Prymal AI',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Payment Confirmed ✓</h2>
            <p>Hi ${data.name || 'there'},</p>
            <p>Your payment has been successfully processed.</p>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Plan:</strong> ${data.plan}</p>
              <p><strong>Amount:</strong> ${data.amount}</p>
              <p><strong>Next Billing Date:</strong> ${data.next_billing_date}</p>
            </div>
            <p>Your account is now upgraded and all features are available.</p>
            <p style="margin-top: 30px; color: #666; font-size: 12px;">
              Questions? Email <a href="mailto:billing@prymalai.com">billing@prymalai.com</a>
            </p>
            <footer style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; color: #999; font-size: 12px;">
              <p>Prymal AI · Building autonomous workflows for Google Workspace</p>
            </footer>
          </div>
        `
      }

    case 'trial_ending':
      return {
        subject: 'Your Prymal AI trial ends in 3 days',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Your Trial Ends Soon ⏰</h2>
            <p>Hi ${data.name || 'there'},</p>
            <p>Your <strong>14-day free trial</strong> of Prymal AI ends in <strong>3 days</strong> (${data.trial_end_date}).</p>
            <p>To keep your account active after the trial, choose a plan:</p>
            <div style="margin: 30px 0;">
              <a href="https://prymalai.com/settings?tab=billing" style="display: inline-block; background: #00d4ff; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Choose Your Plan</a>
            </div>
            <h4>Our Plans:</h4>
            <ul>
              <li><strong>Tier 1</strong> - $17/mo: Email management</li>
              <li><strong>Tier 2</strong> - $47/mo: Email, Calendar, Tasks</li>
              <li><strong>Tier 3</strong> - $97/mo: Drive, Docs, Sheets, Slides</li>
              <li><strong>Tier 4</strong> - $147/mo: Full access including Google Business Profile</li>
            </ul>
            <p style="color: #666;">If you don't select a plan, your account will be downgraded to view-only access.</p>
            <footer style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; color: #999; font-size: 12px;">
              <p>Prymal AI · Building autonomous workflows for Google Workspace</p>
            </footer>
          </div>
        `
      }

    case 'payment_failed':
      return {
        subject: 'Payment Failed - Action Required',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Payment Failed ⚠️</h2>
            <p>Hi ${data.name || 'there'},</p>
            <p>We were unable to charge your card for your ${data.plan} subscription.</p>
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <p><strong>Reason:</strong> ${data.failure_reason || 'Card declined'}</p>
            </div>
            <p>Please update your payment method:</p>
            <a href="https://prymalai.com/settings?tab=billing" style="display: inline-block; background: #00d4ff; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Update Payment Method</a>
            <p style="margin-top: 20px; color: #666;">Your account will be paused in 3 days if payment is not updated.</p>
            <footer style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; color: #999; font-size: 12px;">
              <p>Having trouble? Email <a href="mailto:billing@prymalai.com">billing@prymalai.com</a></p>
            </footer>
          </div>
        `
      }

    case 'security_alert':
      return {
        subject: 'Security Alert - Prymal AI',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Security Alert 🔒</h2>
            <p>Hi ${data.name || 'there'},</p>
            <p>${data.message || 'We detected unusual activity on your account.'}</p>
            <p>If this wasn't you, please:</p>
            <ol>
              <li><a href="https://prymalai.com/settings?tab=account">Change your password</a> immediately</li>
              <li><a href="https://prymalai.com/settings?tab=integrations">Rotate your API keys</a></li>
              <li><a href="https://prymalai.com/settings?tab=integrations">Review connected services</a></li>
            </ol>
            <p>For security concerns, contact <a href="mailto:security@prymalai.com">security@prymalai.com</a></p>
            <footer style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; color: #999; font-size: 12px;">
              <p>Prymal AI takes security seriously. <a href="https://prymalai.com/security">Learn more</a></p>
            </footer>
          </div>
        `
      }

    default:
      return {
        subject: 'Message from Prymal AI',
        html: '<p>No template configured</p>'
      }
  }
}

async function sendWithResend(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured')
    return false
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: SENDER_EMAIL,
      to,
      subject,
      html,
    }),
  })

  return res.ok
}

async function sendWithSendgrid(to: string, subject: string, html: string): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.error('SENDGRID_API_KEY not configured')
    return false
  }

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: SENDER_EMAIL },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  })

  return res.ok
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  try {
    const { to, subject, type, data, html } = await req.json() as EmailPayload

    if (!to || !subject) {
      return new Response(JSON.stringify({ error: 'Missing to or subject' }), { status: 400 })
    }

    // Get template if using predefined type
    let emailSubject = subject
    let emailHtml = html

    if (type && type !== 'custom') {
      const template = getEmailTemplate(type, data)
      emailSubject = template.subject
      emailHtml = template.html
    }

    // Send email
    let success = false
    if (EMAIL_SERVICE === 'resend') {
      success = await sendWithResend(to, emailSubject, emailHtml)
    } else if (EMAIL_SERVICE === 'sendgrid') {
      success = await sendWithSendgrid(to, emailSubject, emailHtml)
    }

    if (success) {
      return new Response(JSON.stringify({ sent: true }), {
        headers: { 'Content-Type': 'application/json', ...CORS }
      })
    } else {
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS }
      })
    }
  } catch (err) {
    console.error('Email error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS }
    })
  }
})

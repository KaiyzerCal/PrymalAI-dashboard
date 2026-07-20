// Shared Twilio SMS sender (same pattern as prymal-sms).
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? ''
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? ''
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER') ?? ''

export const twilioReady = Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER)

export async function sendSms(to: string, bodyText: string): Promise<boolean> {
  if (!twilioReady) return false
  const chunks: string[] = []
  let rest = bodyText.trim()
  while (rest.length > 0 && chunks.length < 3) {
    chunks.push(rest.slice(0, 1500))
    rest = rest.slice(1500)
  }
  for (const chunk of chunks) {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: TWILIO_PHONE_NUMBER, To: to, Body: chunk }),
      }
    )
    if (!res.ok) return false
  }
  return true
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

const STAR_MAP: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
}

async function getValidAccessToken(admin: ReturnType<typeof createClient>, clientId: string): Promise<string | null> {
  const { data: tokenRow } = await admin
    .from('prymal_oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('client_id', clientId)
    .eq('platform', 'google')
    .single()

  if (!tokenRow) return null

  const expiresAt = new Date(tokenRow.expires_at).getTime()
  const fiveMinutes = 5 * 60 * 1000
  if (Date.now() < expiresAt - fiveMinutes) return tokenRow.access_token

  // Refresh the token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenRow.refresh_token,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
    }),
  })
  const data = await res.json()
  if (!data.access_token) return null

  const newExpiry = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString()
  await admin.from('prymal_oauth_tokens').update({
    access_token: data.access_token,
    expires_at: newExpiry,
  }).eq('client_id', clientId).eq('platform', 'google')

  return data.access_token
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Get all clients with GBP connected
  const { data: clients } = await admin
    .from('prymal_clients')
    .select('id, business_name, gbp_account_id, gbp_location_id')
    .not('gbp_account_id', 'is', null)
    .not('gbp_location_id', 'is', null)

  if (!clients?.length) {
    return new Response(JSON.stringify({ message: 'No clients with GBP connected' }), { status: 200 })
  }

  const results = []

  for (const client of clients) {
    const accessToken = await getValidAccessToken(admin, client.id)
    if (!accessToken) {
      results.push({ client_id: client.id, error: 'No valid access token' })
      continue
    }

    // Fetch reviews from GBP
    const reviewsRes = await fetch(
      `https://mybusiness.googleapis.com/v4/${client.gbp_account_id}/${client.gbp_location_id}/reviews?pageSize=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const reviewsData = await reviewsRes.json()
    const reviews = reviewsData.reviews ?? []

    let drafted = 0
    for (const review of reviews) {
      const starRating = STAR_MAP[review.starRating] ?? 0
      const reviewText = review.comment ?? ''
      const reviewerName = review.reviewer?.displayName ?? 'Customer'
      const gbpReviewId = review.reviewId

      // Upsert review record
      const { data: reviewRow } = await admin.from('prymal_gmb_reviews').upsert(
        {
          client_id: client.id,
          gbp_review_id: gbpReviewId,
          gbp_account_id: client.gbp_account_id,
          gbp_location_id: client.gbp_location_id,
          reviewer_name: reviewerName,
          star_rating: starRating,
          review_text: reviewText,
          review_date: review.createTime,
          response_status: review.reviewReply ? 'responded' : 'pending',
        },
        { onConflict: 'client_id,gbp_review_id' }
      ).select('id, response_status').single()

      if (!reviewRow || reviewRow.response_status === 'responded') continue

      // Check if already in approval queue
      const { data: existing } = await admin
        .from('prymal_approval_queue')
        .select('id')
        .eq('reference_id', reviewRow.id)
        .eq('status', 'pending')
        .single()

      if (existing) continue

      // Draft AI response
      const prompt = `You are a professional business owner responding to a Google review.

Business: ${client.business_name}
Reviewer: ${reviewerName}
Star rating: ${starRating}/5
Review: "${reviewText}"

Write a warm, professional, concise response (2-4 sentences). Do not use placeholders. Sign off naturally. Output only the response text.`

      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const aiData = await aiRes.json()
      const draft = aiData.content?.[0]?.text ?? ''

      if (!draft) continue

      // Insert into approval queue
      await admin.from('prymal_approval_queue').insert({
        client_id: client.id,
        agent: 'google',
        action_type: 'review_response',
        summary: `${starRating}★ review from ${reviewerName}: "${reviewText.slice(0, 80)}${reviewText.length > 80 ? '…' : ''}"`,
        draft_content: draft,
        reference_id: reviewRow.id,
        status: 'pending',
      })

      drafted++
    }

    results.push({ client_id: client.id, business: client.business_name, reviews: reviews.length, drafted })
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

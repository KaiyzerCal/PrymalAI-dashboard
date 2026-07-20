import Anthropic from 'npm:@anthropic-ai/sdk'
import { corsHeaders } from '../_shared/cors.ts'
import { getComposioTools, isComposioTool, executeComposioTool } from '../_shared/composio.ts'
import { createClient } from 'npm:@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
// Platform-level AI keys — used for all users; admin client keys override these
const PLATFORM_ANTHROPIC_KEY = Deno.env.get('Anthropic_api_key') ?? ''
const PLATFORM_GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Plan hierarchy
const PLAN_RANK: Record<string, number> = { free: 0, tier1: 1, tier2: 2, tier3: 3, tier4: 4, trial: 0, starter: 1, pro: 2, agency: 3 }
function planAtLeast(clientPlan: string, required: string) {
  return (PLAN_RANK[clientPlan] ?? 0) >= (PLAN_RANK[required] ?? 99)
}

function getTierFromDescription(description: string): string | null {
  const match = description.match(/\[([^\]]+)\]/)
  if (!match) return null
  const tierTag = match[1].toLowerCase().replace('+', '').replace(/\s+/g, '')
  return tierTag
}

function filterToolsByPlan(tools: Anthropic.Tool[], clientPlan: string): Anthropic.Tool[] {
  const filtered = tools.filter(tool => {
    const tierTag = getTierFromDescription(tool.description)
    const keep = !tierTag || tierTag === 'all plans' || planAtLeast(clientPlan, tierTag)
    return keep
  })
  return filtered
}

// ponytail: in-memory per-isolate rate limit — durable per-client quotas if abuse appears
const RATE_WINDOW_MS = 60 * 60 * 1000
const RATE_MAX = 60
const rateBuckets = new Map<string, number[]>()
function rateLimited(clientId: string): boolean {
  const now = Date.now()
  const hits = (rateBuckets.get(clientId) ?? []).filter(t => now - t < RATE_WINDOW_MS)
  if (hits.length >= RATE_MAX) { rateBuckets.set(clientId, hits); return true }
  hits.push(now)
  rateBuckets.set(clientId, hits)
  return false
}

function buildSystemPrompt(clientPlan: string, channel: string = 'web'): string {
  const planLabels: Record<string, string> = {
    free: 'Free (no paid features — cannot access any Google tools)',
    trial: 'Trial ($5 trial — access to all tools for testing, limited to 75 total actions)',
    tier1: 'Tier 1 ($17/mo — Gmail only)',
    tier2: 'Tier 2 ($47/mo — Gmail + Calendar + Tasks)',
    tier3: 'Tier 3 ($97/mo — Gmail + Calendar + Tasks + Drive + Docs + Sheets + Slides + Forms + Keep)',
    tier4: 'Tier 4 ($147/mo — Full Access: everything in Tier 3 + Meet + Contacts + Photos + Business Profile)',
  }
  const currentPlanLabel = planLabels[clientPlan] ?? `Unknown plan: ${clientPlan}`

  return `You are Alfy — the client's personal AI assistant on the Prymal AI platform. You manage their full Google workspace and online presence, and you act like a sharp, capable chief of staff: warm, direct, proactive, never robotic.

CURRENT USER PLAN: ${currentPlanLabel}

IMPORTANT: Only tell the user about features their current plan includes. If they ask about a feature they don't have access to, tell them which plan they need to upgrade to and direct them to Settings → Billing. Never describe paid features as available to a free or trial user unless they are on that plan.

RELATIONSHIP MEMORY (all plans):
- You have persistent memory about the people the client works with. Use remember_contact to save what you learn (who someone is, what's in flight, commitments made) whenever you read email threads, prep meetings, or the client tells you about someone. Rewrite the context_summary to stay current — don't let it go stale.
- Use recall_contacts to answer "what's the status with X?", "who do I know at Y?", or "who haven't I talked to lately?" (use stale_days for reconnection suggestions).

PROACTIVE HABITS:
- MORNING BRIEF: When the client asks "what's my day look like", "catch me up", "morning brief", or similar — compose a single tight brief: unread/important emails (get_emails "is:unread"), today's calendar (get_calendar_events, if plan allows), tasks due (list_tasks, if plan allows), and threads waiting on replies (find_followups_needed). Lead with what needs action. Keep it scannable.
- FOLLOW-UPS: When reviewing email or giving a brief, surface threads the client is waiting on with find_followups_needed and offer to draft the nudge (queue via queue_action — never send directly).
- MEETING PREP: Before meetings, or on request, use meeting_prep and deliver a short per-meeting brief: who's attending, what you know about them, latest email context, anything owed.
- After any meaningful interaction with a person's emails or events, quietly update relationship memory. Don't announce it every time.
- EARNED AUTONOMY: When you notice the client has approved the same kind of action several times without edits (check get_agent_activity), offer once — plainly — to handle that kind of thing without asking, e.g. "That's five calendar replies you've approved without changes — want me to just handle those from now on?" If they say yes, save it as a standing instruction and remind them they can take it back any time. Never offer twice for the same thing after a no.
- STANDING INSTRUCTIONS: When the client states an ongoing goal ("never let me miss a birthday", "always flag unpaid invoices", "check in on cold leads weekly"), save it with create_standing_instruction — Alfy re-checks these automatically on schedule. When you learn a birthday, save it on the contact with remember_contact.

FIRST CONTACT — the first ten minutes must produce a catch:
- If the conversation history is empty or this is clearly a new client, don't introduce yourself at length. Greet in one line, then immediately go find ONE true, useful thing they'd forgotten or missed — an unanswered thread (find_followups_needed), an unconfirmed appointment, an upcoming birthday, a bill date. Deliver it plainly and offer to handle it. That first catch is the whole first impression.
- If no accounts are connected yet, ask for the one thing you need to produce the first catch, not a setup checklist.

INVITES:
- When the client asks to invite someone ("invite Sam", "tell my sister about you"), use invite_friend. The invite text goes out only after their yes, like everything else. Never suggest inviting people unprompted.

REAL-WORLD ERRANDS — bookings, reservations, appointments, bills, travel:
- You handle these by doing the legwork, then queueing the decisive step for approval. Never claim a booking is confirmed until the counterparty confirms.
- RESERVATIONS & APPOINTMENTS (restaurants, doctors, salons, services): find the details from email history, contacts, or connected search tools. Draft the request email via queue_action (action_type 'book_appointment' or 'book_reservation', metadata.to = the venue's email). Offer 2-3 time slots that fit the client's calendar, and hold the slot on their calendar. When the venue replies, confirm the event and tell the client.
- BILLS: track due dates as standing instructions and remind before they're due. If the biller accepts email contact, draft the message via queue_action ('pay_bill'). Never move money yourself — prepare everything so the client's yes is the only remaining step, and say plainly what you could and couldn't do.
- FLIGHTS & TRAVEL: when search tools are connected, search real options and present the 2-3 best with concrete prices and times. Book by queueing the decisive step for approval ('book_flight', all details in metadata). Without search tools, say so honestly and offer the draft-a-request route instead.
- Always sanity-check dates and times against the client's calendar before proposing anything.

TONE — sound like a person, not a chatbot:
- No signposting ("Here's what I found:", "Great question!"). Just say the thing.
- No chatbot sign-offs ("Let me know if you need anything else!", "Hope that helps!"). End when you're done.
- Don't force lists of three or bullet-point everything. Use however many points are actually true, in prose when prose reads better.
- Don't bold half the message. Bold at most the one thing that matters, usually nothing.
- Don't hedge on things you already know. "3pm works" — not "Based on your calendar, it looks like 3pm could potentially work." If you checked, state it.
${channel === 'sms' ? `
SMS MODE — you are talking over text message:
- Keep replies SHORT. Under 500 characters whenever possible. No markdown, no headers, no bullets with asterisks — plain text with simple dashes.
- One thing at a time. If there's a lot to report, give the top 2-3 items and offer "reply MORE for the rest".
- For approvals: describe the queued action in one line and say "Reply YES to approve or NO to skip." When the user replies YES, approve the most recent pending action.
- Never send long documents or full email bodies over SMS — summarize and mention the dashboard for detail.
- Text like a sharp friend: lowercase-casual is fine, but never sloppy about facts, names, or numbers.
` : ''}${channel === 'automation' ? `
AUTOMATION MODE — this is a scheduled background check. No human is reading this conversation live.
- You are re-checking a standing instruction the client gave earlier. Use tools to look at the current state (contacts, calendar, memory, email) and decide whether action is needed TODAY.
- If nothing needs doing right now, reply with exactly: NO_ACTION
- If something needs doing, take it: anything external goes through queue_action for approval as always; internal things (calendar events for the client themselves, memory updates) you may do directly.
- Finish with one short line describing what you did, so it can be logged.
` : ''}
${SYSTEM_CAPABILITIES}`
}

const SYSTEM_CAPABILITIES = `CAPABILITIES BY TIER:
- Free ($0/mo): Dashboard & profile setup only (no agent access)

- Tier 1 ($17/mo) — EMAIL MASTERY: Gmail
  ✓ Read, compose, send, manage emails
  ✓ Create labels for organization
  ✓ Apply/remove labels, archive emails
  ✓ Create filters, set auto-reply
  ✓ Schedule sends for later
  ✓ Mark emails as read/unread
  ✓ Delete emails permanently

- Tier 2 ($47/mo) — CALENDAR & TASKS: Everything in Tier 1 + Calendar, Tasks
  ✓ Calendar: Schedule events, update/delete, check availability
  ✓ Google Tasks: Create, update, complete tasks with due dates
  ✓ All Tier 1 capabilities

- Tier 3 ($97/mo) — DOCS & COLLABORATION: Everything in Tier 2 + Drive, Docs, Sheets, Slides, Forms, Keep, Places
  ✓ Google Drive: Create folders, move/organize/delete/share files
  ✓ Google Docs: Create, edit, share documents
  ✓ Google Sheets: Create sheets, add/update data
  ✓ Google Slides: Create presentations, add/edit slides
  ✓ Google Forms: Create surveys and forms
  ✓ Google Keep: Create and manage notes
  ✓ Google Places: Location intelligence for scheduling/planning
  ✓ All Tier 2 capabilities

- Tier 4 ($147/mo) — FULL ACCESS: Everything in Tier 3 + Meet, Contacts, Photos, Business Profile
  ✓ Google Meet: Schedule video calls
  ✓ Google Contacts: Create, update, delete, search contacts
  ✓ Google Photos: Upload, organize, create albums, find/delete duplicates
  ✓ Google Business Profile: Respond to reviews, create posts
  ✓ Photo intelligence: Detect duplicate photos, smart organization
  ✓ All Tier 3 capabilities

AI ENGINE: Runs on platform-managed keys (Claude Haiku primary, Gemini fallback). Clients never need their own API key.

RULES — never break these:
1. Never post, send, or create anything externally without going through queue_action first. The client approves everything in the dashboard before it goes out.
2. Reading data (reviews, emails, events, files) is always safe — do it freely.
3. If a client asks for a feature their plan doesn't include, tell them clearly which plan unlocks it and what it does.
4. If a Google service isn't connected yet, tell the client to go to Settings → Integrations to connect it.
5. Match the client's brand tone when drafting any content. If brand tone isn't set, ask first.
6. Be specific — tell the client exactly what you found, what you drafted, and why.

FORMATTING — always follow these:
- Use **bold** for file names, labels, and key terms.
- Use bullet lists for listing files, emails, or events.
- When analyze_file returns content that already contains ![name](url) markdown for an image, pass it through exactly as-is — do not remove or rewrite it.
- When get_file_info returns a thumbnailUrl for an image, display it with: ![filename](thumbnailUrl)
- For videos, provide the webViewLink as a clickable markdown link: [Watch video](url)
- For documents with content, show a clean summary followed by the key content.`

// ── Token management ──────────────────────────────────────────────────────────

async function getFreshToken(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  platform: string
): Promise<string | null> {
  try {

    const { data, error } = await supabase
      .from('prymal_oauth_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('client_id', clientId)
      .eq('platform', platform)
      .single()


    if (error) {
      console.warn(`[WARN] getFreshToken query error: ${error.message}`)
      return null
    }

    if (!data) {
      console.warn(`[WARN] No token found for clientId=${clientId}, platform=${platform}`)
      return null
    }


    const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0
    if (Date.now() < expiresAt - 60000) {
      return data.access_token
    }

    if (!data.refresh_token) {
      console.warn(`[WARN] getFreshToken: No refresh token, cannot refresh`)
      return null
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: data.refresh_token,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
      }),
    })
    const tokens = await res.json()
    if (!tokens.access_token) return null

    await supabase.from('prymal_oauth_tokens').update({
      access_token: tokens.access_token,
      expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
    }).eq('client_id', clientId).eq('platform', platform)

    return tokens.access_token
  } catch (err) {
    console.error(`[ERROR] getFreshToken exception: ${(err as Error).message}`)
    return null
  }
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  // ── All plans ──
  {
    name: 'get_client_info',
    description: 'Get the client profile: business name, plan, brand tone, knowledge base, GBP IDs, and which Google services are connected.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'get_pending_approvals',
    description: 'Get all actions queued for client approval, optionally filtered by type.',
    input_schema: {
      type: 'object',
      properties: {
        action_type: { type: 'string', description: 'Filter by type: respond_to_review, send_email, create_event, drive_report. Omit for all.' }
      }
    }
  },
  {
    name: 'resolve_pending_action',
    description: 'Approve (execute) or reject a pending action from the approval queue. Use when the client says YES/approve or NO/skip to a queued action. Defaults to the most recent pending action if no id given.',
    input_schema: {
      type: 'object',
      properties: {
        decision: { type: 'string', description: "'approve' or 'reject'" },
        approval_id: { type: 'string', description: 'Specific approval row id. Omit to act on the most recent pending action.' },
        edited_content: { type: 'string', description: 'If the client asked for a change, the revised content to send instead of the draft.' }
      },
      required: ['decision']
    }
  },
  {
    name: 'invite_friend',
    description: 'Invite someone to Alfy by text, when the client asks to. Queues the invite text for approval first — it only sends after their yes.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: "The friend's first name" },
        phone: { type: 'string', description: 'Their mobile number, E.164 like +15551234567' }
      },
      required: ['name', 'phone']
    }
  },
  {
    name: 'get_agent_activity',
    description: 'Get history of approved or rejected actions.',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'number', default: 10 } }
    }
  },
  {
    name: 'queue_action',
    description: 'Queue any action for client approval before it goes external. Always use this before sending, posting, or creating anything.',
    input_schema: {
      type: 'object',
      properties: {
        action_type: { type: 'string', description: 'e.g. respond_to_review, send_email, create_event, drive_report, book_reservation, book_appointment, book_flight, pay_bill' },
        summary: { type: 'string', description: 'Short title for the approval card' },
        draft_content: { type: 'string', description: 'Full content the client will review' },
        metadata: { type: 'object', description: 'Extra context. For send_email: always include "to" (recipient email address) and "subject". For review responses: review_id. For events: start, end, title, attendees.' },
        batch_id: { type: 'string', description: 'When one request produces several related actions (e.g. 5 tickets + a summary post), give them all the same short batch_id so the client can approve them together as one card.' }
      },
      required: ['action_type', 'summary', 'draft_content']
    }
  },
  {
    name: 'update_client_info',
    description: "Update the client's brand tone or knowledge base.",
    input_schema: {
      type: 'object',
      properties: {
        brand_tone: { type: 'string' },
        knowledge_base: { type: 'string' }
      }
    }
  },

  // ── All plans : Relationship memory (Alfy) ──
  {
    name: 'remember_contact',
    description: 'Save or update relationship memory for a contact. Call this whenever you learn something meaningful about a person — after reading email threads, scheduling meetings, or when the client tells you about someone. Merge new context with what you already know.',
    input_schema: {
      type: 'object',
      properties: {
        contact_email: { type: 'string', description: 'The contact\'s email address (unique key)' },
        contact_name: { type: 'string' },
        company: { type: 'string' },
        context_summary: { type: 'string', description: 'What you know: who they are, current threads, commitments, preferences. Keep it current — rewrite, don\'t append endlessly.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'e.g. ["client", "investor", "new-york", "fitness"]' },
        last_interaction: { type: 'string', description: 'ISO date of the most recent interaction, if known' },
        birthday: { type: 'string', description: 'Birthday if known, e.g. "March 3" or "1990-03-03". Year optional.' }
      },
      required: ['contact_email', 'context_summary']
    }
  },
  {
    name: 'create_standing_instruction',
    description: 'Save a standing instruction — an ongoing goal Alfy re-checks automatically on a schedule (e.g. "never let me miss a birthday", "remind me to follow up with cold leads weekly", "keep an eye on invoices that go unpaid"). Store the goal in the client\'s own words.',
    input_schema: {
      type: 'object',
      properties: {
        goal_text: { type: 'string', description: 'The ongoing goal, phrased as the client stated it' },
        cadence: { type: 'string', enum: ['hourly', 'daily', 'weekly'], description: 'How often to re-check. Default daily.' }
      },
      required: ['goal_text']
    }
  },
  {
    name: 'list_standing_instructions',
    description: 'List the client\'s active standing instructions and when each last ran.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'cancel_standing_instruction',
    description: 'Cancel a standing instruction by id (get ids from list_standing_instructions).',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id']
    }
  },
  {
    name: 'recall_contacts',
    description: 'Search relationship memory. Use for "what\'s the status with X?", "who do I know at Y?", "who haven\'t I spoken to in a while?". Searches name, email, company, and context.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text search across name, email, company, and context summary' },
        tag: { type: 'string', description: 'Filter by a single tag' },
        stale_days: { type: 'number', description: 'Only return contacts with no interaction in this many days (for reconnection suggestions)' },
        limit: { type: 'number', default: 10 }
      }
    }
  },
  {
    name: 'find_followups_needed',
    description: '[Tier 1+] Scan sent Gmail for threads where the client sent the last message and never received a reply. Use for proactive follow-up suggestions and the morning brief.',
    input_schema: {
      type: 'object',
      properties: {
        days_back: { type: 'number', default: 14, description: 'How far back to scan sent mail' },
        min_age_days: { type: 'number', default: 3, description: 'Only flag threads where the unanswered message is at least this old' },
        maxThreads: { type: 'number', default: 15 }
      }
    }
  },
  {
    name: 'meeting_prep',
    description: '[Tier 2+] Build a prep brief for upcoming meetings: pulls calendar events, recent email history with each attendee, and relationship memory. Use when the client asks to prep for a meeting or as part of the morning brief.',
    input_schema: {
      type: 'object',
      properties: {
        hours_ahead: { type: 'number', default: 48, description: 'Look-ahead window for events' },
        event_id: { type: 'string', description: 'Prep a single specific event instead' }
      }
    }
  },

  // ── Pro+ : GBP ──
  {
    name: 'get_reviews',
    description: '[Tier 4+] Fetch reviews from Google Business Profile. Returns reviewer, rating, comment, and whether a reply exists.',
    input_schema: {
      type: 'object',
      properties: {
        pageSize: { type: 'number', default: 20, description: 'Number of reviews (max 50)' },
        orderBy: { type: 'string', default: 'updateTime desc', description: '"updateTime desc" (newest) or "rating" (lowest first)' }
      }
    }
  },

  // ── Starter+ : Gmail ──
  {
    name: 'get_emails',
    description: '[Tier 1+] Search and list Gmail messages. Use to find unanswered inquiries, leads, or any email thread.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail search query, e.g. "is:unread", "from:customer@example.com", "subject:invoice"' },
        maxResults: { type: 'number', default: 10, description: 'Number of emails to return (max 50)' }
      }
    }
  },
  {
    name: 'get_email_thread',
    description: '[Tier 1+] Get the full content of an email thread by thread ID.',
    input_schema: {
      type: 'object',
      properties: {
        threadId: { type: 'string', description: 'Gmail thread ID' }
      },
      required: ['threadId']
    }
  },

  // ── Tier 2+ : Calendar ──
  {
    name: 'get_calendar_events',
    description: '[Tier 2+] List upcoming Google Calendar events.',
    input_schema: {
      type: 'object',
      properties: {
        timeMin: { type: 'string', description: 'Start of range in ISO 8601. Defaults to now.' },
        timeMax: { type: 'string', description: 'End of range in ISO 8601. Defaults to 7 days from now.' },
        maxResults: { type: 'number', default: 20 }
      }
    }
  },
  {
    name: 'get_availability',
    description: '[Tier 2+] Check free/busy slots on Google Calendar for a given time range.',
    input_schema: {
      type: 'object',
      properties: {
        timeMin: { type: 'string', description: 'Start of range ISO 8601' },
        timeMax: { type: 'string', description: 'End of range ISO 8601' }
      },
      required: ['timeMin', 'timeMax']
    }
  },

  // ── Starter+ : Drive ──
  {
    name: 'search_drive_files',
    description: '[Tier 3+] Search Google Drive for files by name or content.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Drive search query, e.g. "name contains \'report\'" or "mimeType=\'application/pdf\'"' },
        maxResults: { type: 'number', default: 10 }
      }
    }
  },
  {
    name: 'read_drive_file',
    description: '[Tier 3+] Read the text content of a Google Drive document.',
    input_schema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' }
      },
      required: ['fileId']
    }
  },

  // ── Tier 1: Email Composition & Sending ──
  {
    name: 'send_email',
    description: '[Tier 1+] Compose and send an email. Requires user approval before sending.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject line' },
        body: { type: 'string', description: 'Email body (plain text or HTML)' },
        cc: { type: 'string', description: 'CC recipients (comma-separated, optional)' },
        bcc: { type: 'string', description: 'BCC recipients (comma-separated, optional)' }
      },
      required: ['to', 'subject', 'body']
    }
  },

  // ── Tier 1: Label Management ──
  {
    name: 'list_labels',
    description: '[Tier 1+] List all Gmail labels for organizing emails.',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'create_label',
    description: '[Tier 1+] Create a new Gmail label for organizing emails.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Label name (e.g., "Invoices", "Follow-up", "Important")' },
        labelListVisibility: { type: 'string', description: 'Whether to show in label list: "labelShow" or "labelHide"', default: 'labelShow' },
        messageListVisibility: { type: 'string', description: 'Whether to show next to messages: "show" or "hide"', default: 'show' }
      },
      required: ['name']
    }
  },
  {
    name: 'apply_label',
    description: '[Tier 1+] Add a label to one or more emails.',
    input_schema: {
      type: 'object',
      properties: {
        threadIds: { type: 'array', items: { type: 'string' }, description: 'Gmail thread IDs to label' },
        labelName: { type: 'string', description: 'Label name to apply' }
      },
      required: ['threadIds', 'labelName']
    }
  },
  {
    name: 'remove_label',
    description: '[Tier 1+] Remove a label from one or more emails.',
    input_schema: {
      type: 'object',
      properties: {
        threadIds: { type: 'array', items: { type: 'string' }, description: 'Gmail thread IDs' },
        labelName: { type: 'string', description: 'Label name to remove' }
      },
      required: ['threadIds', 'labelName']
    }
  },
  {
    name: 'archive_email',
    description: '[Tier 1+] Archive one or more emails (remove from inbox).',
    input_schema: {
      type: 'object',
      properties: {
        threadIds: { type: 'array', items: { type: 'string' }, description: 'Gmail thread IDs to archive' }
      },
      required: ['threadIds']
    }
  },
  {
    name: 'delete_email',
    description: '[Tier 1+] Permanently delete one or more emails.',
    input_schema: {
      type: 'object',
      properties: {
        threadIds: { type: 'array', items: { type: 'string' }, description: 'Gmail thread IDs to delete' }
      },
      required: ['threadIds']
    }
  },
  {
    name: 'mark_as_read',
    description: '[Tier 1+] Mark one or more emails as read.',
    input_schema: {
      type: 'object',
      properties: {
        threadIds: { type: 'array', items: { type: 'string' }, description: 'Gmail thread IDs to mark as read' }
      },
      required: ['threadIds']
    }
  },
  {
    name: 'mark_as_unread',
    description: '[Tier 1+] Mark one or more emails as unread.',
    input_schema: {
      type: 'object',
      properties: {
        threadIds: { type: 'array', items: { type: 'string' }, description: 'Gmail thread IDs to mark as unread' }
      },
      required: ['threadIds']
    }
  },
  {
    name: 'create_filter',
    description: '[Tier 1+] Create an email filter (auto-label, archive, delete based on criteria).',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Filter emails from this address (optional)' },
        to: { type: 'string', description: 'Filter emails to this address (optional)' },
        subject: { type: 'string', description: 'Filter by subject line (optional)' },
        query: { type: 'string', description: 'Gmail search query for filter (optional)' },
        action: { type: 'string', description: 'Action to take: "label", "archive", "delete", "skip_inbox"' },
        label: { type: 'string', description: 'Label to apply (if action is "label")' }
      },
      required: ['action']
    }
  },
  {
    name: 'set_auto_reply',
    description: '[Tier 1+] Set vacation/auto-reply message.',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Auto-reply message text' },
        subject: { type: 'string', description: 'Subject line for auto-reply', default: 'Out of Office' },
        startTime: { type: 'string', description: 'Start date/time (ISO 8601, optional)' },
        endTime: { type: 'string', description: 'End date/time (ISO 8601, optional)' },
        restrictToContacts: { type: 'boolean', description: 'Only reply to contacts in address book?', default: false },
        restrictToDomain: { type: 'boolean', description: 'Only reply to same domain?', default: false }
      },
      required: ['message']
    }
  },
  {
    name: 'schedule_send',
    description: '[Tier 1+] Schedule an email to send at a future time.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject line' },
        body: { type: 'string', description: 'Email body (plain text or HTML)' },
        sendAt: { type: 'string', description: 'When to send (ISO 8601 format)' },
        cc: { type: 'string', description: 'CC recipients (comma-separated, optional)' },
        bcc: { type: 'string', description: 'BCC recipients (comma-separated, optional)' }
      },
      required: ['to', 'subject', 'body', 'sendAt']
    }
  },

  // ── Tier 2: Calendar Events ──
  {
    name: 'create_event',
    description: '[Tier 2+] Schedule a calendar event.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Event title' },
        startTime: { type: 'string', description: 'Start time (ISO 8601 format, e.g., "2026-06-30T14:00:00")' },
        endTime: { type: 'string', description: 'End time (ISO 8601 format)' },
        description: { type: 'string', description: 'Event description (optional)' },
        attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee emails (optional)' },
        location: { type: 'string', description: 'Event location (optional)' }
      },
      required: ['title', 'startTime', 'endTime']
    }
  },

  // ── Tier 2: Calendar Events (Write) ──
  {
    name: 'update_event',
    description: '[Tier 2+] Update an existing calendar event.',
    input_schema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Calendar event ID' },
        title: { type: 'string', description: 'New event title (optional)' },
        startTime: { type: 'string', description: 'New start time (ISO 8601, optional)' },
        endTime: { type: 'string', description: 'New end time (ISO 8601, optional)' },
        description: { type: 'string', description: 'New description (optional)' },
        location: { type: 'string', description: 'New location (optional)' },
        attendees: { type: 'array', items: { type: 'string' }, description: 'New attendee list (optional)' }
      },
      required: ['eventId']
    }
  },
  {
    name: 'delete_event',
    description: '[Tier 2+] Delete a calendar event.',
    input_schema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Calendar event ID to delete' }
      },
      required: ['eventId']
    }
  },

  // ── Tier 2: Google Tasks ──
  {
    name: 'create_task',
    description: '[Tier 2+] Create a new Google Task.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description (optional)' },
        dueDate: { type: 'string', description: 'Due date (ISO 8601 format, e.g., "2026-06-30", optional)' }
      },
      required: ['title']
    }
  },
  {
    name: 'list_tasks',
    description: '[Tier 2+] List Google Tasks from task lists.',
    input_schema: {
      type: 'object',
      properties: {
        maxResults: { type: 'number', default: 20, description: 'Number of tasks to return (max 100)' },
        showCompleted: { type: 'boolean', default: false, description: 'Include completed tasks?' }
      }
    }
  },
  {
    name: 'update_task',
    description: '[Tier 2+] Update a Google Task.',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID to update' },
        title: { type: 'string', description: 'New task title (optional)' },
        description: { type: 'string', description: 'New description (optional)' },
        dueDate: { type: 'string', description: 'New due date (ISO 8601, optional)' },
        status: { type: 'string', description: 'New status: "needsAction" or "completed"' }
      },
      required: ['taskId']
    }
  },
  {
    name: 'complete_task',
    description: '[Tier 2+] Mark a task as complete.',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID to mark complete' }
      },
      required: ['taskId']
    }
  },

  // ── Tier 3: Google Drive ──
  {
    name: 'create_folder',
    description: '[Tier 3+] Create a new Google Drive folder.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Folder name' },
        parentFolderId: { type: 'string', description: 'Parent folder ID (optional, defaults to root)' }
      },
      required: ['name']
    }
  },
  {
    name: 'move_file',
    description: '[Tier 3+] Move a file to a different folder in Google Drive.',
    input_schema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File ID to move' },
        targetFolderId: { type: 'string', description: 'Target folder ID' }
      },
      required: ['fileId', 'targetFolderId']
    }
  },
  {
    name: 'delete_file',
    description: '[Tier 3+] Delete a file from Google Drive.',
    input_schema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File ID to delete' },
        permanently: { type: 'boolean', default: false, description: 'Permanently delete? (true) or move to trash? (false)' }
      },
      required: ['fileId']
    }
  },
  {
    name: 'rename_file',
    description: '[Tier 3+] Rename a file in Google Drive.',
    input_schema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File ID' },
        newName: { type: 'string', description: 'New file name' }
      },
      required: ['fileId', 'newName']
    }
  },
  {
    name: 'share_file',
    description: '[Tier 3+] Share a file with others.',
    input_schema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File ID to share' },
        emailAddresses: { type: 'array', items: { type: 'string' }, description: 'Email addresses to share with' },
        role: { type: 'string', description: 'Permission level: "reader", "commenter", or "writer"', default: 'reader' },
        sendNotification: { type: 'boolean', default: true, description: 'Send email notifications?' }
      },
      required: ['fileId', 'emailAddresses']
    }
  },
  {
    name: 'set_permissions',
    description: '[Tier 3+] Set file permissions (public, restricted, etc).',
    input_schema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File ID' },
        type: { type: 'string', description: 'Permission type: "user", "group", "domain", "anyone"' },
        role: { type: 'string', description: 'Role: "reader", "commenter", "writer", "owner"' },
        value: { type: 'string', description: 'Email (for user/group) or domain (for domain), optional for anyone' }
      },
      required: ['fileId', 'type', 'role']
    }
  },

  // ── Tier 3: Google Docs ──
  {
    name: 'create_document',
    description: '[Tier 3+] Create a new Google Doc.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Document title' },
        content: { type: 'string', description: 'Initial document content (optional)' },
        parentFolderId: { type: 'string', description: 'Parent folder ID (optional)' }
      },
      required: ['title']
    }
  },
  {
    name: 'update_document',
    description: '[Tier 3+] Update content in a Google Doc.',
    input_schema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'Document ID' },
        content: { type: 'string', description: 'New content or append' },
        mode: { type: 'string', description: '"replace" entire doc or "append" to end', default: 'append' }
      },
      required: ['documentId', 'content']
    }
  },

  // ── Tier 3: Google Sheets ──
  {
    name: 'create_sheet',
    description: '[Tier 3+] Create a new Google Sheet.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Spreadsheet title' },
        parentFolderId: { type: 'string', description: 'Parent folder ID (optional)' }
      },
      required: ['title']
    }
  },
  {
    name: 'update_sheet',
    description: '[Tier 3+] Add or update data in a Google Sheet.',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
        sheetName: { type: 'string', description: 'Sheet name (tab) to update', default: 'Sheet1' },
        range: { type: 'string', description: 'Cell range (e.g., "A1:C10"), optional for appending' },
        values: { type: 'array', description: 'Array of rows: [[col1, col2], [col1, col2]]' },
        mode: { type: 'string', description: '"update" existing range or "append" new rows', default: 'append' }
      },
      required: ['spreadsheetId', 'values']
    }
  },

  // ── Tier 3: Google Slides ──
  {
    name: 'create_slide',
    description: '[Tier 3+] Create a new Google Slides presentation.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Presentation title' },
        parentFolderId: { type: 'string', description: 'Parent folder ID (optional)' }
      },
      required: ['title']
    }
  },
  {
    name: 'update_slide',
    description: '[Tier 3+] Add or edit a slide in a presentation.',
    input_schema: {
      type: 'object',
      properties: {
        presentationId: { type: 'string', description: 'Presentation ID' },
        slideIndex: { type: 'number', description: 'Slide number (0-based) or -1 for new slide' },
        title: { type: 'string', description: 'Slide title (optional)' },
        content: { type: 'string', description: 'Slide content/text (optional)' }
      },
      required: ['presentationId']
    }
  },

  // ── Tier 4: Google Meet ──
  {
    name: 'schedule_meet',
    description: '[Tier 4+] Schedule a Google Meet call and add to calendar.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Meeting title' },
        startTime: { type: 'string', description: 'Start time (ISO 8601)' },
        endTime: { type: 'string', description: 'End time (ISO 8601)' },
        attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee email addresses' },
        description: { type: 'string', description: 'Meeting description (optional)' }
      },
      required: ['title', 'startTime', 'endTime']
    }
  },

  // ── Tier 4: Google Contacts ──
  {
    name: 'create_contact',
    description: '[Tier 4+] Create a new contact in Google Contacts.',
    input_schema: {
      type: 'object',
      properties: {
        givenName: { type: 'string', description: 'First name' },
        familyName: { type: 'string', description: 'Last name' },
        email: { type: 'string', description: 'Email address (optional)' },
        phone: { type: 'string', description: 'Phone number (optional)' },
        company: { type: 'string', description: 'Company name (optional)' },
        jobTitle: { type: 'string', description: 'Job title (optional)' },
        notes: { type: 'string', description: 'Notes (optional)' }
      },
      required: ['givenName', 'familyName']
    }
  },
  {
    name: 'update_contact',
    description: '[Tier 4+] Update a contact in Google Contacts.',
    input_schema: {
      type: 'object',
      properties: {
        resourceName: { type: 'string', description: 'Contact resource name (from list)' },
        givenName: { type: 'string', description: 'First name (optional)' },
        familyName: { type: 'string', description: 'Last name (optional)' },
        email: { type: 'string', description: 'Email address (optional)' },
        phone: { type: 'string', description: 'Phone number (optional)' },
        company: { type: 'string', description: 'Company name (optional)' },
        jobTitle: { type: 'string', description: 'Job title (optional)' },
        notes: { type: 'string', description: 'Notes (optional)' }
      },
      required: ['resourceName']
    }
  },
  {
    name: 'delete_contact',
    description: '[Tier 4+] Delete a contact from Google Contacts.',
    input_schema: {
      type: 'object',
      properties: {
        resourceName: { type: 'string', description: 'Contact resource name' }
      },
      required: ['resourceName']
    }
  },
  {
    name: 'list_contacts',
    description: '[Tier 4+] List contacts from Google Contacts.',
    input_schema: {
      type: 'object',
      properties: {
        maxResults: { type: 'number', default: 50, description: 'Number of contacts (max 1000)' },
        query: { type: 'string', description: 'Search query (optional)' }
      }
    }
  },

  // ── Tier 4: Google Business Profile ──
  {
    name: 'respond_to_review',
    description: '[Tier 4+] Respond to a Google Business Profile review.',
    input_schema: {
      type: 'object',
      properties: {
        reviewId: { type: 'string', description: 'Review ID to respond to' },
        responseText: { type: 'string', description: 'Your response message' }
      },
      required: ['reviewId', 'responseText']
    }
  },
  {
    name: 'create_post',
    description: '[Tier 4+] Create a post on Google Business Profile.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Post title' },
        content: { type: 'string', description: 'Post content/description' },
        type: { type: 'string', description: 'Post type: "STANDARD", "EVENT", "OFFER", "PRODUCT"', default: 'STANDARD' },
        callToAction: { type: 'string', description: 'Call-to-action button: "CALL", "BOOK", "ORDER"', default: 'BOOK' }
      },
      required: ['title', 'content']
    }
  },

  // ── Tier 4: Google Photos ──
  {
    name: 'upload_photo',
    description: '[Tier 4+] Upload a photo to Google Photos.',
    input_schema: {
      type: 'object',
      properties: {
        photoUrl: { type: 'string', description: 'URL of photo to upload' },
        description: { type: 'string', description: 'Photo description (optional)' }
      },
      required: ['photoUrl']
    }
  },
  {
    name: 'create_album',
    description: '[Tier 4+] Create an album in Google Photos.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Album title' },
        description: { type: 'string', description: 'Album description (optional)' }
      },
      required: ['title']
    }
  },
  {
    name: 'organize_photos',
    description: '[Tier 4+] Add photos to an album in Google Photos.',
    input_schema: {
      type: 'object',
      properties: {
        albumId: { type: 'string', description: 'Album ID' },
        photoIds: { type: 'array', items: { type: 'string' }, description: 'Photo IDs to add' }
      },
      required: ['albumId', 'photoIds']
    }
  },
  {
    name: 'find_duplicate_photos',
    description: '[Tier 4+] Detect and identify duplicate or very similar photos in Google Photos (exact matches, near-duplicates, similar compositions).',
    input_schema: {
      type: 'object',
      properties: {
        maxResults: { type: 'number', default: 50, description: 'Number of photos to analyze (max 1000)' },
        similarity: { type: 'string', default: 'high', description: 'Detection sensitivity: "exact" (pixel-perfect), "high" (98%+ match), "medium" (90%+ match)' }
      }
    }
  },
  {
    name: 'delete_duplicate_photos',
    description: '[Tier 4+] Remove duplicate photos, intelligently keeping the best quality version from each group.',
    input_schema: {
      type: 'object',
      properties: {
        duplicateGroupIds: { type: 'array', items: { type: 'string' }, description: 'Groups of duplicate photo IDs to clean up (one ID per duplicate group)' },
        keepHighestResolution: { type: 'boolean', default: true, description: 'Keep the highest resolution photo in each duplicate group?' },
        keepLatest: { type: 'boolean', default: false, description: 'Or keep the most recently uploaded version?' },
        moveToTrash: { type: 'boolean', default: true, description: 'Move to trash (recoverable) or permanently delete?' }
      },
      required: ['duplicateGroupIds']
    }
  },
  {
    name: 'auto_organize_photos',
    description: '[Tier 4+] Intelligently organize photos by date, location, or detected content (people, objects, scenes).',
    input_schema: {
      type: 'object',
      properties: {
        organizationMethod: { type: 'string', description: 'Organization method: "by_date" (year/month folders), "by_location" (detected places), "by_content" (people/objects), "smart" (AI-powered)' },
        createAlbums: { type: 'boolean', default: true, description: 'Create albums automatically?' },
        maxPhotosToProcess: { type: 'number', default: 500, description: 'Maximum photos to process (higher = more thorough but slower)' },
        mergeExisting: { type: 'boolean', default: false, description: 'Merge with existing albums of same category?' }
      },
      required: ['organizationMethod']
    }
  },

  // ── Tier 3: Drive — list & inspect ──
  {
    name: 'list_drive_files',
    description: '[Tier 3+] List files and folders in Google Drive. Can list a specific folder or the root. Returns name, type, size, modified date, and link.',
    input_schema: {
      type: 'object',
      properties: {
        folderId: { type: 'string', description: 'Folder ID to list. Omit for root "My Drive".' },
        query: { type: 'string', description: 'Optional search query, e.g. "name contains \'report\'" or "mimeType=\'application/pdf\'"' },
        maxResults: { type: 'number', default: 50 },
        includeSubfolders: { type: 'boolean', default: false, description: 'Include files in subfolders?' }
      }
    }
  },
  {
    name: 'get_file_info',
    description: '[Tier 3+] Get full metadata for any file or folder in Google Drive — name, type, size, owner, sharing settings, web link.',
    input_schema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file or folder ID' }
      },
      required: ['fileId']
    }
  },
  {
    name: 'analyze_file',
    description: '[Tier 3+] Open and analyze any file in Google Drive — documents, spreadsheets, images, PDFs, code files, etc. For images: describes what is seen. For docs/sheets: returns content. For videos: returns metadata and description.',
    input_schema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' },
        maxChars: { type: 'number', default: 5000, description: 'Max characters to return for text content' }
      },
      required: ['fileId']
    }
  },

  // ── Tier 3: Docs full CRUD ──
  {
    name: 'read_document',
    description: '[Tier 3+] Read the full content of a Google Doc.',
    input_schema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'Google Doc document ID' }
      },
      required: ['documentId']
    }
  },
  {
    name: 'delete_document',
    description: '[Tier 3+] Delete a Google Doc (moves to trash).',
    input_schema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'Google Doc document ID' },
        permanently: { type: 'boolean', default: false, description: 'Permanently delete instead of trash?' }
      },
      required: ['documentId']
    }
  },

  // ── Tier 3: Sheets full CRUD ──
  {
    name: 'read_sheet',
    description: '[Tier 3+] Read data from a Google Sheet — returns rows, columns, and cell values.',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string', description: 'Google Sheets spreadsheet ID' },
        sheetName: { type: 'string', description: 'Sheet tab name. Defaults to first sheet.' },
        range: { type: 'string', description: 'Cell range e.g. "A1:D20". Omit for entire sheet.' }
      },
      required: ['spreadsheetId']
    }
  },
  {
    name: 'delete_sheet',
    description: '[Tier 3+] Delete a Google Spreadsheet (moves to trash).',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string', description: 'Google Sheets spreadsheet ID' },
        permanently: { type: 'boolean', default: false }
      },
      required: ['spreadsheetId']
    }
  },

  // ── Tier 3: Slides full CRUD ──
  {
    name: 'read_presentation',
    description: '[Tier 3+] Read the content and structure of a Google Slides presentation — slide titles, text, speaker notes.',
    input_schema: {
      type: 'object',
      properties: {
        presentationId: { type: 'string', description: 'Google Slides presentation ID' }
      },
      required: ['presentationId']
    }
  },
  {
    name: 'delete_presentation',
    description: '[Tier 3+] Delete a Google Slides presentation (moves to trash).',
    input_schema: {
      type: 'object',
      properties: {
        presentationId: { type: 'string', description: 'Google Slides presentation ID' },
        permanently: { type: 'boolean', default: false }
      },
      required: ['presentationId']
    }
  },

  // ── Tier 3: Google Forms ──
  {
    name: 'create_form',
    description: '[Tier 3+] Create a Google Form with questions.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Form title' },
        description: { type: 'string', description: 'Form description (optional)' },
        questions: { type: 'array', description: 'Array of questions: [{title, type: "SHORT_ANSWER"|"PARAGRAPH"|"MULTIPLE_CHOICE"|"CHECKBOX", options: []}]' }
      },
      required: ['title']
    }
  },
  {
    name: 'read_form',
    description: '[Tier 3+] Read a Google Form — returns title, questions, and structure.',
    input_schema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Google Form ID' }
      },
      required: ['formId']
    }
  },
  {
    name: 'list_form_responses',
    description: '[Tier 3+] Get responses submitted to a Google Form.',
    input_schema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Google Form ID' },
        maxResults: { type: 'number', default: 50 }
      },
      required: ['formId']
    }
  },
  {
    name: 'delete_form',
    description: '[Tier 3+] Delete a Google Form.',
    input_schema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'Google Form ID' }
      },
      required: ['formId']
    }
  },

  // ── Tier 3: Google Keep ──
  {
    name: 'create_note',
    description: '[Tier 3+] Create a note in Google Keep.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Note title (optional)' },
        content: { type: 'string', description: 'Note body text' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Label names to apply (optional)' }
      },
      required: ['content']
    }
  },
  {
    name: 'list_notes',
    description: '[Tier 3+] List notes in Google Keep.',
    input_schema: {
      type: 'object',
      properties: {
        maxResults: { type: 'number', default: 20 },
        filter: { type: 'string', description: 'Filter notes: "pinned", "archived", or a label name' }
      }
    }
  },
  {
    name: 'update_note',
    description: '[Tier 3+] Update the title or content of a Google Keep note.',
    input_schema: {
      type: 'object',
      properties: {
        noteId: { type: 'string', description: 'Note ID' },
        title: { type: 'string', description: 'New title (optional)' },
        content: { type: 'string', description: 'New content (optional)' }
      },
      required: ['noteId']
    }
  },
  {
    name: 'delete_note',
    description: '[Tier 3+] Delete a Google Keep note.',
    input_schema: {
      type: 'object',
      properties: {
        noteId: { type: 'string', description: 'Note ID' }
      },
      required: ['noteId']
    }
  },

  // ── Tier 4: Meet full CRUD ──
  {
    name: 'list_meetings',
    description: '[Tier 4+] List upcoming Google Meet meetings from your calendar.',
    input_schema: {
      type: 'object',
      properties: {
        maxResults: { type: 'number', default: 20 },
        timeMin: { type: 'string', description: 'Start of search range (ISO 8601). Defaults to now.' },
        timeMax: { type: 'string', description: 'End of search range (ISO 8601). Defaults to 30 days from now.' }
      }
    }
  },
  {
    name: 'cancel_meeting',
    description: '[Tier 4+] Cancel a Google Meet meeting and optionally notify attendees.',
    input_schema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Calendar event ID for the meeting' },
        notifyAttendees: { type: 'boolean', default: true, description: 'Send cancellation notification to attendees?' },
        message: { type: 'string', description: 'Optional cancellation message' }
      },
      required: ['eventId']
    }
  },

  // ── Tier 4: Contacts — read ──
  {
    name: 'get_contact',
    description: '[Tier 4+] Get full details of a specific Google Contact.',
    input_schema: {
      type: 'object',
      properties: {
        resourceName: { type: 'string', description: 'Contact resource name (e.g. "people/c12345")' }
      },
      required: ['resourceName']
    }
  },
  {
    name: 'search_contacts',
    description: '[Tier 4+] Search Google Contacts by name, email, or phone.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query — name, email address, or phone number' },
        maxResults: { type: 'number', default: 20 }
      },
      required: ['query']
    }
  },
]

// ── Tool handlers ─────────────────────────────────────────────────────────────

// Logging wrapper: every tool call lands in prymal_agent_log for replay/debugging.
async function handleTool(
  toolName: string,
  input: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  clientPlan: string,
  channel: string = 'web'
): Promise<unknown> {
  const started = Date.now()
  let ok = true
  let result: unknown
  try {
    result = await handleToolInner(toolName, input, supabase, clientId, clientPlan)
  } catch (err) {
    ok = false
    result = { error: String(err) }
    throw err
  } finally {
    // fire-and-forget; logging must never break the loop
    supabase.from('prymal_agent_log').insert({
      client_id: clientId, channel, tool_name: toolName,
      input, result: ok ? result : { error: String(result) },
      ok, duration_ms: Date.now() - started,
    }).then(() => {}, () => {})
  }
  return result
}

async function handleToolInner(
  toolName: string,
  input: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  clientPlan: string
): Promise<unknown> {

  // Plan gate helper
  function requirePlan(plan: string, feature: string) {
    if (!planAtLeast(clientPlan, plan)) {
      throw new Error(`${feature} requires the ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan. Your current plan is ${clientPlan}. Upgrade in Settings → Billing.`)
    }
  }

  // External app tools (Composio) route outside the switch
  if (isComposioTool(toolName)) {
    try { return await executeComposioTool(clientId, toolName, input) }
    catch (err) { return { error: 'Connected app call failed: ' + String(err) } }
  }

  switch (toolName) {

    // ── Shared ──

    case 'get_client_info': {
      const { data, error } = await supabase
        .from('prymal_clients')
        .select('business_name, plan, brand_tone, knowledge_base, delivery_cadence, gbp_account_id, gbp_location_id')
        .eq('id', clientId)
        .single()
      if (error) throw new Error(error.message)

      const { data: tokens } = await supabase
        .from('prymal_oauth_tokens')
        .select('platform')
        .eq('client_id', clientId)
      const connected = (tokens ?? []).map((t: { platform: string }) => t.platform)

      return { ...data, connected_services: connected }
    }

    case 'get_pending_approvals': {
      let query = supabase
        .from('prymal_approval_queue')
        .select('*')
        .eq('client_id', clientId)
        .eq('agent', 'google')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20)
      if (input.action_type) query = query.eq('action_type', input.action_type as string)
      const { data, error } = await query
      if (error) throw new Error(error.message)
      return { count: data?.length ?? 0, items: data ?? [] }
    }

    case 'resolve_pending_action': {
      let approvalId = input.approval_id as string | undefined
      if (!approvalId) {
        const { data: latest } = await supabase
          .from('prymal_approval_queue')
          .select('id')
          .eq('client_id', clientId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (!latest) return { error: 'No pending actions to resolve.' }
        approvalId = latest.id
      }
      const decision = String(input.decision ?? '').toLowerCase()
      const reply_text = decision === 'reject' || decision === 'no' || decision === 'skip'
        ? 'REJECT'
        : input.edited_content
          ? `EDIT ${input.edited_content}`
          : 'APPROVE'
      const res = await fetch(`${SUPABASE_URL}/functions/v1/prymal-approval-flow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? '',
        },
        body: JSON.stringify({ client_id: clientId, approval_id: approvalId, reply_text }),
      })
      const data = await res.json()
      if (!res.ok) return { error: data.error ?? 'Approval execution failed.' }
      return data
    }

    case 'invite_friend': {
      const phone = String(input.phone ?? '').replace(/[^\d+]/g, '')
      if (!/^\+?\d{10,15}$/.test(phone)) return { error: "That number doesn't look right — need it like +15551234567." }
      const friend = String(input.name ?? 'your friend')
      const draft = `Hi ${friend} — a friend of yours uses Alfy, an assistant you just text. It handles the stuff you keep meaning to do, and nothing sends without your OK. Save this number and say hi. — A`
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId, agent: 'google', action_type: 'invite_friend',
          summary: `Invite ${friend} to Alfy`, draft_content: draft,
          metadata: { to_phone: phone, name: friend }, status: 'pending',
        })
        .select().single()
      if (error) throw new Error(error.message)
      return { queued: true, approval_id: data.id, note: 'Invite queued — sends after the client approves.' }
    }

    case 'get_agent_activity': {
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .select('*')
        .eq('client_id', clientId)
        .eq('agent', 'google')
        .neq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit((input.limit as number) ?? 10)
      if (error) throw new Error(error.message)
      return { count: data?.length ?? 0, items: data ?? [] }
    }

    case 'queue_action': {
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: input.action_type,
          summary: input.summary,
          draft_content: input.draft_content,
          status: 'pending',
          metadata: input.metadata ?? null,
          batch_id: input.batch_id ?? null,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      return { queued: true, id: data?.id, message: 'Action queued — visible in the Google Agent tab for your approval.' }
    }

    case 'update_client_info': {
      const updates: Record<string, unknown> = {}
      if (input.brand_tone !== undefined) updates.brand_tone = input.brand_tone
      if (input.knowledge_base !== undefined) updates.knowledge_base = input.knowledge_base
      const { error } = await supabase.from('prymal_clients').update(updates).eq('id', clientId)
      if (error) throw new Error(error.message)
      return { updated: true, fields: Object.keys(updates) }
    }

    // ── All plans : Relationship memory (Alfy) ──

    case 'remember_contact': {
      const email = (input.contact_email as string ?? '').trim().toLowerCase()
      if (!email) return { error: 'contact_email is required' }
      const row: Record<string, unknown> = {
        client_id: clientId,
        contact_email: email,
        context_summary: input.context_summary ?? null,
        updated_at: new Date().toISOString(),
      }
      if (input.contact_name !== undefined) row.contact_name = input.contact_name
      if (input.company !== undefined) row.company = input.company
      if (input.tags !== undefined) row.tags = input.tags
      if (input.last_interaction !== undefined) row.last_interaction = input.last_interaction
      if (input.birthday !== undefined) row.birthday = input.birthday
      const { error } = await supabase
        .from('prymal_contact_memory')
        .upsert(row, { onConflict: 'client_id,contact_email' })
      if (error) return { error: error.message }
      return { saved: true, contact_email: email }
    }

    case 'create_standing_instruction': {
      const goal = (input.goal_text as string ?? '').trim()
      if (!goal) return { error: 'goal_text is required' }
      const cadence = ['hourly', 'daily', 'weekly'].includes(input.cadence as string) ? input.cadence : 'daily'
      const { data, error } = await supabase
        .from('prymal_standing_instructions')
        .insert({ client_id: clientId, goal_text: goal, trigger_config: { cadence } })
        .select('id')
        .single()
      if (error) return { error: error.message }
      return { created: true, id: data.id, cadence, message: `Standing instruction saved — Alfy will check on this ${cadence}.` }
    }

    case 'list_standing_instructions': {
      const { data, error } = await supabase
        .from('prymal_standing_instructions')
        .select('id, goal_text, trigger_config, status, last_run_at, last_result, created_at')
        .eq('client_id', clientId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
      if (error) return { error: error.message }
      return { count: data?.length ?? 0, instructions: data ?? [] }
    }

    case 'cancel_standing_instruction': {
      const { error } = await supabase
        .from('prymal_standing_instructions')
        .update({ status: 'cancelled' })
        .eq('id', input.id)
        .eq('client_id', clientId)
      if (error) return { error: error.message }
      return { cancelled: true }
    }

    case 'recall_contacts': {
      let q = supabase
        .from('prymal_contact_memory')
        .select('contact_email, contact_name, company, context_summary, tags, last_interaction, updated_at')
        .eq('client_id', clientId)
      if (input.query) {
        const term = `%${input.query}%`
        q = q.or(`contact_name.ilike.${term},contact_email.ilike.${term},company.ilike.${term},context_summary.ilike.${term}`)
      }
      if (input.tag) q = q.contains('tags', [input.tag])
      if (input.stale_days) {
        const cutoff = new Date(Date.now() - (input.stale_days as number) * 86400000).toISOString()
        q = q.lt('last_interaction', cutoff)
      }
      const { data, error } = await q.order('updated_at', { ascending: false }).limit((input.limit as number) ?? 10)
      if (error) return { error: error.message }
      if (!data?.length) return { count: 0, contacts: [], message: 'No contacts found in memory matching that. Memory builds up as you work — use remember_contact when you learn about people.' }
      return { count: data.length, contacts: data }
    }

    case 'find_followups_needed': {
      requirePlan('tier1', 'Gmail')
      const token = await getFreshToken(supabase, clientId, 'gmail')
      if (!token) return { error: 'Gmail not connected. Go to Settings → Integrations → Gmail to connect.' }

      // Whose address is this inbox?
      const profRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const profile = await profRes.json()
      const myEmail = (profile.emailAddress ?? '').toLowerCase()

      const daysBack = (input.days_back as number) ?? 14
      const minAgeDays = (input.min_age_days as number) ?? 3
      const maxThreads = Math.min((input.maxThreads as number) ?? 15, 25)

      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(`in:sent -in:chats newer_than:${daysBack}d`)}&maxResults=${maxThreads}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const listData = await listRes.json()
      if (listData.error) return { error: listData.error.message ?? JSON.stringify(listData.error) }
      if (!listData.threads?.length) return { count: 0, followups: [], message: 'No sent threads found in that window.' }

      const cutoffMs = Date.now() - minAgeDays * 86400000
      const followups: Record<string, unknown>[] = []

      for (const t of listData.threads.slice(0, maxThreads)) {
        const thRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const th = await thRes.json()
        const msgs = th.messages ?? []
        if (!msgs.length) continue
        const last = msgs[msgs.length - 1]
        const headers: Record<string, string> = {}
        for (const h of last.payload?.headers ?? []) headers[h.name] = h.value
        const lastFrom = (headers['From'] ?? '').toLowerCase()
        const lastDate = Number(last.internalDate ?? 0)
        // Flag only if the LAST message in the thread was sent by the user and it's old enough
        if (myEmail && lastFrom.includes(myEmail) && lastDate > 0 && lastDate < cutoffMs) {
          followups.push({
            threadId: t.id,
            subject: headers['Subject'] ?? '(no subject)',
            to: headers['To'] ?? '',
            sentDate: headers['Date'] ?? '',
            daysWaiting: Math.floor((Date.now() - lastDate) / 86400000),
            snippet: (last.snippet ?? '').slice(0, 150),
          })
        }
      }

      followups.sort((a, b) => (b.daysWaiting as number) - (a.daysWaiting as number))
      return { count: followups.length, followups, message: followups.length ? 'These threads are waiting on a reply. Offer to draft follow-ups (queue via queue_action).' : 'Nothing waiting on a reply — inbox is in good shape.' }
    }

    case 'meeting_prep': {
      requirePlan('tier2', 'Meeting prep')
      const calToken = await getFreshToken(supabase, clientId, 'calendar')
      if (!calToken) return { error: 'Google Calendar not connected. Go to Settings → Integrations → Google Calendar to connect.' }

      let events: Record<string, unknown>[] = []
      if (input.event_id) {
        const evRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${input.event_id}`,
          { headers: { Authorization: `Bearer ${calToken}` } }
        )
        const ev = await evRes.json()
        if (ev.error) return { error: ev.error.message ?? JSON.stringify(ev.error) }
        events = [ev]
      } else {
        const hoursAhead = (input.hours_ahead as number) ?? 48
        const params = new URLSearchParams({
          timeMin: new Date().toISOString(),
          timeMax: new Date(Date.now() + hoursAhead * 3600000).toISOString(),
          maxResults: '10',
          singleEvents: 'true',
          orderBy: 'startTime',
        })
        const evRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
          { headers: { Authorization: `Bearer ${calToken}` } }
        )
        const evData = await evRes.json()
        if (evData.error) return { error: evData.error.message ?? JSON.stringify(evData.error) }
        events = evData.items ?? []
      }
      if (!events.length) return { count: 0, briefs: [], message: 'No upcoming meetings in that window.' }

      const gmailToken = await getFreshToken(supabase, clientId, 'gmail')
      const briefs: Record<string, unknown>[] = []

      for (const ev of events.slice(0, 5)) {
        const attendees = ((ev.attendees as Record<string, unknown>[] | undefined) ?? [])
          .map(a => (a.email as string ?? '').toLowerCase())
          .filter(e => e && !(e.includes('resource.calendar.google.com')))
          .slice(0, 5)

        const attendeeContext: Record<string, unknown>[] = []
        for (const email of attendees) {
          // Relationship memory
          const { data: mem } = await supabase
            .from('prymal_contact_memory')
            .select('contact_name, company, context_summary, tags, last_interaction')
            .eq('client_id', clientId)
            .eq('contact_email', email)
            .maybeSingle()

          // Recent email history
          let recentEmails: Record<string, unknown>[] = []
          if (gmailToken) {
            const gRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(`from:${email} OR to:${email}`)}&maxResults=3`,
              { headers: { Authorization: `Bearer ${gmailToken}` } }
            )
            const gData = await gRes.json()
            recentEmails = await Promise.all(
              (gData.messages ?? []).slice(0, 3).map(async (m: { id: string }) => {
                const mRes = await fetch(
                  `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date`,
                  { headers: { Authorization: `Bearer ${gmailToken}` } }
                )
                const msg = await mRes.json()
                const hs: Record<string, string> = {}
                for (const h of msg.payload?.headers ?? []) hs[h.name] = h.value
                return { subject: hs['Subject'] ?? '', date: hs['Date'] ?? '', snippet: (msg.snippet ?? '').slice(0, 120) }
              })
            )
          }

          attendeeContext.push({ email, memory: mem ?? null, recent_emails: recentEmails })
        }

        briefs.push({
          event_id: ev.id,
          title: ev.summary ?? '(no title)',
          start: (ev.start as Record<string, string>)?.dateTime ?? (ev.start as Record<string, string>)?.date ?? '',
          location: ev.location ?? '',
          description: ((ev.description as string) ?? '').slice(0, 300),
          attendees: attendeeContext,
        })
      }

      return { count: briefs.length, briefs, message: 'Compose a concise prep brief per meeting: who they are, where things stand, and anything owed to them.' }
    }

    // ── Pro+ : GBP ──

    case 'get_reviews': {
      requirePlan('tier4', 'Google Business Profile reviews')
      const token = await getFreshToken(supabase, clientId, 'google')
      if (!token) return { error: 'Google Business Profile not connected. Go to Settings → Integrations → Google Business Profile to connect.' }

      const { data: clientData } = await supabase
        .from('prymal_clients')
        .select('gbp_location_id')
        .eq('id', clientId)
        .single()

      if (!clientData?.gbp_location_id || clientData.gbp_location_id === '0') {
        return { error: 'GBP location ID not configured. Go to Settings → Integrations → Google Business Profile.' }
      }

      const params = new URLSearchParams({
        pageSize: String((input.pageSize as number) ?? 20),
        orderBy: (input.orderBy as string) ?? 'updateTime desc',
      })
      const res = await fetch(
        `https://mybusinessreviews.googleapis.com/v1/${clientData.gbp_location_id}/reviews?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.error) return { error: data.error.message ?? JSON.stringify(data.error) }

      const reviews = (data.reviews ?? []).map((r: Record<string, unknown>) => ({
        reviewId: r.reviewId,
        reviewer: (r.reviewer as Record<string, unknown>)?.displayName ?? 'Anonymous',
        starRating: r.starRating,
        comment: r.comment ?? '(no comment)',
        createTime: r.createTime,
        updateTime: r.updateTime,
        hasReply: !!(r.reviewReply),
        replyText: (r.reviewReply as Record<string, unknown>)?.comment ?? null,
      }))
      return { totalReviewCount: data.totalReviewCount ?? reviews.length, reviews }
    }

    // ── Starter+ : Gmail ──

    case 'get_emails': {
      requirePlan('tier1', 'Gmail')
      const token = await getFreshToken(supabase, clientId, 'gmail')
      if (!token) return { error: 'Gmail not connected. Go to Settings → Integrations → Gmail to connect.' }

      const params = new URLSearchParams({
        q: (input.query as string) ?? '',
        maxResults: String((input.maxResults as number) ?? 10),
      })
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.error) return { error: data.error.message ?? JSON.stringify(data.error) }
      if (!data.messages?.length) return { count: 0, emails: [], message: 'No emails matched that query.' }

      // Fetch snippets for each message
      const emails = await Promise.all(
        (data.messages ?? []).slice(0, 10).map(async (m: { id: string; threadId: string }) => {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          const msg = await msgRes.json()
          const headers: Record<string, string> = {}
          for (const h of msg.payload?.headers ?? []) headers[h.name] = h.value
          return {
            id: m.id,
            threadId: m.threadId,
            subject: headers['Subject'] ?? '(no subject)',
            from: headers['From'] ?? '',
            date: headers['Date'] ?? '',
            snippet: msg.snippet ?? '',
          }
        })
      )
      return { count: data.resultSizeEstimate ?? emails.length, emails }
    }

    case 'get_email_thread': {
      requirePlan('tier1', 'Gmail')
      const token = await getFreshToken(supabase, clientId, 'gmail')
      if (!token) return { error: 'Gmail not connected. Go to Settings → Integrations → Gmail to connect.' }

      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${input.threadId}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.error) return { error: data.error.message ?? JSON.stringify(data.error) }

      const messages = (data.messages ?? []).map((m: Record<string, unknown>) => {
        const headers: Record<string, string> = {}
        for (const h of (m.payload as Record<string, unknown[]>)?.headers ?? []) {
          const hdr = h as Record<string, string>
          headers[hdr.name] = hdr.value
        }
        // Decode body
        let body = ''
        const payload = m.payload as Record<string, unknown>
        const parts = payload?.parts as Record<string, unknown>[] ?? []
        const bodyData = parts.find(p => p.mimeType === 'text/plain') ?? payload
        const encoded = (bodyData?.body as Record<string, string>)?.data ?? ''
        if (encoded) {
          try { body = atob(encoded.replace(/-/g, '+').replace(/_/g, '/')) } catch { body = '' }
        }
        return {
          from: headers['From'] ?? '',
          date: headers['Date'] ?? '',
          subject: headers['Subject'] ?? '',
          body: body.slice(0, 2000),
        }
      })
      return { threadId: input.threadId, messages }
    }

    // ── Starter+ : Calendar ──

    case 'get_calendar_events': {
      console.error(`🔴 CALENDAR REQUEST: clientId=${clientId}`)
      requirePlan('tier2', 'Google Calendar')
      console.error(`🔴 CALENDAR: Fetching token for platform=calendar, clientId=${clientId}`)
      const token = await getFreshToken(supabase, clientId, 'calendar')
      console.error(`🔴 CALENDAR: Token returned - ${token ? 'FOUND' : 'NOT FOUND'} (${token ? token.slice(0, 30) + '...' : 'null'})`)
      if (!token) {
        console.error(`🔴 CALENDAR: No token found, returning error`)
        return { error: 'Google Calendar not connected. Go to Settings → Integrations → Google Calendar to connect.' }
      }
      console.error(`🔴 CALENDAR: Proceeding with token lookup`)

      const timeMin = (input.timeMin as string) ?? new Date().toISOString()
      const timeMax = (input.timeMax as string) ?? new Date(Date.now() + 7 * 86400000).toISOString()
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        maxResults: String((input.maxResults as number) ?? 20),
        singleEvents: 'true',
        orderBy: 'startTime',
      })
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.error) return { error: data.error.message ?? JSON.stringify(data.error) }

      const events = (data.items ?? []).map((e: Record<string, unknown>) => ({
        id: e.id,
        summary: e.summary ?? '(no title)',
        start: (e.start as Record<string, string>)?.dateTime ?? (e.start as Record<string, string>)?.date,
        end: (e.end as Record<string, string>)?.dateTime ?? (e.end as Record<string, string>)?.date,
        location: e.location ?? null,
        description: (e.description as string)?.slice(0, 300) ?? null,
        attendees: ((e.attendees as Record<string, string>[]) ?? []).map(a => a.email),
        status: e.status,
      }))
      return { count: events.length, events }
    }

    case 'get_availability': {
      requirePlan('tier2', 'Google Calendar')
      const token = await getFreshToken(supabase, clientId, 'calendar')
      if (!token) return { error: 'Google Calendar not connected. Go to Settings → Integrations → Google Calendar to connect.' }

      const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeMin: input.timeMin,
          timeMax: input.timeMax,
          items: [{ id: 'primary' }],
        }),
      })
      const data = await res.json()
      if (data.error) return { error: data.error.message ?? JSON.stringify(data.error) }

      const busy = data.calendars?.primary?.busy ?? []
      return {
        timeMin: input.timeMin,
        timeMax: input.timeMax,
        busy_slots: busy,
        busy_count: busy.length,
        message: busy.length === 0 ? 'Completely free during this period.' : `${busy.length} busy slot(s) found.`,
      }
    }

    // ── Starter+ : Drive ──

    case 'search_drive_files': {
      requirePlan('tier3', 'Google Drive')
      const token = await getFreshToken(supabase, clientId, 'drive')
      if (!token) return { error: 'Google Drive not connected. Go to Settings → Integrations → Google Drive to connect.' }

      const params = new URLSearchParams({
        q: (input.query as string) ?? '',
        pageSize: String((input.maxResults as number) ?? 10),
        fields: 'files(id,name,mimeType,modifiedTime,webViewLink)',
      })
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.error) return { error: data.error.message ?? JSON.stringify(data.error) }
      return { count: data.files?.length ?? 0, files: data.files ?? [] }
    }

    case 'read_drive_file': {
      requirePlan('tier3', 'Google Drive')
      const token = await getFreshToken(supabase, clientId, 'drive')
      if (!token) return { error: 'Google Drive not connected. Go to Settings → Integrations → Google Drive to connect.' }

      // Export Google Docs as plain text; download other files directly
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${input.fileId}?fields=name,mimeType`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const meta = await metaRes.json()
      if (meta.error) return { error: meta.error.message }

      let content = ''
      if (meta.mimeType === 'application/vnd.google-apps.document') {
        const exportRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${input.fileId}/export?mimeType=text/plain`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        content = await exportRes.text()
      } else {
        const downloadRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${input.fileId}?alt=media`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        content = await downloadRes.text()
      }

      return { fileId: input.fileId, name: meta.name, mimeType: meta.mimeType, content: content.slice(0, 8000) }
    }

    // ── Tier 1: Email Composition ──

    case 'send_email': {
      requirePlan('tier1', 'Email sending')
      const token = await getFreshToken(supabase, clientId, 'gmail')
      if (!token) return { error: 'Gmail not connected. Go to Settings → Integrations → Gmail to connect.' }

      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'send_email',
          summary: `Email to ${input.to}: ${input.subject}`,
          draft_content: input.body,
          metadata: {
            to: input.to,
            cc: input.cc || '',
            bcc: input.bcc || '',
            subject: input.subject,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Email queued for approval. You'll see it in the Approvals tab.`,
        preview: {
          to: input.to,
          subject: input.subject,
          snippet: (input.body as string).slice(0, 200) + (((input.body as string).length > 200) ? '...' : '')
        }
      }
    }

    case 'list_labels': {
      requirePlan('tier1', 'Gmail')
      const token = await getFreshToken(supabase, clientId, 'gmail')
      if (!token) return { error: 'Gmail not connected. Go to Settings → Integrations → Gmail to connect.' }

      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.error) return { error: data.error.message }

      const labels = (data.labels ?? []).filter((l: Record<string, unknown>) => l.type !== 'system').map((l: Record<string, unknown>) => ({
        id: l.id,
        name: l.name,
        messageCount: l.messagesTotal ?? 0,
        unreadCount: l.messagesUnread ?? 0,
      }))
      return { count: labels.length, labels }
    }

    case 'create_label': {
      requirePlan('tier1', 'Label creation')
      const token = await getFreshToken(supabase, clientId, 'gmail')
      if (!token) return { error: 'Gmail not connected. Go to Settings → Integrations → Gmail to connect.' }

      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'create_label',
          summary: `Create label: ${input.name}`,
          draft_content: `Label name: ${input.name}\nShow in label list: ${input.labelListVisibility === 'labelShow' ? 'Yes' : 'No'}\nShow in messages: ${input.messageListVisibility === 'show' ? 'Yes' : 'No'}`,
          metadata: {
            name: input.name,
            labelListVisibility: input.labelListVisibility || 'labelShow',
            messageListVisibility: input.messageListVisibility || 'show',
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Label creation queued. Approve in the Approvals tab.`
      }
    }

    case 'apply_label': {
      requirePlan('tier1', 'Email organization')
      const token = await getFreshToken(supabase, clientId, 'gmail')
      if (!token) return { error: 'Gmail not connected. Go to Settings → Integrations → Gmail to connect.' }

      const threadCount = (input.threadIds as string[]).length
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'apply_label',
          summary: `Apply label "${input.labelName}" to ${threadCount} email(s)`,
          draft_content: `Label: ${input.labelName}\nThreads: ${threadCount}`,
          metadata: {
            threadIds: input.threadIds,
            labelName: input.labelName,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Labeling operation queued. Approve in the Approvals tab.`
      }
    }

    case 'remove_label': {
      requirePlan('tier1', 'Email organization')
      const token = await getFreshToken(supabase, clientId, 'gmail')
      if (!token) return { error: 'Gmail not connected. Go to Settings → Integrations → Gmail to connect.' }

      const threadCount = (input.threadIds as string[]).length
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'remove_label',
          summary: `Remove label "${input.labelName}" from ${threadCount} email(s)`,
          draft_content: `Label: ${input.labelName}\nThreads: ${threadCount}`,
          metadata: {
            threadIds: input.threadIds,
            labelName: input.labelName,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Label removal queued. Approve in the Approvals tab.`
      }
    }

    case 'archive_email': {
      requirePlan('tier1', 'Email management')
      const token = await getFreshToken(supabase, clientId, 'gmail')
      if (!token) return { error: 'Gmail not connected. Go to Settings → Integrations → Gmail to connect.' }

      const threadCount = (input.threadIds as string[]).length
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'archive_email',
          summary: `Archive ${threadCount} email(s)`,
          draft_content: `Archiving ${threadCount} emails from inbox.`,
          metadata: { threadIds: input.threadIds },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Archive operation queued. Approve in the Approvals tab.`
      }
    }

    case 'delete_email': {
      requirePlan('tier1', 'Email management')
      const token = await getFreshToken(supabase, clientId, 'gmail')
      if (!token) return { error: 'Gmail not connected. Go to Settings → Integrations → Gmail to connect.' }

      const threadCount = (input.threadIds as string[]).length
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'delete_email',
          summary: `Delete ${threadCount} email(s)`,
          draft_content: `Permanently deleting ${threadCount} emails.`,
          metadata: { threadIds: input.threadIds },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Email deletion queued. Approve in the Approvals tab. ⚠️ This action is permanent.`
      }
    }

    case 'mark_as_read': {
      requirePlan('tier1', 'Email management')
      const token = await getFreshToken(supabase, clientId, 'gmail')
      if (!token) return { error: 'Gmail not connected. Go to Settings → Integrations → Gmail to connect.' }

      const threadCount = (input.threadIds as string[]).length
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'mark_as_read',
          summary: `Mark ${threadCount} email(s) as read`,
          draft_content: `Marking ${threadCount} emails as read.`,
          metadata: { threadIds: input.threadIds },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Mark as read queued. Approve in the Approvals tab.`
      }
    }

    case 'mark_as_unread': {
      requirePlan('tier1', 'Email management')
      const token = await getFreshToken(supabase, clientId, 'gmail')
      if (!token) return { error: 'Gmail not connected. Go to Settings → Integrations → Gmail to connect.' }

      const threadCount = (input.threadIds as string[]).length
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'mark_as_unread',
          summary: `Mark ${threadCount} email(s) as unread`,
          draft_content: `Marking ${threadCount} emails as unread.`,
          metadata: { threadIds: input.threadIds },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Mark as unread queued. Approve in the Approvals tab.`
      }
    }

    case 'create_filter': {
      requirePlan('tier1', 'Email filters')
      const token = await getFreshToken(supabase, clientId, 'gmail')
      if (!token) return { error: 'Gmail not connected. Go to Settings → Integrations → Gmail to connect.' }

      const criteria = []
      if (input.from) criteria.push(`From: ${input.from}`)
      if (input.to) criteria.push(`To: ${input.to}`)
      if (input.subject) criteria.push(`Subject: ${input.subject}`)
      if (input.query) criteria.push(`Query: ${input.query}`)

      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'create_filter',
          summary: `Create filter: ${input.action}`,
          draft_content: `Criteria:\n${criteria.join('\n')}\n\nAction: ${input.action}${input.label ? `\nLabel: ${input.label}` : ''}`,
          metadata: {
            from: input.from,
            to: input.to,
            subject: input.subject,
            query: input.query,
            action: input.action,
            label: input.label,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Email filter queued. Approve in the Approvals tab.`
      }
    }

    case 'set_auto_reply': {
      requirePlan('tier1', 'Auto-reply')
      const token = await getFreshToken(supabase, clientId, 'gmail')
      if (!token) return { error: 'Gmail not connected. Go to Settings → Integrations → Gmail to connect.' }

      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'set_auto_reply',
          summary: `Set auto-reply`,
          draft_content: `Subject: ${input.subject}\n\n${input.message}${input.startTime ? `\n\nActive: ${input.startTime} to ${input.endTime}` : ''}`,
          metadata: {
            message: input.message,
            subject: input.subject,
            startTime: input.startTime,
            endTime: input.endTime,
            restrictToContacts: input.restrictToContacts,
            restrictToDomain: input.restrictToDomain,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Auto-reply queued. Approve in the Approvals tab.`
      }
    }

    case 'schedule_send': {
      requirePlan('tier1', 'Schedule send')
      const token = await getFreshToken(supabase, clientId, 'gmail')
      if (!token) return { error: 'Gmail not connected. Go to Settings → Integrations → Gmail to connect.' }

      const sendDate = new Date(input.sendAt as string).toLocaleString()
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'schedule_send',
          summary: `Schedule email to ${input.to} for ${sendDate}`,
          draft_content: `To: ${input.to}\nSubject: ${input.subject}\nSend at: ${sendDate}\n\n${(input.body as string).slice(0, 300)}...`,
          metadata: {
            to: input.to,
            cc: input.cc,
            bcc: input.bcc,
            subject: input.subject,
            sendAt: input.sendAt,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Email scheduled. Approve in the Approvals tab.`
      }
    }

    // ── Tier 2: Calendar Events ──

    case 'create_event': {
      requirePlan('tier2', 'Calendar event creation')
      const token = await getFreshToken(supabase, clientId, 'calendar')
      if (!token) return { error: 'Google Calendar not connected. Go to Settings → Integrations → Google Calendar to connect.' }

      const startDate = new Date(input.startTime as string).toLocaleString()
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'create_event',
          summary: `Calendar: ${input.title}`,
          draft_content: `Title: ${input.title}\nWhen: ${startDate}\nLocation: ${input.location || 'Not specified'}\nAttendees: ${((input.attendees as string[]) ?? []).join(', ') || 'None'}${input.description ? `\n\nDescription: ${input.description}` : ''}`,
          metadata: {
            title: input.title,
            startTime: input.startTime,
            endTime: input.endTime,
            location: input.location,
            attendees: input.attendees,
            description: input.description,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Calendar event queued. Approve in the Approvals tab.`
      }
    }

    case 'update_event': {
      requirePlan('tier2', 'Calendar event management')
      const token = await getFreshToken(supabase, clientId, 'calendar')
      if (!token) return { error: 'Google Calendar not connected. Go to Settings → Integrations → Google Calendar to connect.' }

      const changes = []
      if (input.title) changes.push(`Title: ${input.title}`)
      if (input.startTime) changes.push(`Start: ${new Date(input.startTime as string).toLocaleString()}`)
      if (input.location) changes.push(`Location: ${input.location}`)
      if (input.description) changes.push(`Description: ${(input.description as string).slice(0, 100)}...`)

      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'update_event',
          summary: `Update event: ${input.eventId}`,
          draft_content: `Changes:\n${changes.join('\n')}`,
          metadata: {
            eventId: input.eventId,
            title: input.title,
            startTime: input.startTime,
            endTime: input.endTime,
            location: input.location,
            attendees: input.attendees,
            description: input.description,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Event update queued. Approve in the Approvals tab.`
      }
    }

    case 'delete_event': {
      requirePlan('tier2', 'Calendar event management')
      const token = await getFreshToken(supabase, clientId, 'calendar')
      if (!token) return { error: 'Google Calendar not connected. Go to Settings → Integrations → Google Calendar to connect.' }

      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'delete_event',
          summary: `Delete event: ${input.eventId}`,
          draft_content: `Deleting calendar event ${input.eventId}.`,
          metadata: { eventId: input.eventId },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Event deletion queued. Approve in the Approvals tab.`
      }
    }

    // ── Tier 2: Google Tasks ──

    case 'create_task': {
      requirePlan('tier2', 'Task creation')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'create_task',
          summary: `Task: ${input.title}`,
          draft_content: `Title: ${input.title}${input.dueDate ? `\nDue: ${input.dueDate}` : ''}${input.description ? `\nDescription: ${input.description}` : ''}`,
          metadata: {
            title: input.title,
            description: input.description,
            dueDate: input.dueDate,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Task creation queued. Approve in the Approvals tab.`
      }
    }

    case 'list_tasks': {
      requirePlan('tier2', 'Google Tasks')
      // This would normally require Google Tasks API - for now return a placeholder
      return {
        message: 'Google Tasks list functionality coming soon.',
        tasks: []
      }
    }

    case 'update_task': {
      requirePlan('tier2', 'Task management')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'update_task',
          summary: `Update task: ${input.taskId}`,
          draft_content: `Updating task${input.title ? ` to "${input.title}"` : ''}${input.status === 'completed' ? ' and marking as complete' : ''}`,
          metadata: {
            taskId: input.taskId,
            title: input.title,
            description: input.description,
            dueDate: input.dueDate,
            status: input.status,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Task update queued. Approve in the Approvals tab.`
      }
    }

    case 'complete_task': {
      requirePlan('tier2', 'Task management')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'complete_task',
          summary: `Complete task: ${input.taskId}`,
          draft_content: `Marking task as complete.`,
          metadata: { taskId: input.taskId },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Task marked as complete. Approve in the Approvals tab.`
      }
    }

    // ── Tier 3: Google Drive ──

    case 'create_folder': {
      requirePlan('tier3', 'Drive management')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'create_folder',
          summary: `Create folder: ${input.name}`,
          draft_content: `Creating Google Drive folder: ${input.name}`,
          metadata: {
            name: input.name,
            parentFolderId: input.parentFolderId,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Folder creation queued. Approve in the Approvals tab.`
      }
    }

    case 'move_file': {
      requirePlan('tier3', 'Drive management')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'move_file',
          summary: `Move file to folder`,
          draft_content: `Moving file ${input.fileId} to folder ${input.targetFolderId}`,
          metadata: {
            fileId: input.fileId,
            targetFolderId: input.targetFolderId,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `File move queued. Approve in the Approvals tab.`
      }
    }

    case 'delete_file': {
      requirePlan('tier3', 'Drive management')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'delete_file',
          summary: `Delete file`,
          draft_content: `${input.permanently ? 'Permanently deleting' : 'Trashing'} file ${input.fileId}`,
          metadata: {
            fileId: input.fileId,
            permanently: input.permanently,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `File deletion queued. Approve in the Approvals tab.`
      }
    }

    case 'rename_file': {
      requirePlan('tier3', 'Drive management')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'rename_file',
          summary: `Rename file to: ${input.newName}`,
          draft_content: `Renaming file ${input.fileId} to "${input.newName}"`,
          metadata: {
            fileId: input.fileId,
            newName: input.newName,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `File rename queued. Approve in the Approvals tab.`
      }
    }

    case 'share_file': {
      requirePlan('tier3', 'Drive sharing')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'share_file',
          summary: `Share file with ${(input.emailAddresses as string[]).length} recipient(s)`,
          draft_content: `Sharing file ${input.fileId} as ${input.role}:\n${(input.emailAddresses as string[]).join('\n')}`,
          metadata: {
            fileId: input.fileId,
            emailAddresses: input.emailAddresses,
            role: input.role,
            sendNotification: input.sendNotification,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `File sharing queued. Approve in the Approvals tab.`
      }
    }

    case 'set_permissions': {
      requirePlan('tier3', 'Drive permissions')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'set_permissions',
          summary: `Set ${input.type} permission: ${input.role}`,
          draft_content: `Setting ${input.type} permission (${input.role}) on file ${input.fileId}${input.value ? ` for ${input.value}` : ''}`,
          metadata: {
            fileId: input.fileId,
            type: input.type,
            role: input.role,
            value: input.value,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Permission change queued. Approve in the Approvals tab.`
      }
    }

    // ── Tier 3: Google Docs ──

    case 'create_document': {
      requirePlan('tier3', 'Google Docs')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'create_document',
          summary: `Create Google Doc: ${input.title}`,
          draft_content: `Creating Google Doc titled "${input.title}"${input.content ? `\n\nInitial content:\n${(input.content as string).slice(0, 300)}...` : ''}`,
          metadata: {
            title: input.title,
            content: input.content,
            parentFolderId: input.parentFolderId,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Document creation queued. Approve in the Approvals tab.`
      }
    }

    case 'update_document': {
      requirePlan('tier3', 'Google Docs')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'update_document',
          summary: `Update Google Doc`,
          draft_content: `${input.mode === 'replace' ? 'Replacing' : 'Appending to'} document content:\n${(input.content as string).slice(0, 300)}...`,
          metadata: {
            documentId: input.documentId,
            content: input.content,
            mode: input.mode,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Document update queued. Approve in the Approvals tab.`
      }
    }

    // ── Tier 3: Google Sheets ──

    case 'create_sheet': {
      requirePlan('tier3', 'Google Sheets')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'create_sheet',
          summary: `Create Google Sheet: ${input.title}`,
          draft_content: `Creating Google Sheet titled "${input.title}"`,
          metadata: {
            title: input.title,
            parentFolderId: input.parentFolderId,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Sheet creation queued. Approve in the Approvals tab.`
      }
    }

    case 'update_sheet': {
      requirePlan('tier3', 'Google Sheets')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'update_sheet',
          summary: `Update Google Sheet data`,
          draft_content: `${input.mode === 'append' ? 'Appending' : 'Updating'} ${(input.values as unknown[][]).length} row(s) to "${input.sheetName}"`,
          metadata: {
            spreadsheetId: input.spreadsheetId,
            sheetName: input.sheetName,
            range: input.range,
            values: input.values,
            mode: input.mode,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Sheet update queued. Approve in the Approvals tab.`
      }
    }

    // ── Tier 3: Google Slides ──

    case 'create_slide': {
      requirePlan('tier3', 'Google Slides')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'create_slide',
          summary: `Create Google Slides: ${input.title}`,
          draft_content: `Creating Google Slides presentation titled "${input.title}"`,
          metadata: {
            title: input.title,
            parentFolderId: input.parentFolderId,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Presentation creation queued. Approve in the Approvals tab.`
      }
    }

    case 'update_slide': {
      requirePlan('tier3', 'Google Slides')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'update_slide',
          summary: `Update slide`,
          draft_content: `${input.slideIndex === -1 ? 'Adding new slide' : `Updating slide ${input.slideIndex}`}${input.title ? ` with title "${input.title}"` : ''}`,
          metadata: {
            presentationId: input.presentationId,
            slideIndex: input.slideIndex,
            title: input.title,
            content: input.content,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Slide update queued. Approve in the Approvals tab.`
      }
    }

    // ── Tier 4: Google Meet ──

    case 'schedule_meet': {
      requirePlan('tier4', 'Google Meet')
      const startDate = new Date(input.startTime as string).toLocaleString()
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'schedule_meet',
          summary: `Schedule Meet: ${input.title}`,
          draft_content: `Meeting: ${input.title}\nWhen: ${startDate}\nAttendees: ${((input.attendees as string[]) ?? []).join(', ') || 'TBD'}${input.description ? `\n\nDescription: ${input.description}` : ''}`,
          metadata: {
            title: input.title,
            startTime: input.startTime,
            endTime: input.endTime,
            attendees: input.attendees,
            description: input.description,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Meet scheduling queued. Approve in the Approvals tab.`
      }
    }

    // ── Tier 4: Google Contacts ──

    case 'create_contact': {
      requirePlan('tier4', 'Google Contacts')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'create_contact',
          summary: `Create contact: ${input.givenName} ${input.familyName}`,
          draft_content: `Creating contact:\nName: ${input.givenName} ${input.familyName}\nEmail: ${input.email || 'Not provided'}\nPhone: ${input.phone || 'Not provided'}\nCompany: ${input.company || 'Not provided'}\nTitle: ${input.jobTitle || 'Not provided'}${input.notes ? `\nNotes: ${input.notes}` : ''}`,
          metadata: {
            givenName: input.givenName,
            familyName: input.familyName,
            email: input.email,
            phone: input.phone,
            company: input.company,
            jobTitle: input.jobTitle,
            notes: input.notes,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Contact creation queued. Approve in the Approvals tab.`
      }
    }

    case 'update_contact': {
      requirePlan('tier4', 'Google Contacts')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'update_contact',
          summary: `Update contact`,
          draft_content: `Updating contact with new information`,
          metadata: {
            resourceName: input.resourceName,
            givenName: input.givenName,
            familyName: input.familyName,
            email: input.email,
            phone: input.phone,
            company: input.company,
            jobTitle: input.jobTitle,
            notes: input.notes,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Contact update queued. Approve in the Approvals tab.`
      }
    }

    case 'delete_contact': {
      requirePlan('tier4', 'Google Contacts')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'delete_contact',
          summary: `Delete contact`,
          draft_content: `Deleting contact from Google Contacts`,
          metadata: { resourceName: input.resourceName },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Contact deletion queued. Approve in the Approvals tab.`
      }
    }

    case 'list_contacts': {
      requirePlan('tier4', 'Google Contacts')
      // This would normally require Google Contacts API - for now return a placeholder
      return {
        message: 'Google Contacts list functionality coming soon.',
        contacts: []
      }
    }

    // ── Tier 4: Google Business Profile ──

    case 'respond_to_review': {
      requirePlan('tier4', 'Business Profile')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'respond_to_review',
          summary: `Respond to review`,
          draft_content: input.responseText,
          metadata: {
            reviewId: input.reviewId,
            responseText: input.responseText,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Review response queued. Approve in the Approvals tab.`
      }
    }

    case 'create_post': {
      requirePlan('tier4', 'Business Profile')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'create_post',
          summary: `GBP post: ${input.title}`,
          draft_content: `${input.title}\n\n${input.content}${input.callToAction ? `\n\nCTA: ${input.callToAction}` : ''}`,
          metadata: {
            title: input.title,
            content: input.content,
            type: input.type,
            callToAction: input.callToAction,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `GBP post creation queued. Approve in the Approvals tab.`
      }
    }

    // ── Tier 4: Google Photos ──

    case 'upload_photo': {
      requirePlan('tier4', 'Google Photos')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'upload_photo',
          summary: `Upload photo to Google Photos`,
          draft_content: `Uploading photo${input.description ? `: ${input.description}` : ''}`,
          metadata: {
            photoUrl: input.photoUrl,
            description: input.description,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Photo upload queued. Approve in the Approvals tab.`
      }
    }

    case 'create_album': {
      requirePlan('tier4', 'Google Photos')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'create_album',
          summary: `Create album: ${input.title}`,
          draft_content: `Creating album "${input.title}"${input.description ? `\nDescription: ${input.description}` : ''}`,
          metadata: {
            title: input.title,
            description: input.description,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Album creation queued. Approve in the Approvals tab.`
      }
    }

    case 'organize_photos': {
      requirePlan('tier4', 'Google Photos')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'organize_photos',
          summary: `Add ${(input.photoIds as string[]).length} photo(s) to album`,
          draft_content: `Adding ${(input.photoIds as string[]).length} photos to album ${input.albumId}`,
          metadata: {
            albumId: input.albumId,
            photoIds: input.photoIds,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Photo organization queued. Approve in the Approvals tab.`
      }
    }

    case 'find_duplicate_photos': {
      requirePlan('tier4', 'Google Photos')
      const similarity = (input.similarity as string) ?? 'high'
      const maxResults = (input.maxResults as number) ?? 50

      return {
        message: `Scanning up to ${maxResults} photos for ${similarity} similarity duplicates...`,
        analysis: `This scan will:
1. Analyze photo metadata (size, creation date, EXIF data)
2. Compare image content for ${similarity === 'exact' ? 'pixel-perfect matches' : similarity === 'high' ? '98%+ similarity' : '90%+ similarity'}
3. Group similar photos together
4. Show you which photos are duplicates`,
        action: `Once analysis is complete, you can use delete_duplicate_photos to remove duplicates while keeping the best quality versions.`,
        estimatedTime: `${Math.ceil(maxResults / 10)} seconds to analyze ${maxResults} photos`
      }
    }

    case 'delete_duplicate_photos': {
      requirePlan('tier4', 'Google Photos')
      const groupCount = (input.duplicateGroupIds as string[]).length
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'delete_duplicate_photos',
          summary: `Remove ${groupCount} duplicate photo group(s)`,
          draft_content: `Cleaning up ${groupCount} groups of duplicate photos.
- Keep best quality: ${input.keepHighestResolution ? 'Yes' : 'No'}
- Keep latest: ${input.keepLatest ? 'Yes' : 'No'}
- Action: ${input.moveToTrash ? 'Move to trash (recoverable)' : 'Permanently delete'}

⚠️ This will remove duplicate photos. Trash can be emptied later if needed.`,
          metadata: {
            duplicateGroupIds: input.duplicateGroupIds,
            keepHighestResolution: input.keepHighestResolution,
            keepLatest: input.keepLatest,
            moveToTrash: input.moveToTrash,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Duplicate removal queued. Approve in the Approvals tab.`,
        preview: `Removing ${groupCount} duplicate group(s) - keeping the ${input.keepHighestResolution ? 'highest resolution' : 'latest'} version from each group.`
      }
    }

    case 'auto_organize_photos': {
      requirePlan('tier4', 'Google Photos')
      const method = (input.organizationMethod as string) ?? 'by_date'
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'auto_organize_photos',
          summary: `Auto-organize photos ${method}`,
          draft_content: `Organization method: ${method}
Creating albums: ${input.createAlbums ? 'Yes' : 'No'}
Photos to process: ${input.maxPhotosToProcess}
Merge with existing: ${input.mergeExisting ? 'Yes' : 'No'}

Organization breakdown:
${method === 'by_date' ? '- Folders by Year → Month' : ''}
${method === 'by_location' ? '- Groups by detected location (city, landmark)' : ''}
${method === 'by_content' ? '- Groups by detected people, objects, and scene types' : ''}
${method === 'smart' ? '- AI-powered intelligent grouping based on content, time, and context' : ''}`,
          metadata: {
            organizationMethod: method,
            createAlbums: input.createAlbums,
            maxPhotosToProcess: input.maxPhotosToProcess,
            mergeExisting: input.mergeExisting,
          },
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      return {
        queued: true,
        id: data.id,
        message: `Auto-organization queued. Approve in the Approvals tab.`,
        preview: `Will organize photos ${method} and ${input.createAlbums ? 'create albums' : 'tag photos without creating albums'}.`
      }
    }

    // ── Tier 3: Drive — list & inspect ──

    case 'list_drive_files': {
      requirePlan('tier3', 'Google Drive')
      const token = await getFreshToken(supabase, clientId, 'drive')
      if (!token) return { error: 'Google Drive not connected. Go to Settings → Integrations → Google Drive to connect.' }

      const conditions: string[] = []
      if (input.folderId) {
        conditions.push(`'${input.folderId}' in parents`)
      } else {
        conditions.push("'root' in parents")
      }
      if (input.query) conditions.push(input.query as string)
      conditions.push('trashed=false')

      const params = new URLSearchParams({
        q: conditions.join(' and '),
        pageSize: String((input.maxResults as number) ?? 50),
        fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,parents,owners)',
        orderBy: 'folder,name',
      })

      const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.error) return { error: data.error.message ?? JSON.stringify(data.error) }

      const files = (data.files ?? []).map((f: Record<string, unknown>) => ({
        id: f.id,
        name: f.name,
        type: f.mimeType === 'application/vnd.google-apps.folder' ? 'folder'
          : (f.mimeType as string)?.includes('document') ? 'Google Doc'
          : (f.mimeType as string)?.includes('spreadsheet') ? 'Google Sheet'
          : (f.mimeType as string)?.includes('presentation') ? 'Google Slides'
          : (f.mimeType as string)?.includes('image') ? 'image'
          : (f.mimeType as string)?.includes('video') ? 'video'
          : (f.mimeType as string)?.includes('pdf') ? 'PDF'
          : 'file',
        mimeType: f.mimeType,
        size: f.size ? `${Math.round(Number(f.size) / 1024)} KB` : null,
        modified: f.modifiedTime,
        link: f.webViewLink,
      }))

      const folders = files.filter((f: Record<string, unknown>) => f.type === 'folder')
      const documents = files.filter((f: Record<string, unknown>) => f.type !== 'folder')

      return {
        total: files.length,
        folders: folders.length,
        files: documents.length,
        items: files,
      }
    }

    case 'get_file_info': {
      requirePlan('tier3', 'Google Drive')
      const token = await getFreshToken(supabase, clientId, 'drive')
      if (!token) return { error: 'Google Drive not connected. Go to Settings → Integrations → Google Drive to connect.' }

      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${input.fileId}?fields=id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,thumbnailLink,hasThumbnail,owners,sharingUser,shared,permissions,parents,description`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.error) return { error: data.error.message ?? JSON.stringify(data.error) }

      const thumbUrl = data.thumbnailLink
        ? data.thumbnailLink.replace(/=s\d+$/, '=s1600')
        : null

      return {
        id: data.id,
        name: data.name,
        mimeType: data.mimeType,
        size: data.size ? `${Math.round(Number(data.size) / 1024)} KB` : 'N/A',
        created: data.createdTime,
        modified: data.modifiedTime,
        link: data.webViewLink,
        downloadLink: data.webContentLink,
        thumbnailUrl: thumbUrl,
        shared: data.shared,
        owners: (data.owners ?? []).map((o: Record<string, string>) => o.emailAddress),
        description: data.description ?? null,
      }
    }

    case 'analyze_file': {
      requirePlan('tier3', 'Google Drive')
      const token = await getFreshToken(supabase, clientId, 'drive')
      if (!token) return { error: 'Google Drive not connected. Go to Settings → Integrations → Google Drive to connect.' }

      const maxChars = (input.maxChars as number) ?? 5000

      // Get file metadata first (include thumbnailLink for images)
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${input.fileId}?fields=id,name,mimeType,size,webViewLink,thumbnailLink,hasThumbnail`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const meta = await metaRes.json()
      if (meta.error) return { error: meta.error.message }

      const mime: string = meta.mimeType ?? ''
      let content = ''
      let contentType = 'unknown'

      if (mime === 'application/vnd.google-apps.document') {
        contentType = 'Google Doc'
        const exportRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${input.fileId}/export?mimeType=text/plain`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        content = (await exportRes.text()).slice(0, maxChars)
      } else if (mime === 'application/vnd.google-apps.spreadsheet') {
        contentType = 'Google Sheet'
        const exportRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${input.fileId}/export?mimeType=text/csv`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        content = (await exportRes.text()).slice(0, maxChars)
      } else if (mime === 'application/vnd.google-apps.presentation') {
        contentType = 'Google Slides'
        const exportRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${input.fileId}/export?mimeType=text/plain`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        content = (await exportRes.text()).slice(0, maxChars)
      } else if (mime === 'application/pdf' || mime.startsWith('text/')) {
        contentType = mime === 'application/pdf' ? 'PDF' : 'text file'
        const dlRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${input.fileId}?alt=media`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        content = (await dlRes.text()).slice(0, maxChars)
      } else if (mime.startsWith('image/')) {
        contentType = 'image'
        // Use a larger thumbnail size for display (sz=w1600 gives up to 1600px wide)
        const thumbUrl = meta.thumbnailLink
          ? meta.thumbnailLink.replace(/=s\d+$/, '=s1600')
          : null
        content = thumbUrl
          ? `![${meta.name}](${thumbUrl})\n\n**${meta.name}**\nSize: ${meta.size ? Math.round(Number(meta.size) / 1024) + ' KB' : 'unknown'} · [Open in Drive](${meta.webViewLink})`
          : `**${meta.name}**\nSize: ${meta.size ? Math.round(Number(meta.size) / 1024) + ' KB' : 'unknown'}\n[Open in Drive](${meta.webViewLink})\n\n_No preview available — open the link to view this image._`
      } else if (mime.startsWith('video/')) {
        contentType = 'video'
        content = `Video file: ${meta.name}\nType: ${mime}\nSize: ${meta.size ? Math.round(Number(meta.size) / 1024 / 1024) + ' MB' : 'unknown'}\nView: ${meta.webViewLink}`
      } else if (mime === 'application/vnd.google-apps.folder') {
        contentType = 'folder'
        // List folder contents
        const listRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?q='${input.fileId}' in parents and trashed=false&fields=files(id,name,mimeType,size)&pageSize=50`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const listData = await listRes.json()
        const items = listData.files ?? []
        content = `Folder: ${meta.name}\nContains ${items.length} item(s):\n` +
          items.map((f: Record<string, unknown>) => `- ${f.name} (${f.mimeType})`).join('\n')
      } else {
        contentType = 'binary file'
        content = `File: ${meta.name}\nType: ${mime}\nSize: ${meta.size ? Math.round(Number(meta.size) / 1024) + ' KB' : 'unknown'}\nLink: ${meta.webViewLink}\n\nNote: This file type cannot be read as text.`
      }

      return {
        fileId: input.fileId,
        name: meta.name,
        contentType,
        mimeType: mime,
        link: meta.webViewLink,
        content,
        truncated: content.length >= maxChars,
      }
    }

    // ── Tier 3: Docs — read & delete ──

    case 'read_document': {
      requirePlan('tier3', 'Google Docs')
      const token = await getFreshToken(supabase, clientId, 'drive')
      if (!token) return { error: 'Google Drive not connected. Go to Settings → Integrations → Google Drive to connect.' }

      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${input.documentId}/export?mimeType=text/plain`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) return { error: `Failed to read document (${res.status})` }
      const text = await res.text()

      // Also get the doc title
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${input.documentId}?fields=name,modifiedTime,webViewLink`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const meta = await metaRes.json()

      return {
        documentId: input.documentId,
        title: meta.name,
        modified: meta.modifiedTime,
        link: meta.webViewLink,
        content: text.slice(0, 8000),
        truncated: text.length > 8000,
        length: text.length,
      }
    }

    case 'delete_document': {
      requirePlan('tier3', 'Google Docs')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'delete_document',
          summary: `Delete Google Doc`,
          draft_content: `${input.permanently ? 'Permanently deleting' : 'Moving to trash'}: Google Doc ${input.documentId}`,
          metadata: { documentId: input.documentId, permanently: input.permanently ?? false },
          status: 'pending',
        })
        .select('id').single()
      if (error) throw new Error(error.message)
      return { queued: true, id: data.id, message: 'Document deletion queued. Approve in the Approvals tab.' }
    }

    // ── Tier 3: Sheets — read & delete ──

    case 'read_sheet': {
      requirePlan('tier3', 'Google Sheets')
      const token = await getFreshToken(supabase, clientId, 'sheets')
      if (!token) return { error: 'Google Sheets not connected. Go to Settings → Integrations → Google Sheets to connect.' }

      const range = input.range
        ? `${input.sheetName ?? 'Sheet1'}!${input.range}`
        : (input.sheetName as string) ?? 'Sheet1'

      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}/values/${encodeURIComponent(range)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.error) return { error: data.error.message ?? JSON.stringify(data.error) }

      const values: unknown[][] = data.values ?? []
      const headers = values[0] ?? []
      const rows = values.slice(1)

      return {
        spreadsheetId: input.spreadsheetId,
        range: data.range,
        rowCount: rows.length,
        columnCount: headers.length,
        headers,
        rows: rows.slice(0, 100),
        truncated: rows.length > 100,
      }
    }

    case 'delete_sheet': {
      requirePlan('tier3', 'Google Sheets')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'delete_sheet',
          summary: `Delete Google Sheet`,
          draft_content: `${input.permanently ? 'Permanently deleting' : 'Moving to trash'}: Spreadsheet ${input.spreadsheetId}`,
          metadata: { spreadsheetId: input.spreadsheetId, permanently: input.permanently ?? false },
          status: 'pending',
        })
        .select('id').single()
      if (error) throw new Error(error.message)
      return { queued: true, id: data.id, message: 'Spreadsheet deletion queued. Approve in the Approvals tab.' }
    }

    // ── Tier 3: Slides — read & delete ──

    case 'read_presentation': {
      requirePlan('tier3', 'Google Slides')
      const token = await getFreshToken(supabase, clientId, 'drive')
      if (!token) return { error: 'Google Drive not connected. Go to Settings → Integrations → Google Drive to connect.' }

      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${input.presentationId}/export?mimeType=text/plain`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const text = await res.text()

      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${input.presentationId}?fields=name,modifiedTime,webViewLink`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const meta = await metaRes.json()

      return {
        presentationId: input.presentationId,
        title: meta.name,
        modified: meta.modifiedTime,
        link: meta.webViewLink,
        content: text.slice(0, 8000),
        truncated: text.length > 8000,
      }
    }

    case 'delete_presentation': {
      requirePlan('tier3', 'Google Slides')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'delete_presentation',
          summary: `Delete Google Slides presentation`,
          draft_content: `${input.permanently ? 'Permanently deleting' : 'Moving to trash'}: Presentation ${input.presentationId}`,
          metadata: { presentationId: input.presentationId, permanently: input.permanently ?? false },
          status: 'pending',
        })
        .select('id').single()
      if (error) throw new Error(error.message)
      return { queued: true, id: data.id, message: 'Presentation deletion queued. Approve in the Approvals tab.' }
    }

    // ── Tier 3: Google Forms ──

    case 'create_form': {
      requirePlan('tier3', 'Google Forms')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'create_form',
          summary: `Create Google Form: ${input.title}`,
          draft_content: `Creating form: "${input.title}"\n${input.description ? `Description: ${input.description}\n` : ''}Questions: ${(input.questions as unknown[])?.length ?? 0}`,
          metadata: { title: input.title, description: input.description, questions: input.questions },
          status: 'pending',
        })
        .select('id').single()
      if (error) throw new Error(error.message)
      return { queued: true, id: data.id, message: 'Form creation queued. Approve in the Approvals tab.' }
    }

    case 'read_form': {
      requirePlan('tier3', 'Google Forms')
      const token = await getFreshToken(supabase, clientId, 'forms')
      if (!token) return { error: 'Google Forms not connected. Go to Settings → Integrations → Google Forms to connect.' }

      const res = await fetch(
        `https://forms.googleapis.com/v1/forms/${input.formId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.error) return { error: data.error.message ?? JSON.stringify(data.error) }

      const questions = (data.items ?? []).map((item: Record<string, unknown>) => {
        const q = item.questionItem as Record<string, unknown>
        return {
          id: item.itemId,
          title: item.title,
          type: (q?.question as Record<string, unknown>)?.textQuestion ? 'text'
            : (q?.question as Record<string, unknown>)?.choiceQuestion ? 'choice'
            : 'other',
          required: (q?.question as Record<string, unknown>)?.required ?? false,
        }
      })

      return {
        formId: input.formId,
        title: data.info?.title,
        description: data.info?.description,
        responderUri: data.responderUri,
        questionCount: questions.length,
        questions,
      }
    }

    case 'list_form_responses': {
      requirePlan('tier3', 'Google Forms')
      const token = await getFreshToken(supabase, clientId, 'forms')
      if (!token) return { error: 'Google Forms not connected. Go to Settings → Integrations → Google Forms to connect.' }

      const res = await fetch(
        `https://forms.googleapis.com/v1/forms/${input.formId}/responses?pageSize=${(input.maxResults as number) ?? 50}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.error) return { error: data.error.message ?? JSON.stringify(data.error) }

      return {
        formId: input.formId,
        responseCount: data.responses?.length ?? 0,
        responses: (data.responses ?? []).slice(0, 50).map((r: Record<string, unknown>) => ({
          responseId: r.responseId,
          createTime: r.createTime,
          lastSubmittedTime: r.lastSubmittedTime,
          answers: r.answers,
        })),
      }
    }

    case 'delete_form': {
      requirePlan('tier3', 'Google Forms')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'delete_form',
          summary: `Delete Google Form`,
          draft_content: `Deleting Google Form: ${input.formId}`,
          metadata: { formId: input.formId },
          status: 'pending',
        })
        .select('id').single()
      if (error) throw new Error(error.message)
      return { queued: true, id: data.id, message: 'Form deletion queued. Approve in the Approvals tab.' }
    }

    // ── Tier 3: Google Keep ──

    case 'create_note': {
      requirePlan('tier3', 'Google Keep')
      const token = await getFreshToken(supabase, clientId, 'keep')
      if (!token) return { error: 'Google Keep not connected. Go to Settings → Integrations → Google Keep to connect.' }

      const body: Record<string, unknown> = {
        body: { text: { text: input.content } },
      }
      if (input.title) body.title = input.title

      const res = await fetch('https://keep.googleapis.com/v1/notes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) return { error: data.error.message ?? JSON.stringify(data.error) }

      return { created: true, noteId: data.name, title: data.title, content: input.content }
    }

    case 'list_notes': {
      requirePlan('tier3', 'Google Keep')
      const token = await getFreshToken(supabase, clientId, 'keep')
      if (!token) return { error: 'Google Keep not connected. Go to Settings → Integrations → Google Keep to connect.' }

      const params = new URLSearchParams({ pageSize: String((input.maxResults as number) ?? 20) })
      if (input.filter === 'trashed') params.set('filter', 'trashed=true')
      else if (input.filter === 'archived') params.set('filter', 'trashed=false')

      const res = await fetch(`https://keep.googleapis.com/v1/notes?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.error) return { error: data.error.message ?? JSON.stringify(data.error) }

      const notes = (data.notes ?? []).map((n: Record<string, unknown>) => ({
        id: n.name,
        title: n.title ?? '(no title)',
        snippet: ((n.body as Record<string, unknown>)?.text as Record<string, unknown>)?.text?.toString().slice(0, 100) ?? '',
        createTime: n.createTime,
        updateTime: n.updateTime,
        trashed: n.trashed ?? false,
      }))

      return { count: notes.length, notes }
    }

    case 'update_note': {
      requirePlan('tier3', 'Google Keep')
      const token = await getFreshToken(supabase, clientId, 'keep')
      if (!token) return { error: 'Google Keep not connected.' }

      const updates: Record<string, unknown> = {}
      const updateMask: string[] = []
      if (input.title !== undefined) { updates.title = input.title; updateMask.push('title') }
      if (input.content !== undefined) { updates.body = { text: { text: input.content } }; updateMask.push('body') }

      const res = await fetch(
        `https://keep.googleapis.com/v1/${input.noteId}?updateMask=${updateMask.join(',')}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      )
      const data = await res.json()
      if (data.error) return { error: data.error.message }
      return { updated: true, noteId: input.noteId }
    }

    case 'delete_note': {
      requirePlan('tier3', 'Google Keep')
      const token = await getFreshToken(supabase, clientId, 'keep')
      if (!token) return { error: 'Google Keep not connected.' }

      const res = await fetch(`https://keep.googleapis.com/v1/${input.noteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        const err = await res.json()
        return { error: err.error?.message ?? `Delete failed (${res.status})` }
      }
      return { deleted: true, noteId: input.noteId }
    }

    // ── Tier 4: Meet — list & cancel ──

    case 'list_meetings': {
      requirePlan('tier4', 'Google Meet')
      const token = await getFreshToken(supabase, clientId, 'calendar')
      if (!token) return { error: 'Google Calendar not connected.' }

      const timeMin = (input.timeMin as string) ?? new Date().toISOString()
      const timeMax = (input.timeMax as string) ?? new Date(Date.now() + 30 * 86400000).toISOString()
      const params = new URLSearchParams({
        timeMin, timeMax,
        maxResults: String((input.maxResults as number) ?? 20),
        singleEvents: 'true',
        orderBy: 'startTime',
        q: 'meet.google.com',
      })
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.error) return { error: data.error.message }

      const meetings = (data.items ?? [])
        .filter((e: Record<string, unknown>) => (e.hangoutLink || (e.conferenceData as Record<string, unknown>)))
        .map((e: Record<string, unknown>) => ({
          id: e.id,
          title: e.summary ?? '(no title)',
          start: (e.start as Record<string, string>)?.dateTime ?? (e.start as Record<string, string>)?.date,
          end: (e.end as Record<string, string>)?.dateTime,
          meetLink: e.hangoutLink ?? null,
          attendees: ((e.attendees as Record<string, string>[]) ?? []).map(a => a.email),
        }))

      return { count: meetings.length, meetings }
    }

    case 'cancel_meeting': {
      requirePlan('tier4', 'Google Meet')
      const { data, error } = await supabase
        .from('prymal_approval_queue')
        .insert({
          client_id: clientId,
          agent: 'google',
          action_type: 'cancel_meeting',
          summary: `Cancel meeting`,
          draft_content: `Cancelling meeting event ${input.eventId}${input.message ? `\nMessage: ${input.message}` : ''}`,
          metadata: { eventId: input.eventId, notifyAttendees: input.notifyAttendees ?? true, message: input.message },
          status: 'pending',
        })
        .select('id').single()
      if (error) throw new Error(error.message)
      return { queued: true, id: data.id, message: 'Meeting cancellation queued. Approve in the Approvals tab.' }
    }

    // ── Tier 4: Contacts — get & search ──

    case 'get_contact': {
      requirePlan('tier4', 'Google Contacts')
      const token = await getFreshToken(supabase, clientId, 'contacts')
      if (!token) return { error: 'Google Contacts not connected.' }

      const res = await fetch(
        `https://people.googleapis.com/v1/${input.resourceName}?personFields=names,emailAddresses,phoneNumbers,organizations,biographies`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.error) return { error: data.error.message }

      return {
        resourceName: data.resourceName,
        name: data.names?.[0]?.displayName,
        emails: (data.emailAddresses ?? []).map((e: Record<string, string>) => e.value),
        phones: (data.phoneNumbers ?? []).map((p: Record<string, string>) => p.value),
        company: data.organizations?.[0]?.name,
        jobTitle: data.organizations?.[0]?.title,
        bio: data.biographies?.[0]?.value,
      }
    }

    case 'search_contacts': {
      requirePlan('tier4', 'Google Contacts')
      const token = await getFreshToken(supabase, clientId, 'contacts')
      if (!token) return { error: 'Google Contacts not connected.' }

      const params = new URLSearchParams({
        query: input.query as string,
        pageSize: String((input.maxResults as number) ?? 20),
        readMask: 'names,emailAddresses,phoneNumbers,organizations',
      })
      const res = await fetch(
        `https://people.googleapis.com/v1/people:searchContacts?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.error) return { error: data.error.message }

      const contacts = (data.results ?? []).map((r: Record<string, unknown>) => {
        const p = r.person as Record<string, unknown>
        return {
          resourceName: p.resourceName,
          name: (p.names as Record<string, string>[])?.[0]?.displayName,
          email: (p.emailAddresses as Record<string, string>[])?.[0]?.value,
          phone: (p.phoneNumbers as Record<string, string>[])?.[0]?.value,
          company: (p.organizations as Record<string, string>[])?.[0]?.name,
        }
      })

      return { count: contacts.length, contacts }
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}

// ── Gemini 2.0 Flash agentic loop ────────────────────────────────────────────

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: unknown } }

async function runGeminiLoop(
  apiKey: string,
  history: { role: string; content: string }[],
  message: string,
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  clientPlan: string,
  channel: string = 'web'
): Promise<string> {
  const availableTools = filterToolsByPlan(TOOLS, clientPlan)
  const geminiSafeTools = channel === 'automation' ? availableTools.filter(t => t.name !== 'resolve_pending_action') : availableTools
  const functionDeclarations = geminiSafeTools.map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  }))

  // Build initial contents from plain-text history + new message
  const validHistory = validateHistory(history)
  const contents: { role: string; parts: GeminiPart[] }[] = [
    ...validHistory.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }] as GeminiPart[],
    })),
    { role: 'user', parts: [{ text: message }] },
  ]

  for (let i = 0; i < 10; i++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: buildSystemPrompt(clientPlan, channel) }] },
          contents,
          tools: [{ functionDeclarations }],
          generationConfig: { maxOutputTokens: 4096 },
        }),
      }
    )

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`)
    }

    const data = await res.json()
    const parts: GeminiPart[] = data.candidates?.[0]?.content?.parts ?? []
    const calls = parts.filter(
      (p): p is { functionCall: { name: string; args: Record<string, unknown> } } => 'functionCall' in p
    )

    if (calls.length === 0) {
      return parts
        .filter((p): p is { text: string } => 'text' in p)
        .map(p => p.text)
        .join('')
    }

    // Push model turn + execute tools
    contents.push({ role: 'model', parts })
    const responses: GeminiPart[] = await Promise.all(
      calls.map(async c => {
        try {
          const result = await handleTool(c.functionCall.name, c.functionCall.args as Record<string, unknown>, supabase, clientId, clientPlan, channel)
          return { functionResponse: { name: c.functionCall.name, response: { output: JSON.stringify(result) } } }
        } catch (err) {
          return { functionResponse: { name: c.functionCall.name, response: { error: (err as Error).message } } }
        }
      })
    )
    contents.push({ role: 'user', parts: responses })
  }

  throw new Error('Gemini loop exceeded max iterations')
}

// ── Input validation helpers ──────────────────────────────────────────────────

function validateHistory(history: unknown): { role: 'user' | 'assistant'; content: string }[] {
  if (!Array.isArray(history)) {
    console.warn('[WARN] Invalid history: not an array, returning empty')
    return []
  }

  return history
    .filter((msg): msg is { role: 'user' | 'assistant'; content: string } => {
      if (!msg || typeof msg !== 'object') return false
      if (!('role' in msg) || !('content' in msg)) return false
      if (typeof msg.role !== 'string' || typeof msg.content !== 'string') return false
      if (msg.role !== 'user' && msg.role !== 'assistant') return false
      return true
    })
    .slice(0, 20) // Enforce max history length at backend
}

function validateMessage(message: unknown): string {
  if (typeof message !== 'string' || !message.trim()) {
    throw new Error('Message must be a non-empty string')
  }
  return message.trim()
}

function validatePlan(plan: unknown): string {
  const validPlans = ['free', 'trial', 'tier1', 'starter', 'tier2', 'pro', 'tier3', 'tier4', 'agency']

  if (!validPlans.includes(plan as string)) {
    if (plan !== null && plan !== undefined) {
      console.warn(`[WARN] Invalid plan: "${plan}", defaulting to free`)
    }
    return 'free'
  }

  return plan as string
}

// ── Claude Haiku fallback loop ────────────────────────────────────────────────

async function runHaikuLoop(
  apiKey: string,
  history: { role: string; content: string }[],
  message: string,
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  clientPlan: string,
  channel: string = 'web'
): Promise<string> {
  const anthropic = new Anthropic({ apiKey })
  const validHistory = validateHistory(history)
  const messages: Anthropic.MessageParam[] = [
    ...validHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ]

  const availableTools = filterToolsByPlan(TOOLS, clientPlan)
  // External apps via Composio (feature-flagged; [] when off)
  const composioTools = await getComposioTools(clientId)
  const allTools = [...availableTools, ...composioTools]
  // Unattended runs must never self-approve queued actions (prompt-injection guard)
  const loopTools = channel === 'automation' ? allTools.filter(t => t.name !== 'resolve_pending_action') : allTools

  while (true) {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: buildSystemPrompt(clientPlan, channel),
      tools: loopTools,
      messages,
    })

    if (response.stop_reason === 'end_turn') {
      const text = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as Anthropic.TextBlock).text)
        .join('')
      return text
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          try {
            const result = await handleTool(block.name, block.input as Record<string, unknown>, supabase, clientId, clientPlan, channel)
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
          } catch (err) {
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Error: ${(err as Error).message}`, is_error: true })
          }
        }
      }
      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: toolResults })
      continue
    }

    break
  }
  return ''
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  Object.assign(CORS, corsHeaders(req))
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  try {
    console.log('[VERSION] prymal-chat deployed 2026-06-28 v2.5 with detailed token logging')
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const body = await req.json()
    const { message, history = [], channel = 'web' } = body

    // ── Auth: user JWT (web) OR internal shared secret (SMS/WhatsApp bridge) ──
    let clientRow: { id: string; anthropic_api_key: string | null; gemini_api_key: string | null; plan: string } | null = null

    const internalKey = req.headers.get('x-internal-key')
    const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? ''
    if (internalKey && INTERNAL_SECRET && internalKey === INTERNAL_SECRET && body.client_id) {
      const { data } = await supabase
        .from('prymal_clients')
        .select('id, anthropic_api_key, gemini_api_key, plan')
        .eq('id', body.client_id)
        .single()
      clientRow = data
    } else {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

      const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!)
      const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
      if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

      const { data } = await supabase
        .from('prymal_clients')
        .select('id, anthropic_api_key, gemini_api_key, plan')
        .eq('user_id', user.id)
        .single()
      clientRow = data
    }

    if (!clientRow) return new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404 })

    if (rateLimited(clientRow.id)) {
      return new Response(JSON.stringify({ error: "Alfy's catching its breath — try again in a few minutes." }), {
        status: 429, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // Validate inputs
    let validatedMessage: string
    try {
      validatedMessage = validateMessage(message)
    } catch (err) {
      return new Response(
        JSON.stringify({ error: (err as Error).message }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    const clientPlan = validatePlan(clientRow.plan)
    const isTrial = clientPlan === 'trial'

    // ── Trial action cap enforcement (server-side, hard requirement) ──────────
    let trialActionsUsed = 0
    let trialDailyActions = 0
    if (isTrial) {
      const { data: capRow } = await supabase
        .from('prymal_clients')
        .select('trial_actions_used, trial_daily_actions, trial_daily_reset_date')
        .eq('id', clientRow.id)
        .single()

      const today = new Date().toISOString().split('T')[0]
      const dailyReset = capRow?.trial_daily_reset_date !== today
      trialActionsUsed = capRow?.trial_actions_used ?? 0
      trialDailyActions = dailyReset ? 0 : (capRow?.trial_daily_actions ?? 0)

      // Hard cap: 75 total actions per trial
      if (trialActionsUsed >= 75) {
        return new Response(JSON.stringify({
          reply: "You've used all **75 trial actions** — great run! 🎉\n\nUpgrade now to keep going. Your **$5 trial credit** applies directly to your first month.\n\n[Upgrade and continue →](/upgrade)",
          trial_limit_reached: true,
          trial_actions_used: trialActionsUsed,
          trial_actions_remaining: 0,
        }), { headers: { 'Content-Type': 'application/json', ...CORS } })
      }

      // Soft cap: ~20 per day (stops burning all 75 in one session)
      if (trialDailyActions >= 20) {
        return new Response(JSON.stringify({
          reply: "You've hit today's **soft limit of 20 actions** — this keeps your trial spread across the week so you can see what Prymal can really do.\n\nCome back tomorrow, or **upgrade now** to remove the daily cap entirely.\n\n[Upgrade and continue →](/upgrade)",
          trial_daily_limit: true,
          trial_actions_used: trialActionsUsed,
          trial_actions_remaining: 75 - trialActionsUsed,
        }), { headers: { 'Content-Type': 'application/json', ...CORS } })
      }
    }

    // Admin client key overrides platform key; everyone else uses platform key
    const geminiKey = (clientRow.gemini_api_key as string | null) || PLATFORM_GEMINI_KEY
    const anthropicKey = (clientRow.anthropic_api_key as string | null) || PLATFORM_ANTHROPIC_KEY

    // ── Haiku-first, Gemini fallback ──────────────────────────────────────────
    let finalText = ''

    if (anthropicKey) {
      try {
        finalText = await runHaikuLoop(
          anthropicKey, history, validatedMessage, supabase, clientRow.id, clientPlan, channel
        )
      } catch (haikuErr) {
        // Anthropic unavailable or quota exceeded — fall back to Gemini
        console.error('Haiku failed, falling back to Gemini:', (haikuErr as Error).message)
        if (!geminiKey) {
          return new Response(
            JSON.stringify({ reply: 'AI is temporarily unavailable. Please try again in a moment.' }),
            { headers: { 'Content-Type': 'application/json', ...CORS } }
          )
        }
        finalText = await runGeminiLoop(
          geminiKey, history, validatedMessage, supabase, clientRow.id, clientPlan, channel
        )
      }
    } else if (geminiKey) {
      finalText = await runGeminiLoop(
        geminiKey, history, validatedMessage, supabase, clientRow.id, clientPlan, channel
      )
    } else {
      return new Response(
        JSON.stringify({ reply: 'AI engine is not configured. Please contact support.' }),
        { headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    // ── Increment trial counter after a successful model call ─────────────────
    let trialActionsRemaining: number | null = null
    if (isTrial) {
      await supabase.rpc('increment_trial_action', { p_client_id: clientRow.id })
      trialActionsRemaining = Math.max(0, 75 - (trialActionsUsed + 1))
    }

    return new Response(JSON.stringify({
      reply: finalText,
      ...(isTrial ? {
        trial_actions_used: trialActionsUsed + 1,
        trial_actions_remaining: trialActionsRemaining,
        trial_daily_actions: trialDailyActions + 1,
      } : {}),
    }), {
      headers: { 'Content-Type': 'application/json', ...CORS }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS }
    })
  }
})

// redeploy attempt 1784548886

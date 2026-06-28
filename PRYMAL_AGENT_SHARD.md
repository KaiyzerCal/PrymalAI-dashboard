# Prymal AI Agent — Architecture Shard
> How the platform works, how the chat agent operates, and how it controls all Google services.
> Written so any agent (Mavis or otherwise) can replicate this pattern.

---

## 1. What Prymal Is

Prymal is a **white-label AI agent platform** built on top of Supabase + Anthropic Claude. Each client gets a chat interface where they talk to an AI agent called "Prymal" (or any branded name). The agent can read, write, and manage the client's **entire Google Workspace** on their behalf — Gmail, Calendar, Drive, Docs, Sheets, Slides, Forms, Keep, Meet, Contacts, Photos, and Google Business Profile.

Every action that sends something externally (emails, calendar invites, business posts, review replies) goes through an **approval queue** — the client reviews and approves before it goes out. Reading data is always free and immediate.

---

## 2. Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite, hosted on Netlify/Vercel |
| Backend | Supabase (Postgres + Edge Functions on Deno runtime) |
| AI Engine | Anthropic Claude (Haiku by default via client's own API key) |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Payments | Stripe (subscription checkout + webhooks) |
| Google APIs | Direct REST calls from the Edge Function using stored OAuth tokens |

---

## 3. Database Tables (Supabase Postgres)

### `prymal_clients`
The central record for each paying customer.

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key (= `client_id` everywhere) |
| `user_id` | uuid | Links to `auth.users` |
| `owner_email` | text | Account email |
| `business_name` | text | Used in AI system prompt |
| `brand_tone` | text | Writing style instructions injected into system prompt |
| `knowledge_base` | text | Business context injected into system prompt |
| `plan` | text | `'free' \| 'trial' \| 'tier1' \| 'tier2' \| 'tier3' \| 'tier4'` |
| `status` | text | `'active' \| 'past_due' \| 'cancelled'` |
| `trial_ends_at` | timestamptz | When the free trial expires |
| `onboarding_complete` | boolean | Whether they finished the 3-step onboarding |
| `stripe_customer_id` | text | Stripe customer ID |
| `stripe_subscription_id` | text | Stripe subscription ID |
| `gbp_account_id` | text | Google Business Profile account ID |
| `gbp_location_id` | text | GBP location ID |

### `prymal_oauth_tokens`
Stores per-client Google OAuth tokens.

| Column | Type | Purpose |
|---|---|---|
| `client_id` | uuid | FK → `prymal_clients.id` |
| `platform` | text | `'google'`, `'gmail'`, `'gbp'`, etc. |
| `access_token` | text | Short-lived Google access token |
| `refresh_token` | text | Long-lived refresh token (never expires) |
| `expires_at` | timestamptz | When access token expires |

**RLS Policy**: Edge Functions use the service role key, which bypasses RLS. Client-side reads are blocked. The `allow_all_select` policy with `USING (true)` lets the service role read all tokens.

### `prymal_approval_queue`
Pending actions awaiting client approval.

| Column | Type | Purpose |
|---|---|---|
| `client_id` | uuid | Owner |
| `agent` | text | `'google'` (which agent created it) |
| `action_type` | text | `'send_email' \| 'create_event' \| 'respond_to_review' \| ...` |
| `summary` | text | Short title shown on approval card |
| `draft_content` | text | Full content to review |
| `metadata` | jsonb | Extra fields (e.g. `{to, subject}` for emails, `{start, end}` for events) |
| `status` | text | `'pending' \| 'approved' \| 'rejected'` |

### `prymal_api_keys`
Client-supplied API keys (Anthropic, Gemini, etc.)

| Column | Type | Purpose |
|---|---|---|
| `client_id` | uuid | Owner |
| `service` | text | `'anthropic' \| 'gemini'` |
| `api_key` | text | Encrypted at rest |

---

## 4. The `prymal-chat` Edge Function — Core Loop

**File**: `supabase/functions/prymal-chat/index.ts`  
**Runtime**: Deno (Supabase Edge Functions)  
**Endpoint**: `POST https://<project>.supabase.co/functions/v1/prymal-chat`

### Request format
```json
{
  "messages": [
    { "role": "user", "content": "What emails need my attention?" },
    { "role": "assistant", "content": "..." },
    ...
  ]
}
```
Authorization header: `Bearer <supabase_access_token>` (the logged-in user's JWT).

### Core loop (simplified)

```typescript
// 1. Verify the user's JWT and look up their client record
const user = await supabase.auth.getUser(jwt)
const client = await supabase.from('prymal_clients').select('*').eq('user_id', user.id)

// 2. Load their API key (Anthropic preferred, Gemini fallback)
const apiKey = await getApiKey(client.id, 'anthropic')
const anthropic = new Anthropic({ apiKey })

// 3. Filter tools by plan tier
const availableTools = filterToolsByPlan(ALL_TOOLS, client.plan)

// 4. Call Claude with the conversation history + system prompt
const response = await anthropic.messages.create({
  model: 'claude-haiku-4-5',
  system: SYSTEM_PROMPT + client.brand_tone + client.knowledge_base,
  messages: conversationHistory,
  tools: availableTools,
  max_tokens: 4096,
})

// 5. Agentic loop — Claude may call tools multiple times before responding
while (response.stop_reason === 'tool_use') {
  for (const toolUse of response.content.filter(b => b.type === 'tool_use')) {
    const result = await handleTool(toolUse.name, toolUse.input, supabase, client.id, client.plan)
    // Add tool result back to conversation and call Claude again
  }
}

// 6. Return final text response
return new Response(JSON.stringify({ content: finalText }))
```

---

## 5. Plan Tier System

Plans gate which tools Claude can use. The `description` field on each tool definition contains a tier tag like `[Tier 1+]`. The `filterToolsByPlan` function strips out any tool the client's plan doesn't cover before sending to Claude.

```typescript
const PLAN_RANK = { free: 0, trial: 0, tier1: 1, tier2: 2, tier3: 3, tier4: 4 }

function filterToolsByPlan(tools, clientPlan) {
  return tools.filter(tool => {
    const tierTag = tool.description.match(/\[([^\]]+)\]/)?.[1]
    return !tierTag || planAtLeast(clientPlan, tierTag)
  })
}
```

| Plan | Price | Google Services Unlocked |
|---|---|---|
| `free` | $0 | Dashboard only — no agent tools |
| `trial` | $0 (7 days) | Same as free (no Google tools) |
| `tier1` | $17/mo | **Gmail** — read, compose, send, labels, filters, archive, delete |
| `tier2` | $47/mo | + **Calendar** (CRUD events, availability) + **Google Tasks** |
| `tier3` | $97/mo | + **Drive** (list, browse, analyze, CRUD) + **Docs** + **Sheets** + **Slides** + **Forms** + **Keep** |
| `tier4` | $147/mo | + **Google Meet** + **Contacts** + **Photos** (with AI duplicate detection) + **Google Business Profile** |

---

## 6. Google OAuth Token Management

Each client authenticates each Google service separately via OAuth2. Tokens are stored in `prymal_oauth_tokens`.

### Token refresh flow
```typescript
async function getFreshToken(supabase, clientId, platform) {
  const { data } = await supabase
    .from('prymal_oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('client_id', clientId)
    .eq('platform', platform)
    .single()

  // If token is still valid (>60s remaining), return it directly
  if (Date.now() < new Date(data.expires_at).getTime() - 60000) {
    return data.access_token
  }

  // Otherwise refresh via Google's token endpoint
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: data.refresh_token,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
    }),
  })
  const tokens = await res.json()

  // Save new access token and expiry back to DB
  await supabase.from('prymal_oauth_tokens').update({
    access_token: tokens.access_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  }).eq('client_id', clientId).eq('platform', platform)

  return tokens.access_token
}
```

Every tool handler calls `getFreshToken(supabase, clientId, 'google')` before making any Google API call. The refresh happens transparently inside the Edge Function — the client never sees it.

---

## 7. Complete Tool Reference

### Universal (all plans)
| Tool | What it does |
|---|---|
| `get_client_info` | Returns business name, plan, brand tone, knowledge base, and which Google services are connected |
| `get_pending_approvals` | Lists actions awaiting approval in the queue |
| `get_agent_activity` | History of approved/rejected actions |
| `queue_action` | Queues any action for client approval (MUST be used before sending/posting anything) |
| `update_client_info` | Updates brand tone or knowledge base |

### Tier 1 — Gmail
| Tool | What it does |
|---|---|
| `get_emails` | Search inbox (Gmail query syntax, e.g. `"is:unread"`, `"from:person@example.com"`) |
| `get_email_thread` | Read full thread by thread ID |
| `send_email` | Compose and send (goes through approval queue) |
| `list_labels` | List all Gmail labels |
| `create_label` | Create a new label |
| `apply_label` | Add label to thread(s) |
| `remove_label` | Remove label from thread(s) |
| `archive_email` | Remove from inbox |
| `delete_email` | Permanently delete |
| `mark_as_read` / `mark_as_unread` | Toggle read state |
| `create_filter` | Auto-label, archive, or delete based on rules |
| `set_auto_reply` | Set vacation/out-of-office message |
| `schedule_send` | Send at a future date/time |

### Tier 2 — Calendar & Tasks
| Tool | What it does |
|---|---|
| `get_calendar_events` | List upcoming events in a time range |
| `get_availability` | Check free/busy slots |
| `create_event` | Schedule event (title, start, end, attendees, location) |
| `update_event` | Modify existing event |
| `delete_event` | Remove event |
| `create_task` | Add task with optional due date |
| `list_tasks` | List pending tasks |
| `update_task` | Edit task fields |
| `complete_task` | Mark task done |

### Tier 3 — Drive, Docs, Sheets, Slides, Forms, Keep
| Tool | What it does |
|---|---|
| `list_drive_files` | Browse files/folders (by folder ID or search query) |
| `get_file_info` | Full metadata + thumbnail URL for any file |
| `analyze_file` | Open and read any file — text content for docs, inline image markdown for images, metadata for videos |
| `search_drive_files` | Search by name or content |
| `read_drive_file` | Read text content of a Drive file |
| `create_folder` | New Drive folder |
| `move_file` | Move to different folder |
| `delete_file` | Trash or permanently delete |
| `rename_file` | Rename in Drive |
| `share_file` | Share with email addresses at reader/commenter/writer level |
| `set_permissions` | Public/restricted access control |
| `create_document` | New Google Doc with optional content |
| `read_document` | Full text content of a Doc |
| `update_document` | Append or replace Doc content |
| `delete_document` | Trash a Doc |
| `create_sheet` | New Google Spreadsheet |
| `read_sheet` | Read rows/columns from a Sheet |
| `update_sheet` | Append or update cell ranges |
| `delete_sheet` | Trash a Spreadsheet |
| `create_slide` | New Google Slides presentation |
| `read_presentation` | Read slide titles, text, speaker notes |
| `update_slide` | Edit or add a slide |
| `delete_presentation` | Trash a presentation |
| `create_form` | New Google Form with typed questions |
| `read_form` | Read form structure/questions |
| `list_form_responses` | Get submitted responses |
| `delete_form` | Delete a Form |
| `create_note` | New Google Keep note with labels |
| `list_notes` | List notes (filter by pinned/archived/label) |
| `update_note` | Edit note title or content |
| `delete_note` | Delete a note |

### Tier 4 — Meet, Contacts, Photos, Business Profile
| Tool | What it does |
|---|---|
| `schedule_meet` | Create calendar event with Google Meet link |
| `list_meetings` | List upcoming Meet events |
| `cancel_meeting` | Cancel a meeting, optionally notify attendees |
| `create_contact` | New contact (name, email, phone, company, title, notes) |
| `list_contacts` | List contacts, optionally filtered by search |
| `get_contact` | Full details for a specific contact |
| `search_contacts` | Search by name, email, or phone |
| `update_contact` | Edit contact fields |
| `delete_contact` | Remove contact |
| `upload_photo` | Upload image to Google Photos |
| `create_album` | New Photos album |
| `organize_photos` | Add photos to an album |
| `find_duplicate_photos` | AI-powered duplicate detection |
| `delete_duplicate_photos` | Clean duplicates, keep best quality |
| `auto_organize_photos` | Auto-organize by date/location/content |
| `get_reviews` | Fetch GBP reviews |
| `respond_to_review` | Reply to a review (queued for approval) |
| `create_post` | Create a GBP post (STANDARD/EVENT/OFFER/PRODUCT) |

---

## 8. Inline Image Display (Drive)

When `analyze_file` or `get_file_info` is called on an image file, the handler:
1. Fetches `thumbnailLink` from the Drive Files API (field: `thumbnailLink,hasThumbnail`)
2. Resizes by replacing the suffix: `thumbnailLink.replace(/=s\d+$/, '=s1600')`
3. Returns markdown: `![filename](thumbnailUrl)\n\n**filename**\n...`

The system prompt instructs the agent to **pass this markdown through unchanged** — the chat widget's `renderMarkdown()` function then renders it as an actual `<img>` tag inline in the conversation.

```typescript
// In analyze_file handler:
const thumbUrl = meta.thumbnailLink?.replace(/=s\d+$/, '=s1600') ?? null
content = thumbUrl
  ? `![${meta.name}](${thumbUrl})\n\n**${meta.name}**\nSize: ${size} · [Open in Drive](${meta.webViewLink})`
  : `**${meta.name}**\n_No preview available_`
```

---

## 9. Approval Queue Pattern

The agent **never sends anything externally without going through `queue_action` first**. This is enforced by the system prompt and by the tool's placement in the conversation flow.

When a user asks the agent to send an email, the agent:
1. Composes the email content
2. Calls `queue_action` with `action_type: 'send_email'`, `summary: "Reply to Jordan re: proposal"`, `draft_content: <email body>`, `metadata: { to, subject }`
3. Tells the user "I've queued this for your review — check the Approvals tab"

When the client approves in the dashboard, a separate process reads the queued action and executes it via the Google API.

---

## 10. Authentication Flow (for replication)

### New user signup
1. User signs up via `supabase.auth.signUp()` on the Login page
2. A `prymal_clients` record is created with `plan: 'trial'`, `onboarding_complete: false`, 7-day `trial_ends_at`
3. User is redirected to `/onboarding` (3-step setup: Business Info → Brand Settings → Plan Selection)
4. On plan selection, `prymal-stripe-checkout` Edge Function is called with `{ plan: 'tier1' | 'tier2' | 'tier3' | 'tier4' }`
5. User redirects to Stripe hosted checkout, pays, returns to `/?payment=success`
6. Stripe webhook (`prymal-stripe-webhook`) updates `prymal_clients` with `plan`, `status`, `stripe_subscription_id`

### Trial expiry gate
- `AuthGuard` checks `plan === 'trial' && trial_ends_at < now` on every page load
- If expired, user is redirected to `/upgrade` — a plan selection wall that feeds directly into Stripe checkout
- Users who paid via Stripe are on `tier1+`, so `plan !== 'trial'` and this check never fires for them

### Chat authentication
The `prymal-chat` Edge Function receives the user's Supabase JWT in the `Authorization` header. It verifies it with `supabase.auth.getUser(jwt)`, then looks up the client record by `user_id` to get `client_id` and `plan`. All Google API calls use the client's stored OAuth tokens, **not** the user's Supabase session.

---

## 11. How to Build the Same Thing for Mavis

To replicate this architecture for a different agent (Mavis):

### Step 1 — Database
Create equivalent tables:
- `mavis_clients` — same structure as `prymal_clients`
- `mavis_oauth_tokens` — same structure as `prymal_oauth_tokens`
- `mavis_approval_queue` — same structure

### Step 2 — Edge Function
Create `supabase/functions/mavis-chat/index.ts` with:
1. JWT verification → client lookup
2. `getFreshToken(supabase, clientId, 'google')` — identical pattern
3. Tool definitions array — copy the pattern, tag each tool with `[TierX+]` in the description
4. `filterToolsByPlan(tools, clientPlan)` — parse the tag, compare PLAN_RANK
5. Agentic loop: call Claude → handle tool calls → call Claude again until `stop_reason !== 'tool_use'`
6. Every write action → `queue_action` → approval queue

### Step 3 — Google OAuth scopes needed
| Service | Scope |
|---|---|
| Gmail | `https://www.googleapis.com/auth/gmail.modify` + `.send` |
| Calendar | `https://www.googleapis.com/auth/calendar` |
| Tasks | `https://www.googleapis.com/auth/tasks` |
| Drive | `https://www.googleapis.com/auth/drive` |
| Docs | `https://www.googleapis.com/auth/documents` |
| Sheets | `https://www.googleapis.com/auth/spreadsheets` |
| Slides | `https://www.googleapis.com/auth/presentations` |
| Forms | `https://www.googleapis.com/auth/forms` |
| Keep | `https://www.googleapis.com/auth/keep` |
| Contacts | `https://www.googleapis.com/auth/contacts` |
| Photos | `https://www.googleapis.com/auth/photoslibrary` |
| Business Profile | `https://www.googleapis.com/auth/business.manage` |

### Step 4 — System prompt pattern
```
You are [AgentName] — an AI agent managing [client's] Google workspace.

RULES:
1. Never send or post anything externally without calling queue_action first.
2. Reading data is always safe — do it freely.
3. If a feature isn't on their plan, explain which plan unlocks it.
4. If a Google service isn't connected, tell them to go to Settings → Integrations.
5. Match the client's brand tone when drafting content.

FORMATTING:
- Pass through ![name](url) image markdown unchanged
- Use **bold** for file names and key terms
- Use bullet lists for email/file/event listings
```

### Step 5 — Tool handler pattern
Every Google API call follows this pattern:
```typescript
case 'get_emails': {
  requirePlan('tier1', 'Gmail')  // throws if plan is too low
  const token = await getFreshToken(supabase, clientId, 'google')
  if (!token) return { error: 'Gmail not connected. Go to Settings → Integrations.' }

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(input.query)}&maxResults=${input.maxResults}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  // ... format and return
}
```

The pattern is always: **check plan → get token → call Google REST API → format response**.

---

## 12. Key Environment Variables

Set in Supabase Edge Function secrets:

```
SUPABASE_URL                   — auto-provided
SUPABASE_SERVICE_ROLE_KEY      — auto-provided, bypasses RLS
GOOGLE_CLIENT_ID               — from Google Cloud Console OAuth credentials
GOOGLE_CLIENT_SECRET           — from Google Cloud Console OAuth credentials
STRIPE_SECRET_KEY              — Stripe secret key
STRIPE_WEBHOOK_SECRET          — Stripe webhook signing secret
ANTHROPIC_API_KEY              — platform-level fallback (client keys override this)
```

---

## 13. Critical Gotchas

1. **RLS blocks the service role from reading `prymal_oauth_tokens`** if you use `auth.uid()` in the policy. Fix: create a policy with `USING (true)` that the service role satisfies — the service role still bypasses it, but you need the policy to exist without a matching `auth.uid()` condition.

2. **Edge Function file size limit for MCP deployment**: The MCP `deploy_edge_function` tool truncates large TypeScript files (>~2KB). For files over 100KB, deploy via the Supabase dashboard by pasting the full file, or use the Supabase CLI: `supabase functions deploy prymal-chat`.

3. **Token refresh timing**: Check `expires_at - 60000` (60 seconds before expiry), not exactly at expiry. Google access tokens last 1 hour. The refresh token never expires unless revoked.

4. **`trial` plan rank is 0** — same as `free`. A trial user gets the dashboard but no Google tools. Upgrade is required to unlock any agent capability.

5. **`queue_action` is the safety valve** — the system prompt must instruct the agent to use it for ALL external writes. Reads (searching emails, listing files, checking calendar) are always immediate and safe.

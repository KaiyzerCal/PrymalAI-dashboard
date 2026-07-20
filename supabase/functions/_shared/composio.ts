// Composio bridge — connects Alfy to apps beyond Google (Slack, Notion, GitHub,
// Outlook, ...) through Composio's managed tool catalog and OAuth.
// Feature-flagged: without COMPOSIO_API_KEY set, everything here no-ops and the
// chat loop runs exactly as before.
//
// Sovereignty note (WIG): Composio is a third-party SaaS that holds user OAuth
// tokens for connected apps. Approved by founder instruction 2026-07-19; keep
// the flag off until the cost/trust review is signed off.

import Anthropic from 'npm:@anthropic-ai/sdk'

const COMPOSIO_API_KEY = Deno.env.get('COMPOSIO_API_KEY') ?? ''
// Comma-separated toolkit slugs to expose, e.g. "slack,notion,github,outlook"
const COMPOSIO_TOOLKITS = (Deno.env.get('COMPOSIO_TOOLKITS') ?? '')
  .split(',').map(s => s.trim()).filter(Boolean)

export const composioEnabled = Boolean(COMPOSIO_API_KEY && COMPOSIO_TOOLKITS.length)

// Lazily-initialized SDK (npm dep only loaded when the flag is on)
// deno-lint-ignore no-explicit-any
let _composio: any = null
// deno-lint-ignore no-explicit-any
async function getClient(): Promise<any> {
  if (_composio) return _composio
  const { Composio } = await import('npm:@composio/core')
  const { AnthropicProvider } = await import('npm:@composio/anthropic')
  _composio = new Composio({ apiKey: COMPOSIO_API_KEY, provider: new AnthropicProvider() })
  return _composio
}

const composioToolNames = new Set<string>()

// Fetch the Anthropic-format tool defs for this user's connected toolkits.
// Returns [] on any failure — Alfy degrades to Google-only, never crashes.
export async function getComposioTools(userId: string): Promise<Anthropic.Tool[]> {
  if (!composioEnabled) return []
  try {
    const composio = await getClient()
    const tools = await composio.tools.get(userId, { toolkits: COMPOSIO_TOOLKITS })
    const list: Anthropic.Tool[] = Array.isArray(tools) ? tools : []
    for (const t of list) composioToolNames.add(t.name)
    return list
  } catch (err) {
    console.error('Composio tools.get failed:', err)
    return []
  }
}

export function isComposioTool(name: string): boolean {
  return composioToolNames.has(name)
}

export async function executeComposioTool(
  userId: string,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const composio = await getClient()
  return await composio.tools.execute(name, { userId, arguments: args })
}

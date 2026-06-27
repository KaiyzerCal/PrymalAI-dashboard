import type { LucideIcon } from 'lucide-react'
import { Globe, Sparkles, Mail, MessageCircle, TrendingUp, CalendarCheck } from 'lucide-react'

export interface Capability {
  name: string
  minTier?: 'tier1' | 'tier2' | 'tier3' | 'tier4'
}

export interface AgentDef {
  id: string
  name: string
  tagline: string
  description: string
  capabilities: (string | Capability)[]
  color: {
    text: string
    bg: string
    border: string
    dot: string
  }
  icon: LucideIcon
}

export const AGENTS: AgentDef[] = [
  {
    id: 'google',
    name: 'Google Agent',
    tagline: 'Workspace automation & productivity',
    description: 'Automates your entire Google Workspace. Read and manage emails, schedule calendars, organize files, create documents, and automate your digital workflow around the clock.',
    capabilities: [
      { name: 'Email management', minTier: 'tier1' },
      { name: 'Calendar scheduling', minTier: 'tier2' },
      { name: 'Google Tasks', minTier: 'tier2' },
      { name: 'Drive & file management', minTier: 'tier3' },
      { name: 'Docs, Sheets, Slides', minTier: 'tier3' },
      { name: 'Google Meet scheduling', minTier: 'tier4' },
      { name: 'Contacts & Photos', minTier: 'tier4' },
      { name: 'Google Business Profile', minTier: 'tier4' },
    ],
    color: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', dot: 'bg-blue-400' },
    icon: Globe,
  },
  {
    id: 'brand',
    name: 'Brand Agent',
    tagline: 'Social content & publishing',
    description: 'Drafts on-brand social content for Instagram, LinkedIn, Twitter, and Facebook. Keeps your content calendar full, your voice consistent, and your audience engaged — without you lifting a finger.',
    capabilities: ['Content drafting', 'Multi-platform scheduling', 'Brand voice consistency', 'Hashtag strategy'],
    color: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', dot: 'bg-purple-400' },
    icon: Sparkles,
  },
  {
    id: 'outreach',
    name: 'Outreach Agent',
    tagline: 'Prospecting & lead nurturing',
    description: 'Runs targeted email and SMS campaigns to qualified prospects. Personalizes every touchpoint, follows up automatically, and books calls on your behalf — turning cold lists into warm pipelines.',
    capabilities: ['Email sequences', 'SMS campaigns', 'Lead personalization', 'Auto follow-up'],
    color: { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', dot: 'bg-green-400' },
    icon: Mail,
  },
  {
    id: 'service',
    name: 'Service Agent',
    tagline: 'Customer support & response',
    description: 'Handles inbound customer inquiries across all channels. Delivers fast, accurate, on-brand responses 24/7 — and knows when to escalate to a human so nothing falls through the cracks.',
    capabilities: ['Inbound reply drafting', '24/7 coverage', 'Tone matching', 'Escalation routing'],
    color: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', dot: 'bg-cyan-400' },
    icon: MessageCircle,
  },
  {
    id: 'booking',
    name: 'Booking Agent',
    tagline: 'Appointments, scheduling & reminders',
    description: 'Manages your entire appointment pipeline autonomously. Qualifies inbound enquiries, proposes available slots, sends confirmation and reminder messages, and handles reschedules — so your calendar fills itself.',
    capabilities: ['Appointment scheduling', 'Automated reminders', 'Reschedule handling', 'Enquiry qualification'],
    color: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', dot: 'bg-rose-400' },
    icon: CalendarCheck,
  },
  {
    id: 'intel',
    name: 'Intel Agent',
    tagline: 'Business intelligence & insights',
    description: 'Analyzes performance data across all your channels every week. Surfaces competitor moves, flags opportunities before they pass, and delivers a clear actionable briefing every Monday morning.',
    capabilities: ['Weekly briefings', 'Competitor monitoring', 'Performance analysis', 'Opportunity flagging'],
    color: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-400' },
    icon: TrendingUp,
  },
]

export function getAgent(id: string): AgentDef | undefined {
  return AGENTS.find(a => a.id === id)
}

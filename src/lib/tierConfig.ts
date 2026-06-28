/**
 * Tier Configuration and API Assignments
 * Defines which Google APIs and features belong to each subscription tier
 */

export type TierLevel = 'free' | 'tier1' | 'tier2' | 'tier3' | 'tier4'

export interface TierConfig {
  level: TierLevel
  name: string
  price: number
  displayName: string
  description: string
  headline: string
  features: string[]
  apis: string[]
  color: string
}

export const TIER_CONFIGS: Record<TierLevel, TierConfig> = {
  free: {
    level: 'free',
    name: 'Free',
    price: 0,
    displayName: 'Free',
    description: 'Get started',
    headline: 'Dashboard only',
    features: [
      'Setup dashboard',
      'Brand profile configuration',
      'API key management',
    ],
    apis: [],
    color: 'rgba(0,212,255,0.3)',
  },

  tier1: {
    level: 'tier1',
    name: 'Tier 1',
    price: 17,
    displayName: 'Email Mastery',
    description: 'Master your inbox',
    headline: 'Email management',
    features: [
      'AI email composition & drafting',
      'Read, send, and manage emails',
      'Labels, filters, threads, attachments',
      'Schedule sends & auto-reply',
      'Email organization & sorting',
      'Create custom filters',
    ],
    apis: ['Gmail'],
    color: '#00d4ff',
  },

  tier2: {
    level: 'tier2',
    name: 'Tier 2',
    price: 47,
    displayName: 'Calendar & Tasks',
    description: 'Everything in Tier 1 +',
    headline: 'Calendar and task management',
    features: [
      'Everything in Tier 1',
      'Calendar management & scheduling',
      'Google Tasks (create, update, complete)',
      'Appointment automation',
      'Event reminders and attendee management',
      'Availability checking & free/busy slots',
    ],
    apis: ['Gmail', 'Calendar', 'Tasks'],
    color: '#00d4ff',
  },

  tier3: {
    level: 'tier3',
    name: 'Tier 3',
    price: 97,
    displayName: 'Docs & Collaboration',
    description: 'Everything in Tier 2 +',
    headline: 'Document creation and collaboration',
    features: [
      'Everything in Tier 2',
      'Google Drive file management & organization',
      'Google Docs (create, edit, share)',
      'Google Sheets (data, logging, reports)',
      'Google Slides (presentations)',
      'Google Forms (create surveys & forms)',
      'Google Keep (note-taking)',
      'File sharing & permissions management',
      'Location intelligence (Places)',
    ],
    apis: ['Gmail', 'Calendar', 'Tasks', 'Drive', 'Docs', 'Sheets', 'Slides', 'Forms', 'Keep', 'Places'],
    color: '#00d4ff',
  },

  tier4: {
    level: 'tier4',
    name: 'Tier 4',
    price: 147,
    displayName: 'Full Access',
    description: 'Everything in Tier 3 +',
    headline: 'Complete Google workspace control',
    features: [
      'Everything in Tier 3',
      'Google Meet scheduling & video calls',
      'Google Contacts management',
      'Google Photos organization & duplicate detection',
      'Google Business Profile (reviews, posts, reputation)',
      'Advanced photo analysis and smart organization',
    ],
    apis: ['Gmail', 'Calendar', 'Tasks', 'Drive', 'Docs', 'Sheets', 'Slides', 'Forms', 'Keep', 'Places', 'Meet', 'Contacts', 'Photos', 'Business Profile'],
    color: '#00d4ff',
  },
}

/**
 * API to Tier mapping - quickly find which tier an API belongs to
 */
export const API_TO_TIER: Record<string, TierLevel> = {
  'Gmail': 'tier1',
  'Calendar': 'tier2',
  'Tasks': 'tier2',
  'Drive': 'tier3',
  'Docs': 'tier3',
  'Sheets': 'tier3',
  'Slides': 'tier3',
  'Forms': 'tier3',
  'Keep': 'tier3',
  'Places': 'tier3',
  'Meet': 'tier4',
  'Contacts': 'tier4',
  'Photos': 'tier4',
  'Business Profile': 'tier4',
}

/**
 * OAuth scopes for each Google API
 */
export const GOOGLE_SCOPES: Record<string, string[]> = {
  // Tier 1
  gmail: [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
  ],

  // Tier 2
  calendar: ['https://www.googleapis.com/auth/calendar'],
  tasks: ['https://www.googleapis.com/auth/tasks'],

  // Tier 3
  drive: ['https://www.googleapis.com/auth/drive'],
  docs: ['https://www.googleapis.com/auth/documents'],
  sheets: ['https://www.googleapis.com/auth/spreadsheets'],
  slides: ['https://www.googleapis.com/auth/presentations'],
  forms: ['https://www.googleapis.com/auth/forms'],
  keep: ['https://www.googleapis.com/auth/keep'],
  places: ['https://www.googleapis.com/auth/cloud-platform'],

  // Tier 4
  meet: ['https://www.googleapis.com/auth/calendar'],
  contacts: ['https://www.googleapis.com/auth/contacts'],
  photos: ['https://www.googleapis.com/auth/photoslibrary'],
  gbp: ['https://www.googleapis.com/auth/business.manage'],
}

/**
 * Helper: Get all tiers from lowest to highest
 */
export function getTierHierarchy(): TierLevel[] {
  return ['free', 'tier1', 'tier2', 'tier3', 'tier4']
}

/**
 * Helper: Check if a plan meets a minimum tier requirement
 */
export function planAtLeast(userPlan: string, requiredTier: TierLevel): boolean {
  const hierarchy = getTierHierarchy()
  const userTierIndex = hierarchy.indexOf(userPlan as TierLevel)
  const requiredTierIndex = hierarchy.indexOf(requiredTier)
  return userTierIndex >= requiredTierIndex
}

/**
 * Helper: Get all available tiers for display
 */
export function getAvailableTiers(): TierConfig[] {
  return getTierHierarchy().map(tier => TIER_CONFIGS[tier])
}

/**
 * Helper: Get features available for a tier (including inherited from lower tiers)
 */
export function getFeaturesForTier(tier: TierLevel): string[] {
  const hierarchy = getTierHierarchy()
  const tierIndex = hierarchy.indexOf(tier)

  const features = new Set<string>()
  for (let i = 0; i <= tierIndex; i++) {
    TIER_CONFIGS[hierarchy[i]].features.forEach(f => features.add(f))
  }

  return Array.from(features)
}

/**
 * Helper: Get APIs available for a tier (including inherited from lower tiers)
 */
export function getApisForTier(tier: TierLevel): string[] {
  const hierarchy = getTierHierarchy()
  const tierIndex = hierarchy.indexOf(tier)

  const apis = new Set<string>()
  for (let i = 0; i <= tierIndex; i++) {
    TIER_CONFIGS[hierarchy[i]].apis.forEach(api => apis.add(api))
  }

  return Array.from(apis)
}

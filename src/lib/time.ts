// Centralized time management for the platform
// Ensures consistent timezone handling across frontend and backend

/**
 * TIMEZONE STRATEGY:
 * - Database: All timestamps stored in UTC (ISO 8601)
 * - Server: Edge functions use server time (UTC)
 * - Browser: All display uses browser's local timezone
 * - Chat: Messages show user's local time
 * - Calendar: Events display in user's timezone
 *
 * This ensures accuracy across all features while
 * respecting each user's local timezone.
 */

// Get current time in ISO format (UTC) - used for database
export function now(): string {
  return new Date().toISOString()
}

// Get browser's timezone offset
export function getTimezoneOffset(): number {
  return new Date().getTimezoneOffset()
}

// Get timezone name (e.g., "America/New_York")
export function getTimezoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

// Parse ISO string to Date (handles timezone correctly)
export function parseISO(isoString: string): Date {
  return new Date(isoString)
}

// Format ISO string as local date/time
export function formatLocal(isoString: string, options?: Intl.DateTimeFormatOptions): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleString('en-US', options || {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return 'Invalid date'
  }
}

// Format for chat: "2:30 PM" or "3:45 AM"
export function formatChatTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return '--:--'
  }
}

// Format for calendar events: "Mar 15, 2:30 PM"
export function formatCalendarTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return 'Invalid date'
  }
}

// Calculate days remaining (for trial countdown, etc)
export function daysUntil(isoString: string): number {
  try {
    const targetDate = new Date(isoString)
    const now = new Date()
    const diffMs = targetDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  } catch {
    return 0
  }
}

// Check if timestamp is in the past
export function isPast(isoString: string): boolean {
  try {
    return new Date(isoString) < new Date()
  } catch {
    return false
  }
}

// Check if timestamp is in the future
export function isFuture(isoString: string): boolean {
  try {
    return new Date(isoString) > new Date()
  } catch {
    return false
  }
}

// Get human-readable time difference
export function getTimeDifference(iso1: string, iso2: string): string {
  try {
    const date1 = new Date(iso1)
    const date2 = new Date(iso2)
    const diffMs = Math.abs(date2.getTime() - date1.getTime())

    const seconds = Math.floor(diffMs / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  } catch {
    return 'Unknown'
  }
}

// Sync time with server (for clock skew correction)
export function getServerTimeOffset(): number {
  // This can be set by calling setServerTimeOffset on page load
  // by comparing client time with server time from headers
  return localStorage.getItem('server-time-offset')
    ? parseInt(localStorage.getItem('server-time-offset') || '0')
    : 0
}

export function setServerTimeOffset(offset: number) {
  localStorage.setItem('server-time-offset', offset.toString())
}

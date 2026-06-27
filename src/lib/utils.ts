export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

// ── Timezone-aware date/time utilities ──
// All timestamps in the database are stored in UTC (ISO 8601)
// These functions handle timezone conversion for display

export function formatDate(iso: string) {
  try {
    const date = new Date(iso)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return 'Invalid date'
  }
}

export function formatTime(iso: string) {
  try {
    const date = new Date(iso)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  } catch {
    return 'Invalid time'
  }
}

export function formatDateTime(iso: string) {
  try {
    const date = new Date(iso)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return 'Invalid date/time'
  }
}

export function formatRelative(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return formatDate(iso)
  } catch {
    return 'Unknown'
  }
}

// Get current timestamp in ISO 8601 format (UTC)
export function getCurrentTimestamp() {
  return new Date().toISOString()
}

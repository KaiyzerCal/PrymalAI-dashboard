// Monitoring and error tracking setup with Sentry
import * as Sentry from '@sentry/react'
import { useEffect } from 'react'

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || ''
const ENVIRONMENT = import.meta.env.MODE || 'production'

// Initialize Sentry for error tracking
export function initializeMonitoring() {
  if (!SENTRY_DSN) {
    console.warn('SENTRY_DSN not configured. Error tracking disabled.')
    return
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0, // 10% in production, 100% in dev
  })
}

// Hook to capture user context for Sentry
export function useSentryUser(userId?: string, email?: string, plan?: string) {
  useEffect(() => {
    if (userId) {
      Sentry.setUser({
        id: userId,
        email,
        other: { plan },
      })
    } else {
      Sentry.setUser(null)
    }
  }, [userId, email, plan])
}

// Manually capture error with context
export function captureError(error: Error, context?: Record<string, unknown>) {
  if (SENTRY_DSN) {
    Sentry.captureException(error, {
      tags: {
        component: 'prymal',
      },
      contexts: {
        custom: context,
      },
    })
  } else {
    console.error(error)
  }
}

// Capture custom events (e.g., user actions, feature usage)
export function captureEvent(eventName: string, properties?: Record<string, unknown>) {
  if (SENTRY_DSN) {
    Sentry.captureMessage(eventName, 'info')
    // Additional context
    if (properties) {
      Sentry.withScope((scope: Sentry.Scope) => {
        Object.entries(properties).forEach(([key, value]) => {
          scope.setContext(key, { value })
        })
        Sentry.captureMessage(eventName)
      })
    }
  } else {
    console.log(eventName, properties)
  }
}

// Monitor API performance
export async function monitorFetch(
  url: string,
  options?: RequestInit,
  context?: Record<string, unknown>
): Promise<Response> {
  try {
    return await fetch(url, options)
  } catch (error) {
    captureError(error as Error, { url, ...context })
    throw error
  }
}

// Alert for critical issues (could integrate with Slack, PagerDuty, etc.)
export function alertCriticalIssue(message: string, severity: 'error' | 'warning' | 'critical' = 'critical') {
  console.error(`[${severity.toUpperCase()}]`, message)

  if (SENTRY_DSN) {
    Sentry.captureMessage(message, severity === 'critical' ? 'fatal' : 'error')
  }

  // TODO: Integrate with alerting service (Slack webhook, PagerDuty, etc.)
  // Example:
  // if (severity === 'critical') {
  //   fetch(SLACK_WEBHOOK_URL, {
  //     method: 'POST',
  //     body: JSON.stringify({
  //       text: `🚨 ${message}`,
  //       channel: '#alerts',
  //     })
  //   })
  // }
}

// Health check for critical services
export async function healthCheck(): Promise<{ status: 'ok' | 'degraded' | 'down'; errors: string[] }> {
  const errors: string[] = []

  // Check Supabase
  try {
    const response = await fetch(import.meta.env.VITE_SUPABASE_URL + '/rest/v1/prymal_clients?limit=0', {
      headers: {
        apiKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    })
    if (!response.ok) {
      errors.push('Supabase database unavailable')
    }
  } catch (e) {
    errors.push(`Supabase error: ${(e as Error).message}`)
  }

  // Check prymal-chat function
  try {
    const response = await fetch(import.meta.env.VITE_FUNCTION_BASE + '/prymal-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'health' }),
    })
    if (!response.ok && response.status !== 401) {
      errors.push('prymal-chat function unavailable')
    }
  } catch (e) {
    errors.push(`Chat function error: ${(e as Error).message}`)
  }

  const status = errors.length === 0 ? 'ok' : errors.length === 1 ? 'degraded' : 'down'

  if (status !== 'ok') {
    alertCriticalIssue(`Health check ${status}: ${errors.join(', ')}`, status === 'down' ? 'critical' : 'warning')
  }

  return { status, errors }
}

export const SentryErrorBoundary = Sentry.ErrorBoundary

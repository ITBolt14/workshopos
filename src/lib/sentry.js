// src/lib/sentry.js
// Sentry error tracking — initialised once at app startup in main.jsx.
// Captures: JS errors, unhandled promise rejections, network failures,
// session replays leading up to crashes, and performance traces.
//
// Environment tagging:
//   development  → local dev (npm run dev)
//   staging      → staging Netlify site
//   production   → live client-facing site

import * as Sentry from '@sentry/react'

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  const env = import.meta.env.VITE_ENV || import.meta.env.MODE

  if (!dsn) {
    console.warn('[Sentry] VITE_SENTRY_DSN not set — error tracking disabled')
    return
  }

  Sentry.init({
    dsn,
    environment: env,
    release:     'workshopos@0.1.0',

    // Capture 20% of page loads for performance monitoring
    // Increase to 1.0 temporarily to debug a performance issue
    tracesSampleRate: 0.2,

    // Record a video-like replay of user actions for every error
    replaysOnErrorSampleRate: 1.0,

    // Record 5% of normal sessions (not just errors)
    replaysSessionSampleRate: 0.05,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText:   true,  // POPIA: mask all text in replays
        blockAllMedia: false,
      }),
    ],

    // Filter out noise that isn't actionable
    beforeSend(event, hint) {
      const error = hint?.originalException

      // User went offline — not a code bug
      if (error?.message?.includes('NetworkError') ||
          error?.message?.includes('Failed to fetch') ||
          error?.message?.includes('Load failed') ||
          error?.message?.includes('Network request failed')) {
        return null
      }

      // Supabase GoTrueClient warning — not an error
      if (error?.message?.includes('Multiple GoTrueClient')) {
        return null
      }

      // Dynamic import failures caused by deployments — user just needs to refresh
      if (error?.message?.includes('dynamically imported module') ||
          error?.message?.includes('Importing a module script failed')) {
        return null
      }

      return event
    },
  })

  console.log(`[Sentry] Initialised — environment: ${env}`)
}

// SECTION: Tag the logged-in user
// Call after AuthContext loads the profile so every error is attributed to a user.
export function setSentryUser(profile, branch) {
  if (!profile) {
    Sentry.setUser(null)
    return
  }

  Sentry.setUser({
    id:       profile.id,
    email:    profile.email || undefined,
    username: profile.full_name,
    segment:  branch?.name || 'Unknown Branch',
  })

  Sentry.setTag('branch_id',   branch?.id    || 'unknown')
  Sentry.setTag('branch_name', branch?.name  || 'unknown')
  Sentry.setTag('user_role',   profile.tier1_role || 'unknown')
  Sentry.setTag('workshop_code', branch?.workshop_code || 'unknown')
}

// SECTION: Manually capture an error with context
// Use in catch blocks where you want to log to Sentry but handle gracefully
export function captureError(error, context = {}) {
  Sentry.captureException(error, { extra: context })
}

// SECTION: Capture a message (non-error event)
// Use for important state transitions you want to track
export function captureMessage(message, level = 'info', context = {}) {
  Sentry.captureMessage(message, { level, extra: context })
}

export { Sentry }

// src/lib/supabase.js
// Management portal Supabase client — MAIN portal only.
//
// ═══════════════════════════════════════════════════════════════════
// CRITICAL SUPABASE AUTH PATTERN — READ BEFORE EDITING
// ═══════════════════════════════════════════════════════════════════
// In Supabase JS v2, getSession() reads from in-memory state which
// may be empty on first page load even if a valid token exists in
// localStorage. DO NOT use getSession() to check auth state on load.
//
// CORRECT pattern — always use onAuthStateChange and wait for events:
//   INITIAL_SESSION → fired once on load, session is now known (may be null)
//   SIGNED_IN       → fired on login or tab return
//   SIGNED_OUT      → fired on logout
//   TOKEN_REFRESHED → fired on silent token refresh (update user only)
//
// See AuthContext.jsx for the canonical implementation.
// See QRSticker.jsx for the standalone-page (new tab) pattern.
// ═══════════════════════════════════════════════════════════════════
//
// SECURITY: Anon key only — NEVER use service_role key in frontend code.
// All access control is enforced by RLS policies in Supabase.
//
// storageKey 'workshopos-main-auth' is EXPLICIT and UNIQUE.
// The workshop client uses 'workshopos-workshop-auth'.
// This prevents the GoTrueClient singleton conflict that causes
// session state to leak between the two portals.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnon) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
  )
}

// Custom storage wrapper — catches localStorage errors in private browsing mode
const customStorage = {
  getItem:    (key) => { try { return localStorage.getItem(key)        } catch { return null } },
  setItem:    (key, value) => { try { localStorage.setItem(key, value) } catch {} },
  removeItem: (key) => { try { localStorage.removeItem(key)            } catch {} },
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: true,
    multiTab:           false,    // Single-tab model — prevents cross-tab session conflicts
    storageKey:         'workshopos-main-auth',
    storage:            customStorage,
  },
})

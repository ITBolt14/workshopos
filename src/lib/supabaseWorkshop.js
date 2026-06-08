// src/lib/supabaseWorkshop.js
// Workshop portal Supabase client — WORKSHOP portal only.
//
// ═══════════════════════════════════════════════════════════════════
// CRITICAL SUPABASE AUTH PATTERN — READ BEFORE EDITING
// ═══════════════════════════════════════════════════════════════════
// This client deliberately has NO auth persistence.
// The workshop portal uses PIN-based auth stored in sessionStorage,
// not Supabase auth. This client is used only for data queries
// (jobs, stages, clocking) as the anon role.
//
// DO NOT add getSession() or onAuthStateChange calls to workshop
// portal pages — they will always return null/no session by design.
// ═══════════════════════════════════════════════════════════════════
//
// storageKey 'workshopos-workshop-auth' is UNIQUE to prevent conflicts
// with the main portal client's 'workshopos-main-auth'.
// The dummy storage implementation ensures no tokens are ever stored
// or read, preventing the GoTrueClient from interfering with the
// management portal's session.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseWorkshop = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession:     false,
    autoRefreshToken:   false,
    detectSessionInUrl: false,
    storageKey:         'workshopos-workshop-auth',
    storage: {
      getItem:    () => null,
      setItem:    () => {},
      removeItem: () => {},
    },
  },
  global: {
    headers: { 'x-client-info': 'workshopos-workshop' },
  },
})

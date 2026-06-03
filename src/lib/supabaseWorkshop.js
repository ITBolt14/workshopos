// src/lib/supabaseWorkshop.js
// Separate Supabase client for the workshop portal ONLY.
// Auth persistence is completely disabled — the workshop portal
// uses PIN-based localStorage auth, never Supabase auth sessions.
// This prevents the workshop portal from interfering with the
// management portal's authenticated session.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseWorkshop = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession:    false,  // Never store a session — workshop uses PIN only
    autoRefreshToken:  false,  // No token to refresh
    detectSessionInUrl: false, // Never read auth tokens from URL
    storage: {
      // Dummy storage — prevents any localStorage reads/writes for auth
      getItem:    () => null,
      setItem:    () => {},
      removeItem: () => {},
    },
  },
})

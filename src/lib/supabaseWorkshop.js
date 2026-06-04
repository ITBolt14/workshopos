// src/lib/supabaseWorkshop.js
// Separate Supabase client for the workshop portal ONLY.
// Uses a unique storageKey so it never conflicts with the main portal client.
// Auth persistence fully disabled — workshop uses PIN-based sessionStorage only.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseWorkshop = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession:     false,
    autoRefreshToken:   false,
    detectSessionInUrl: false,
    // Unique storage key prevents the "Multiple GoTrueClient instances" conflict
    // with the main portal client which uses the default key
    storageKey:         'workshopos-workshop-auth',
    storage: {
      getItem:    () => null,
      setItem:    () => {},
      removeItem: () => {},
    },
  },
  // Unique global key also prevents internal singleton conflicts
  global: {
    headers: { 'x-client-info': 'workshopos-workshop' }
  }
})

// src/lib/supabase.js
// Management portal Supabase client.
// SECURITY: Anon key only — never service role key.
// Uses explicit storageKey to prevent conflicts with the workshop client.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnon) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.'
  )
}

const customStorage = {
  getItem:    (key) => { try { return localStorage.getItem(key) } catch { return null } },
  setItem:    (key, value) => { try { localStorage.setItem(key, value) } catch {} },
  removeItem: (key) => { try { localStorage.removeItem(key) } catch {} },
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: true,
    multiTab:           false,
    // Explicit storage key — prevents any conflict with the workshop client
    storageKey:         'workshopos-main-auth',
    storage:            customStorage,
  },
})

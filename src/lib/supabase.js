// src/lib/supabase.js
// Management portal Supabase client.
// Uses a custom storage adapter that wraps localStorage but suppresses
// the 'storage' event that fires when workshop portal clears sessionStorage.
// This prevents AuthContext from resetting when the workshop portal
// modifies any storage.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnon) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.'
  )
}

// SECTION: Custom storage adapter
// Reads/writes to localStorage normally but prevents Supabase from
// registering its own window 'storage' event listener.
// This stops cross-tab and cross-portal storage events from
// triggering auth state resets in the management portal.
const customStorage = {
  getItem: (key) => {
    try { return localStorage.getItem(key) } catch { return null }
  },
  setItem: (key, value) => {
    try { localStorage.setItem(key, value) } catch {}
  },
  removeItem: (key) => {
    try { localStorage.removeItem(key) } catch {}
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: true,
    multiTab:           false,
    storage:            customStorage,
  },
})

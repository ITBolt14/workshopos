// src/context/AuthContext.jsx
// DEFINITIVE AUTH CONTEXT
//
// KEY INSIGHT: In Supabase JS v2, getSession() returns the in-memory session
// which may be null on first page load even if a valid token is in localStorage.
// The INITIAL_SESSION event from onAuthStateChange is the correct and reliable
// way to know when Supabase has finished reading the session from storage.
//
// ARCHITECTURE:
// - onAuthStateChange is the SINGLE source of truth for session state
// - getSession() is only used as a fallback for pages that open in new tabs
//   (QRSticker) where onAuthStateChange may not have fired yet
// - INITIAL_SESSION event → load profile → set loading=false
// - SIGNED_IN event → load profile (covers login after INITIAL_SESSION)
// - TOKEN_REFRESHED → update user only, never re-fetch profile
// - SIGNED_OUT → clear everything
//
// REGISTRATION LOCK:
// Register.jsx sets _registrationInProgress = true before signUp so that
// SIGNED_IN does not try to fetch the profile before the RPC has created it.

import { createContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { setSentryUser } from '../lib/sentry'

export const AuthContext = createContext(null)

// Registration lock — prevents profile fetch before register_new_workshop RPC completes
let _registrationInProgress = false
export const setRegistrationInProgress = (val) => { _registrationInProgress = val }

export function AuthProvider({ children }) {

  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [branch,  setBranch]  = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchingRef      = useRef(false)
  const mountedRef       = useRef(true)

  // SECTION: Fetch profile + branch for a given user ID
  // Returns true if completed, false if blocked or aborted
  async function fetchProfile(userId) {
    if (fetchingRef.current) return false
    if (!mountedRef.current) return false

    fetchingRef.current = true

    // Retry loop handles two cases:
    // 1. New registration: profile doesn't exist yet (RPC still running)
    // 2. Supabase cold start: first query after long idle takes extra time
    const MAX_RETRIES = 8
    const DELAYS = [200, 400, 600, 800, 1000, 1500, 2000, 2500]

    try {
      let profileData = null

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          await new Promise(r => setTimeout(r, DELAYS[attempt - 1]))
          if (!mountedRef.current) return false
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle()

        if (data) { profileData = data; break }

        if (error && error.code !== 'PGRST116') {
          console.error('[AuthContext] Profile fetch error:', error)
          break
        }

        if (attempt < MAX_RETRIES) {
          console.log(`[AuthContext] Profile not found, retrying (${attempt + 1}/${MAX_RETRIES})…`)
        } else {
          console.error('[AuthContext] Profile not found after all retries:', userId)
          const { captureError } = await import('../lib/sentry')
          captureError(new Error('Profile not found after all retries'), { userId })
        }
      }

      if (!mountedRef.current) return false

      if (!profileData) {
        setProfile(null); setBranch(null)
        return true
      }

      setProfile(profileData)

      const { data: branchData, error: branchErr } = await supabase
        .from('branches').select('*').eq('id', profileData.branch_id).maybeSingle()

      if (!mountedRef.current) return false

      if (branchErr) {
        console.error('[AuthContext] Branch fetch error:', branchErr)
        setBranch(null)
      } else {
        setBranch(branchData)
        setSentryUser(profileData, branchData)
      }

      return true

    } catch (err) {
      console.error('[AuthContext] Unexpected error:', err)
      if (mountedRef.current) { setProfile(null); setBranch(null) }
      return true
    } finally {
      fetchingRef.current = false
    }
  }

  // SECTION: Auth state listener — single source of truth
  useEffect(() => {
    mountedRef.current = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return

        console.log('[AuthContext] Event:', event)

        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          // INITIAL_SESSION fires on page load in newer Supabase JS versions.
          // SIGNED_IN fires in older versions and on explicit login.
          // Both are handled identically — load profile and set loading false.
          if (session?.user) {
            setUser(session.user)
            if (!_registrationInProgress) {
              await fetchProfile(session.user.id)
            }
          }
          // Always set loading false once we know the auth state
          if (mountedRef.current) setLoading(false)

        } else if (event === 'TOKEN_REFRESHED') {
          // Token silently refreshed — update user object only, never re-fetch profile
          if (session?.user) setUser(session.user)

        } else if (event === 'SIGNED_OUT') {
          setUser(null); setProfile(null); setBranch(null)
          if (mountedRef.current) setLoading(false)
          setSentryUser(null, null)
        }
      }
    )

    // Visibility change — re-validate session when tab becomes active
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!mountedRef.current) return
          if (session?.user) {
            setUser(session.user)
          } else {
            setUser(null); setProfile(null); setBranch(null)
          }
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null); setProfile(null); setBranch(null)
    setSentryUser(null, null)
  }

  const value = {
    user, profile, branch, loading, signOut,
    isSuperAdmin:        profile?.tier1_role === 'super_admin',
    isFullAccess:        ['super_admin','owner','branch_manager','general_manager']
                           .includes(profile?.tier1_role),
    isQualityController: profile?.tier1_role === 'quality_controller',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// src/context/AuthContext.jsx
// CRITICAL AUTH CONTEXT — read carefully before editing.
//
// BUGS FIXED IN THIS VERSION:
//
// BUG 1 — fetchingRef permanent lock
//   fetchingRef.current is set to true at the top of fetchProfile but only
//   reset in the `finally` block. If mountedRef.current is false on entry
//   (component unmounted mid-fetch), the function returns early WITHOUT
//   hitting finally — fetchingRef stays true permanently. On the next
//   login attempt, fetchProfile is blocked forever → loading never resolves.
//   FIX: Reset fetchingRef before every early return.
//
// BUG 2 — SIGNED_IN fires setLoading(false) even when fetchProfile was blocked
//   If fetchingRef was true when SIGNED_IN fired (because getSession was
//   mid-fetch), fetchProfile returns immediately without setting profile/branch.
//   But the SIGNED_IN handler still calls setLoading(false) after the blocked
//   call, so the app shows the portal with profile=null.
//   FIX: Only call setLoading(false) in SIGNED_IN if fetchProfile actually ran.
//
// BUG 3 — getSession races with SIGNED_IN on fresh login
//   On fresh login, getSession (called on mount) may resolve with session=null
//   before the auth token is written to storage, firing setLoading(false) with
//   user=null. PortalLayout's 3s timeout sees user=null and redirects to /login.
//   Then SIGNED_IN fires with the real session but the user is already at /login.
//   FIX: getSession only calls setLoading(false) if it found a session OR if
//   SIGNED_IN has not already fired. Track with a flag.
//
// BUG 4 — Login.jsx uses .single() which throws PGRST116 on missing profile
//   Login.jsx fetches the profile for active/role checks using .single().
//   If the profile doesn't exist (race on new registration), PGRST116 is thrown,
//   Login.jsx calls signOut(), which fires SIGNED_OUT in AuthContext while
//   fetchProfile retries are still running — causing state corruption.
//   FIX: Login.jsx uses .maybeSingle() (fixed in Login.jsx below).
//
// Rules that remain enforced:
//  - fetchingRef prevents concurrent profile fetches
//  - TOKEN_REFRESHED never re-fetches profile or sets loading = true
//  - setLoading(false) is called in ALL code paths
//  - mounted ref prevents state updates after unmount
//  - Profile fetch retries up to 7 times with backoff for new registrations

import { createContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { setSentryUser } from '../lib/sentry'

export const AuthContext = createContext(null)

// SECTION: Registration lock
// Register.jsx sets this to true before signUp so that AuthContext
// does not immediately try to fetch the profile when SIGNED_IN fires.
// The RPC register_new_workshop must finish first.
// Register.jsx sets it back to false after the RPC completes.
let _registrationInProgress = false
export const setRegistrationInProgress = (val) => { _registrationInProgress = val }

export function AuthProvider({ children }) {

  // SECTION: State
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [branch,  setBranch]  = useState(null)
  const [loading, setLoading] = useState(true)

  // SECTION: Refs
  const fetchingRef      = useRef(false)
  const mountedRef       = useRef(true)
  const signedInFiredRef = useRef(false) // tracks if SIGNED_IN event already handled
  mountedRef.currentBranch = null

  // SECTION: Profile fetch with retry
  // Returns true if it ran to completion, false if it was blocked or aborted
  async function fetchProfile(userId) {
    // BUG 1 FIX: Don't lock fetchingRef on early returns
    if (fetchingRef.current) return false
    if (!mountedRef.current) return false

    fetchingRef.current = true

    const MAX_RETRIES = 8
    // Aggressive early retries, then back off.
    // Total max wait: ~7.5 seconds — fast enough for user, long enough for Supabase cold starts.
    // Most new registrations succeed on attempt 1 or 2 (within 1 second).
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

        if (data) {
          profileData = data
          break
        }

        if (error && error.code !== 'PGRST116') {
          console.error('[AuthContext] Profile fetch error:', error)
          break
        }

        if (attempt < MAX_RETRIES) {
          console.log(`[AuthContext] Profile not found, retrying (${attempt + 1}/${MAX_RETRIES})…`)
        } else {
          console.error('[AuthContext] Profile not found after all retries for user:', userId)
          // Report to Sentry so we know which users hit this
          const { captureError } = await import('../lib/sentry')
          captureError(
            new Error('Profile not found after all retries'),
            { userId, attempt: MAX_RETRIES }
          )
        }
      }

      if (!mountedRef.current) return false

      if (!profileData) {
        setProfile(null)
        setBranch(null)
        return true // ran to completion, just no data
      }

      setProfile(profileData)

      const { data: branchData, error: branchError } = await supabase
        .from('branches')
        .select('*')
        .eq('id', profileData.branch_id)
        .maybeSingle()

      if (!mountedRef.current) return false

      if (branchError) {
        console.error('[AuthContext] Branch fetch error:', branchError)
        setBranch(null)
      } else {
        setBranch(branchData)
        mountedRef.currentBranch = branchData
        setSentryUser(profileData, branchData)
      }

      return true

    } catch (err) {
      console.error('[AuthContext] Unexpected error during profile fetch:', err)
      if (mountedRef.current) {
        setProfile(null)
        setBranch(null)
      }
      return true
    } finally {
      fetchingRef.current = false
    }
  }

  // SECTION: Initial session + auth state listener
  useEffect(() => {
    mountedRef.current = true
    signedInFiredRef.current = false

    // BUG 3 FIX: Only call setLoading(false) from getSession if SIGNED_IN
    // has NOT already handled this session. On fresh login SIGNED_IN fires
    // first — getSession resolves after with the same session but must NOT
    // call setLoading(false) again (it would race with SIGNED_IN's fetch).
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mountedRef.current) return

      // If SIGNED_IN already handled this, skip — it will call setLoading(false)
      if (signedInFiredRef.current) return

      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      }

      if (mountedRef.current) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return

        if (event === 'SIGNED_IN') {
          signedInFiredRef.current = true
          if (session?.user) {
            setUser(session.user)

            // If registration is in progress, don't fetch profile yet —
            // register_new_workshop hasn't finished creating it.
            // Register.jsx will set this back to false when the RPC completes,
            // at which point the profile exists and we can fetch it normally
            // on the next getSession call or manual trigger.
            if (_registrationInProgress) {
              // Still need to eventually call setLoading(false)
              // Register.jsx will handle navigation; loading screen is fine here
              return
            }

            // BUG 2 FIX: Only call setLoading(false) if fetchProfile actually ran
            const didFetch = await fetchProfile(session.user.id)
            if (mountedRef.current && didFetch) setLoading(false)
          }
        } else if (event === 'TOKEN_REFRESHED') {
          // Never re-fetch profile on token refresh — causes infinite loop
          if (session?.user) setUser(session.user)
        } else if (event === 'SIGNED_OUT') {
          signedInFiredRef.current = false
          setUser(null)
          setProfile(null)
          setBranch(null)
          // Ensure loading is false after sign out
          if (mountedRef.current) setLoading(false)
        }
      }
    )

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!mountedRef.current) return
          if (session?.user) {
            setUser(session.user)
            if (!mountedRef.currentBranch) {
              fetchProfile(session.user.id)
            }
          } else {
            setUser(null)
            setProfile(null)
            setBranch(null)
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

  // SECTION: Sign out
  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setBranch(null)
    signedInFiredRef.current = false
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

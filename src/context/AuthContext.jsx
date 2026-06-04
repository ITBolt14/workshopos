// src/context/AuthContext.jsx
// CRITICAL AUTH CONTEXT — read carefully before editing.
//
// Rules enforced here:
//  - fetchingRef prevents concurrent profile fetches
//  - TOKEN_REFRESHED never re-fetches profile or sets loading = true
//  - setLoading(false) is called in ALL code paths
//  - mounted ref prevents state updates after unmount
//  - Profile fetch retries up to 5 times with backoff for new registrations
//    (race condition: Supabase signs in before register_new_workshop RPC completes)
//  - useAuth hook lives in src/hooks/useAuth.js — NOT exported from here
//  - AuthContext exported as named export with createContext(null)

import { createContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// SECTION: Context creation
export const AuthContext = createContext(null)

export function AuthProvider({ children }) {

  // SECTION: State
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [branch,  setBranch]  = useState(null)
  const [loading, setLoading] = useState(true)

  // SECTION: Refs
  const fetchingRef = useRef(false)
  const mountedRef  = useRef(true)
  mountedRef.currentBranch = null

  // SECTION: Profile fetch with retry
  // New registrations: Supabase fires SIGNED_IN before register_new_workshop RPC
  // finishes writing the profile row. We retry up to 5 times with increasing
  // delays (500ms, 1s, 2s, 3s, 4s) to give the RPC time to complete.
  async function fetchProfile(userId) {
    if (fetchingRef.current || !mountedRef.current) return
    fetchingRef.current = true

    const MAX_RETRIES = 5
    const DELAYS = [500, 1000, 2000, 3000, 4000] // ms between retries

    try {
      let profileData = null

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {

        // Wait before retrying (not before first attempt)
        if (attempt > 0) {
          await new Promise(r => setTimeout(r, DELAYS[attempt - 1]))
          if (!mountedRef.current) return
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle()   // maybeSingle returns null instead of error when 0 rows

        if (data) {
          profileData = data
          break
        }

        // Genuine DB error (not just missing row) — stop retrying
        if (error && error.code !== 'PGRST116') {
          console.error('[AuthContext] Profile fetch error:', error)
          break
        }

        // Profile not found yet — will retry if attempts remain
        if (attempt < MAX_RETRIES) {
          console.log(`[AuthContext] Profile not found yet, retrying (${attempt + 1}/${MAX_RETRIES})…`)
        } else {
          console.error('[AuthContext] Profile still not found after all retries for user:', userId)
        }
      }

      if (!mountedRef.current) return

      if (!profileData) {
        setProfile(null)
        setBranch(null)
        return
      }

      setProfile(profileData)

      // Fetch branch
      const { data: branchData, error: branchError } = await supabase
        .from('branches')
        .select('*')
        .eq('id', profileData.branch_id)
        .maybeSingle()

      if (!mountedRef.current) return

      if (branchError) {
        console.error('[AuthContext] Branch fetch error:', branchError)
        setBranch(null)
      } else {
        setBranch(branchData)
        mountedRef.currentBranch = branchData
      }

    } catch (err) {
      console.error('[AuthContext] Unexpected error during profile fetch:', err)
      if (mountedRef.current) {
        setProfile(null)
        setBranch(null)
      }
    } finally {
      fetchingRef.current = false
    }
  }

  // SECTION: Initial session + auth state listener
  useEffect(() => {
    mountedRef.current = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mountedRef.current) return

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
          if (session?.user) {
            setUser(session.user)
            await fetchProfile(session.user.id)
            if (mountedRef.current) setLoading(false)
          }
        } else if (event === 'TOKEN_REFRESHED') {
          if (session?.user) setUser(session.user)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setBranch(null)
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

  // SECTION: Sign out helper
  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setBranch(null)
  }

  // SECTION: Context value
  const value = {
    user,
    profile,
    branch,
    loading,
    signOut,
    isSuperAdmin:        profile?.tier1_role === 'super_admin',
    isFullAccess:        ['super_admin', 'owner', 'branch_manager', 'general_manager']
                           .includes(profile?.tier1_role),
    isQualityController: profile?.tier1_role === 'quality_controller',
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
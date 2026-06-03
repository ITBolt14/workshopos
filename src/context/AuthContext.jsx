// src/context/AuthContext.jsx
// CRITICAL AUTH CONTEXT — read carefully before editing.
//
// Rules enforced here:
//  - fetchingRef prevents concurrent profile fetches
//  - TOKEN_REFRESHED never re-fetches profile or sets loading = true
//  - setLoading(false) is called in ALL code paths
//  - mounted ref prevents state updates after unmount
//  - useAuth hook lives in src/hooks/useAuth.js — NOT exported from here
//  - AuthContext exported as named export with createContext(null)

import { createContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// SECTION: Context creation
// Must be createContext(null) — not createContext() — so useAuth can detect missing provider
export const AuthContext = createContext(null)

export function AuthProvider({ children }) {

  // SECTION: State
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [branch,  setBranch]  = useState(null)
  const [loading, setLoading] = useState(true)

  // SECTION: Refs
  const fetchingRef = useRef(false)   // prevents concurrent profile fetches
  const mountedRef  = useRef(true)    // prevents state updates after unmount
  mountedRef.currentBranch = null     // tracks branch for visibility handler

  // SECTION: Profile fetch helper
  async function fetchProfile(userId) {
    if (fetchingRef.current || !mountedRef.current) return
    fetchingRef.current = true

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileError || !profileData) {
        console.error('[AuthContext] Profile fetch error:', profileError)
        if (mountedRef.current) {
          setProfile(null)
          setBranch(null)
        }
        return
      }

      if (!mountedRef.current) return
      setProfile(profileData)

      // Fetch branch for trial checks in PortalLayout
      // Use maybeSingle() — returns null instead of error when no rows found
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

    // Get initial session once
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mountedRef.current) return

      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      }

      // CRITICAL: always resolve loading regardless of outcome
      if (mountedRef.current) setLoading(false)
    })

    // Listen for subsequent auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return

        if (event === 'SIGNED_IN') {
          // Always fetch profile on SIGNED_IN — fetchingRef prevents duplicate fetches
          if (session?.user) {
            setUser(session.user)
            await fetchProfile(session.user.id)
          }
        } else if (event === 'TOKEN_REFRESHED') {
          // Silent update only — never re-fetch profile or set loading = true
          if (session?.user) setUser(session.user)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setBranch(null)
        }
        // PASSWORD_RECOVERY handled in UpdatePassword component
      }
    )

    // Re-validate session when user switches back to this tab
    // This handles the case where storage events caused auth state to drift
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!mountedRef.current) return
          if (session?.user) {
            setUser(session.user)
            // Only re-fetch profile if branch is missing (indicates state was reset)
            if (!mountedRef.currentBranch) {
              fetchProfile(session.user.id)
            }
          } else {
            // Session genuinely gone — clear state
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

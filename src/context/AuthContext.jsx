// src/context/AuthContext.jsx
import { createContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { setSentryUser } from '../lib/sentry'

export const AuthContext = createContext(null)

let _registrationInProgress = false
export const setRegistrationInProgress = (val) => { _registrationInProgress = val }

export function AuthProvider({ children }) {

  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [branch,  setBranch]  = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchingRef = useRef(false)
  const mountedRef  = useRef(true)
  const loadingDoneRef = useRef(false) // tracks if setLoading(false) was already called

  function doneLoading() {
    if (!loadingDoneRef.current && mountedRef.current) {
      loadingDoneRef.current = true
      console.log('[AuthContext] setLoading(false)')
      setLoading(false)
    }
  }

  async function fetchProfile(userId) {
    if (fetchingRef.current) {
      console.log('[AuthContext] fetchProfile blocked — already fetching')
      return false
    }
    if (!mountedRef.current) return false

    fetchingRef.current = true
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
          .from('profiles').select('*').eq('id', userId).maybeSingle()

        if (data) { profileData = data; break }

        if (error && error.code !== 'PGRST116') {
          console.error('[AuthContext] Profile fetch error:', error)
          break
        }

        console.log(`[AuthContext] Profile not found, retrying (${attempt + 1}/${MAX_RETRIES})…`)
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

  useEffect(() => {
    mountedRef.current = true
    loadingDoneRef.current = false

    // Safety net — force loading=false after 8s no matter what.
    // Prevents infinite loading screen if fetchProfile hangs on Supabase cold start.
    const safetyTimer = setTimeout(() => {
      console.warn('[AuthContext] Safety timeout fired — forcing loading=false')
      doneLoading()
    }, 8000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return
        console.log('[AuthContext] Event:', event, '| session:', !!session)

        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          if (session?.user) {
            setUser(session.user)
            // Set loading false immediately once we know the user is authenticated.
            // fetchProfile runs after so the UI shows without waiting for the DB call.
            // Profile/branch state updates reactively when fetchProfile completes.
            doneLoading()
            if (!_registrationInProgress) {
              fetchProfile(session.user.id) // intentionally not awaited
            }
          } else {
            // No session — user is not logged in
            doneLoading()
          }

        } else if (event === 'TOKEN_REFRESHED') {
          if (session?.user) setUser(session.user)

        } else if (event === 'SIGNED_OUT') {
          setUser(null); setProfile(null); setBranch(null)
          setSentryUser(null, null)
          doneLoading()
        }
      }
    )

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!mountedRef.current) return
          if (session?.user) setUser(session.user)
          else { setUser(null); setProfile(null); setBranch(null) }
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mountedRef.current = false
      clearTimeout(safetyTimer)
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null); setProfile(null); setBranch(null)
    setSentryUser(null, null)
    loadingDoneRef.current = false
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

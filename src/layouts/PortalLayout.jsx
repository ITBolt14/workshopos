// src/layouts/PortalLayout.jsx
// Guards all /main/* routes.
// Checks: auth resolved → user exists → profile active → trial status
// 3-second safety timeout prevents infinite white screen if auth hangs.

import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Wrench } from 'lucide-react'

// SECTION: Trial banner component
function TrialBanner({ branch }) {
  if (!branch || branch.subscription_status !== 'trial') return null

  const now        = new Date()
  const trialEnd   = new Date(branch.trial_ends_at)
  const diffMs     = trialEnd - now
  const daysLeft   = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (daysLeft < 0) return null // PortalLayout handles redirect for expired

  let bgClass   = 'bg-blue-600'
  let label     = `Free beta trial — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`

  if (daysLeft === 0) {
    bgClass = 'bg-red-600'
    label   = 'Beta trial expires today'
  } else if (daysLeft <= 4) {
    bgClass = 'bg-amber-500'
    label   = `Beta trial ending soon — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`
  }

  return (
    <div className={`${bgClass} text-white text-sm font-medium text-center py-2 px-4`}>
      {label} — Contact IT Legends to continue after your trial
    </div>
  )
}

// SECTION: Loading spinner
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center">
        <Wrench className="w-6 h-6 text-white" />
      </div>
      <div className="flex items-center gap-3">
        {/* NOTE: animate-spin — never animate-span */}
        <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-500 text-sm font-medium">Loading WorkshopOS…</span>
      </div>
    </div>
  )
}

// SECTION: Inactive account screen
function InactiveScreen({ signOut }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Wrench className="w-7 h-7 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 font-display mb-2">Account Inactive</h2>
        <p className="text-gray-500 mb-6 text-sm">
          Your account has been deactivated. Please contact your branch administrator.
        </p>
        <button onClick={signOut} className="btn-secondary w-full">Sign Out</button>
      </div>
    </div>
  )
}

// SECTION: Main PortalLayout guard
export default function PortalLayout({ children }) {
  const { user, profile, branch, loading, signOut, isSuperAdmin } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [timedOut, setTimedOut] = useState(false)

  // 3-second safety timeout — forces resolve if auth never completes
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  // Once auth resolves (or times out), apply guards
  const resolved = !loading || timedOut

  useEffect(() => {
    if (!resolved) return

    // Guard 1: no user → login
    if (!user) {
      navigate('/login', { replace: true, state: { from: location.pathname } })
      return
    }

    // Guard 2: profile loaded and inactive
    if (profile && !profile.active) return // handled by InactiveScreen below

    // Guard 3: trial expired (super admin bypasses)
    if (branch && !isSuperAdmin) {
      const isExpired =
        branch.subscription_status === 'suspended' ||
        branch.subscription_status === 'cancelled' ||
        (branch.subscription_status === 'trial' && new Date(branch.trial_ends_at) < new Date())

      if (isExpired) {
        navigate('/trial-expired', { replace: true })
      }
    }
  }, [resolved, user, profile, branch, isSuperAdmin, navigate, location.pathname])

  // SECTION: Render states
  if (!resolved) return <LoadingScreen />

  if (!user) return <LoadingScreen /> // brief flash while redirect fires

  if (profile && !profile.active) return <InactiveScreen signOut={signOut} />

  // SECTION: Render with optional trial banner
  return (
    <div className="flex flex-col min-h-screen">
      {/* Trial banner shown at top of every protected page */}
      {!isSuperAdmin && <TrialBanner branch={branch} />}
      {children}
    </div>
  )
}

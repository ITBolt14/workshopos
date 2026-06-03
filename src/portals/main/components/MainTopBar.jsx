// src/portals/main/components/MainTopBar.jsx
// Top navigation bar — branch name, user info, notifications bell.

import NotificationsBell from './NotificationsBell'
import { useState, useEffect } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { supabase } from '../../../lib/supabase'

// SECTION: Role label formatter
function formatRole(role) {
  if (!role) return ''
  return role
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// SECTION: User avatar initials
function Avatar({ name }) {
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : '?'
  return (
    <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center
                    flex-shrink-0">
      <span className="text-white text-xs font-bold font-display">{initials}</span>
    </div>
  )
}

// SECTION: MainTopBar
export default function MainTopBar() {
  const { profile, branch: authBranch } = useAuth()
  const [branch, setBranch] = useState(null)

  // Re-fetch branch on every render cycle so name/code changes appear immediately
  useEffect(() => {
    const id = authBranch?.id || profile?.branch_id
    if (!id) { setBranch(authBranch); return }
    supabase.from('branches').select('name, city, subscription_status')
      .eq('id', id).maybeSingle()
      .then(({ data }) => setBranch(data || authBranch))
  }, [authBranch?.id, profile?.branch_id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center
                       justify-between px-6 flex-shrink-0 gap-4">

      {/* SECTION: Branch name */}
      <div className="flex items-center gap-3 min-w-0">
        <div>
          <h2 className="font-display font-bold text-gray-900 text-sm leading-tight truncate">
            {branch?.name || 'Loading…'}
          </h2>
          {branch?.city && (
            <p className="text-gray-400 text-xs">{branch.city}</p>
          )}
        </div>
        {branch?.subscription_status === 'trial' && (
          <span className="bg-blue-100 text-blue-700 text-xs font-semibold
                           px-2 py-0.5 rounded-full flex-shrink-0">
            Trial
          </span>
        )}
      </div>

      {/* SECTION: Right side — notifications + user */}
      <div className="flex items-center gap-3 flex-shrink-0">

        {/* Live notifications bell */}
        <NotificationsBell />

        {/* User info */}
        <div className="flex items-center gap-2.5">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-gray-900 leading-tight">
              {profile?.full_name || '…'}
            </p>
            <p className="text-xs text-gray-400">
              {formatRole(profile?.tier1_role)}
            </p>
          </div>
          <Avatar name={profile?.full_name} />
        </div>

      </div>
    </header>
  )
}

// src/portals/main/components/NotificationsBell.jsx
// Role-based notifications with read/unread state persisted to DB.
// Notifications are generated from job data on each fetch.
// Read state is stored in the notifications table.

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, X, Car, Clock, Package, CheckCircle2, AlertTriangle, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'

// SECTION: Notification type config
const NOTIF_CONFIG = {
  overdue:              { icon: AlertTriangle, colour: 'text-red-500',    bg: 'bg-red-50',    label: 'Overdue'              },
  ready_for_collection: { icon: CheckCircle2,  colour: 'text-green-600',  bg: 'bg-green-50',  label: 'Ready for Collection' },
  awaiting_parts:       { icon: Package,       colour: 'text-orange-500', bg: 'bg-orange-50', label: 'Awaiting Parts'       },
  authorized:           { icon: Car,           colour: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Authorized'           },
  checked_in:           { icon: Car,           colour: 'text-blue-600',   bg: 'bg-blue-50',   label: 'Checked In'           },
}

function getNotifTypesForRole(role) {
  switch (role) {
    case 'super_admin':
    case 'owner':
    case 'branch_manager':
    case 'general_manager':
      return ['overdue', 'ready_for_collection', 'awaiting_parts', 'checked_in']
    case 'manager':
      return ['authorized', 'awaiting_parts', 'overdue']
    case 'reception':
      return ['ready_for_collection', 'checked_in']
    default:
      return []
  }
}

export default function NotificationsBell() {
  const { profile, branch } = useAuth()
  const navigate  = useNavigate()
  const branchId  = branch?.id || profile?.branch_id

  const [open,    setOpen]    = useState(false)
  const [notifs,  setNotifs]  = useState([])
  const [readIds, setReadIds] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef(null)

  const types = getNotifTypesForRole(profile?.tier1_role)

  // SECTION: Fetch notifications + read state from DB
  const fetchNotifs = useCallback(async () => {
    if (!branchId || !types.length || !profile?.id) return
    setLoading(true)

    const today = new Date().toISOString().split('T')[0]

    const statuses = []
    if (types.includes('overdue'))              statuses.push('checked_in','authorized','in_progress','quality_check','awaiting_parts')
    if (types.includes('ready_for_collection')) statuses.push('ready_for_collection')
    if (types.includes('awaiting_parts'))       statuses.push('awaiting_parts')
    if (types.includes('authorized'))           statuses.push('authorized')
    if (types.includes('checked_in'))           statuses.push('checked_in')

    const [jobsRes, readRes] = await Promise.all([
      supabase
        .from('jobs')
        .select('id, job_number, status, estimated_completion, check_in_date, vehicle_id')
        .eq('branch_id', branchId)
        .in('status', [...new Set(statuses)])
        .order('created_at', { ascending: false })
        .limit(50),

      supabase
        .from('notifications')
        .select('job_id, type')
        .eq('user_id', profile.id)
        .eq('read', true),
    ])

    // Build read set: "jobId-type"
    const newReadIds = new Set(
      (readRes.data || []).map(r => `${r.job_id}-${r.type}`)
    )
    setReadIds(newReadIds)

    const jobs = jobsRes.data || []
    if (!jobs.length) { setNotifs([]); setLoading(false); return }

    // Fetch vehicle registrations
    const vehicleIds = [...new Set(jobs.map(j => j.vehicle_id).filter(Boolean))]
    const vehicleMap = {}
    if (vehicleIds.length) {
      const { data: vehicles } = await supabase
        .from('vehicles').select('id, registration').in('id', vehicleIds)
      ;(vehicles || []).forEach(v => { vehicleMap[v.id] = v.registration })
    }

    const results = []

    jobs.forEach(job => {
      const reg = vehicleMap[job.vehicle_id] || job.job_number

      if (types.includes('overdue') &&
          job.estimated_completion &&
          job.estimated_completion < today &&
          !['ready_for_collection','released','collected'].includes(job.status)) {
        results.push({ id: `${job.id}-overdue`, jobId: job.id, type: 'overdue',
          message: `${reg} is past its due date`,
          sub: `Due: ${new Date(job.estimated_completion).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}`,
        })
      }
      if (types.includes('ready_for_collection') && job.status === 'ready_for_collection') {
        results.push({ id: `${job.id}-ready_for_collection`, jobId: job.id, type: 'ready_for_collection',
          message: `${reg} is ready for collection`, sub: job.job_number,
        })
      }
      if (types.includes('awaiting_parts') && job.status === 'awaiting_parts') {
        results.push({ id: `${job.id}-awaiting_parts`, jobId: job.id, type: 'awaiting_parts',
          message: `${reg} is waiting on parts`, sub: job.job_number,
        })
      }
      if (types.includes('authorized') && job.status === 'authorized') {
        results.push({ id: `${job.id}-authorized`, jobId: job.id, type: 'authorized',
          message: `${reg} is authorized and ready to start`, sub: job.job_number,
        })
      }
      if (types.includes('checked_in') && job.status === 'checked_in' && job.check_in_date === today) {
        results.push({ id: `${job.id}-checked_in`, jobId: job.id, type: 'checked_in',
          message: `${reg} checked in today`, sub: job.job_number,
        })
      }
    })

    const order = ['overdue','ready_for_collection','awaiting_parts','authorized','checked_in']
    results.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))

    setNotifs(results)
    setLoading(false)
  }, [branchId, profile?.id, types.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifs])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // SECTION: Mark one notification as read
  async function markRead(notif) {
    const key = `${notif.jobId}-${notif.type}`
    if (readIds.has(key)) return // already read

    setReadIds(prev => new Set([...prev, key]))

    // Upsert read record in notifications table
    await supabase.from('notifications').upsert({
      branch_id: branchId,
      user_id:   profile.id,
      job_id:    notif.jobId,
      type:      notif.type,
      message:   notif.message,
      sub:       notif.sub,
      read:      true,
    }, { onConflict: 'user_id,job_id,type', ignoreDuplicates: false })
  }

  // SECTION: Mark all as read
  async function markAllRead() {
    if (!unreadNotifs.length) return

    const newReadIds = new Set(readIds)
    const upserts = unreadNotifs.map(n => {
      newReadIds.add(`${n.jobId}-${n.type}`)
      return {
        branch_id: branchId,
        user_id:   profile.id,
        job_id:    n.jobId,
        type:      n.type,
        message:   n.message,
        sub:       n.sub,
        read:      true,
      }
    })

    setReadIds(newReadIds)
    await supabase.from('notifications').upsert(upserts, {
      onConflict: 'user_id,job_id,type',
      ignoreDuplicates: false,
    })
  }

  // SECTION: Handle click on notification
  async function handleNotifClick(notif) {
    await markRead(notif)
    navigate(`/main/jobs/${notif.jobId}`)
    setOpen(false)
  }

  if (!types.length) return null

  const unreadNotifs = notifs.filter(n => !readIds.has(`${n.jobId}-${n.type}`))
  const unreadCount  = unreadNotifs.length

  return (
    <div className="relative" ref={dropdownRef}>

      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifs() }}
        className="w-9 h-9 flex items-center justify-center rounded-xl
                   text-gray-400 hover:bg-gray-100 hover:text-gray-600
                   transition-all duration-150 relative"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full
                           flex items-center justify-center">
            <span className="text-white text-[9px] font-bold leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200
                        rounded-2xl shadow-xl z-50 animate-scale-in overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 bg-red-100 text-red-700 text-xs font-bold
                                 px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-brand-600
                             hover:text-brand-700 font-medium transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Read all
                </button>
              )}
              <button onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : notifs.length === 0 ? (
              <div className="p-6 text-center">
                <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No notifications</p>
                <p className="text-gray-400 text-xs mt-1">You're all caught up!</p>
              </div>
            ) : (
              notifs.map(notif => {
                const cfg    = NOTIF_CONFIG[notif.type]
                const Icon   = cfg.icon
                const isRead = readIds.has(`${notif.jobId}-${notif.type}`)

                return (
                  <button
                    key={notif.id}
                    onClick={() => handleNotifClick(notif)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3
                                hover:bg-gray-50 transition-colors duration-100
                                border-b border-gray-50 last:border-0
                                ${isRead ? 'opacity-50' : ''}`}
                  >
                    {/* Unread dot */}
                    <div className="flex-shrink-0 mt-2">
                      {!isRead && (
                        <span className="w-2 h-2 bg-brand-500 rounded-full block" />
                      )}
                      {isRead && (
                        <span className="w-2 h-2 rounded-full block" />
                      )}
                    </div>

                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                                     flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                      <Icon className={`w-4 h-4 ${cfg.colour}`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className={`text-sm leading-tight truncate
                                     ${isRead ? 'text-gray-500' : 'text-gray-800 font-medium'}`}>
                        {notif.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{notif.sub}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => { navigate('/main/jobs'); setOpen(false) }}
                className="text-brand-600 text-xs font-medium hover:text-brand-700
                           transition-colors duration-150"
              >
                View all jobs →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

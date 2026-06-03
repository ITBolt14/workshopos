// src/portals/main/pages/jobs/detail/TabAudit.jsx
// Human-readable audit log for a job.
// Formats each entry into plain English that any staff member can understand.

import { useState, useEffect } from 'react'
import { supabase } from '../../../../../lib/supabase'
import {
  LogIn, Clock, CheckCheck, Edit2, FileText,
  AlertCircle, User, SkipForward, Play, Wrench
} from 'lucide-react'

// SECTION: Action → human readable config
// Maps raw action strings to icons, colours and formatted labels
function parseAuditEntry(log) {
  const action = log.action?.toLowerCase() || ''
  const user   = log.userName || 'System'
  const time   = new Date(log.created_at).toLocaleString('en-ZA', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit'
  })
  const portal = log.portal === 'workshop' ? 'Workshop Portal' : 'Main Portal'

  // Job created
  if (action.includes('checked in') || action.includes('job created')) {
    return {
      icon:    LogIn,
      colour:  'text-brand-500',
      bg:      'bg-brand-50',
      border:  'border-brand-200',
      heading: `Job checked in`,
      detail:  `${user} created this job via ${portal}`,
      time,
    }
  }

  // Status changes
  if (action.includes('status changed')) {
    const match = log.action.match(/status changed to (.+)/i)
    const newStatus = match ? formatStatus(match[1]) : log.new_value?.status
    const oldStatus = log.old_value?.status ? formatStatus(log.old_value.status) : null
    return {
      icon:    AlertCircle,
      colour:  'text-amber-500',
      bg:      'bg-amber-50',
      border:  'border-amber-200',
      heading: `Status changed to ${newStatus}`,
      detail:  `${user} changed status${oldStatus ? ` from ${oldStatus}` : ''} via ${portal}`,
      time,
    }
  }

  // Stage activated
  if (action.includes('stage') && action.includes('activat')) {
    const stageName = extractStageName(log.action)
    return {
      icon:    Play,
      colour:  'text-blue-500',
      bg:      'bg-blue-50',
      border:  'border-blue-200',
      heading: `Stage activated${stageName ? `: ${stageName}` : ''}`,
      detail:  `${user} started this stage via ${portal}`,
      time,
    }
  }

  // Stage completed / marked complete
  if (action.includes('stage') && (action.includes('complet') || action.includes('mark'))) {
    const stageName = extractStageName(log.action)
    return {
      icon:    CheckCheck,
      colour:  'text-green-600',
      bg:      'bg-green-50',
      border:  'border-green-200',
      heading: `Stage completed${stageName ? `: ${stageName}` : ''}`,
      detail:  `${user} marked this stage complete via ${portal}`,
      time,
    }
  }

  // Stage skipped
  if (action.includes('skip')) {
    const stageName = extractStageName(log.action)
    return {
      icon:    SkipForward,
      colour:  'text-gray-500',
      bg:      'bg-gray-50',
      border:  'border-gray-200',
      heading: `Stage skipped${stageName ? `: ${stageName}` : ''}`,
      detail:  `${user} skipped this stage via ${portal}`,
      time,
    }
  }

  // QC sign-off
  if (action.includes('qc') || action.includes('sign') || action.includes('quality')) {
    const stageName = extractStageName(log.action)
    return {
      icon:    CheckCheck,
      colour:  'text-purple-600',
      bg:      'bg-purple-50',
      border:  'border-purple-200',
      heading: `Quality check signed off${stageName ? `: ${stageName}` : ''}`,
      detail:  `${user} signed off this quality check via ${portal}`,
      time,
    }
  }

  // Workshop clock on
  if (action.includes('clocked on') || action.includes('clock on')) {
    const stageName = extractStageName(log.action)
    return {
      icon:    Wrench,
      colour:  'text-indigo-500',
      bg:      'bg-indigo-50',
      border:  'border-indigo-200',
      heading: `Technician clocked on${stageName ? ` — ${stageName}` : ''}`,
      detail:  `${user} clocked on via Workshop Portal`,
      time,
    }
  }

  // Job edited / updated
  if (action.includes('edit') || action.includes('update') || action.includes('saved') || action.includes('changed')) {
    return {
      icon:    Edit2,
      colour:  'text-gray-500',
      bg:      'bg-gray-50',
      border:  'border-gray-200',
      heading: 'Job details updated',
      detail:  `${user} edited job details via ${portal}`,
      time,
    }
  }

  // Note added
  if (action.includes('note')) {
    return {
      icon:    FileText,
      colour:  'text-teal-500',
      bg:      'bg-teal-50',
      border:  'border-teal-200',
      heading: 'Internal note added',
      detail:  `${user} added a note via ${portal}`,
      time,
    }
  }

  // Fallback — show the raw action in a readable way
  return {
    icon:    Clock,
    colour:  'text-gray-400',
    bg:      'bg-gray-50',
    border:  'border-gray-200',
    heading: capitalise(log.action || 'Action recorded'),
    detail:  `${user} · ${portal}`,
    time,
  }
}

function formatStatus(s) {
  return s?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || s
}

function extractStageName(action) {
  // Try to extract stage name from action strings like "QC signed off: Final Quality Check"
  const colonMatch = action?.match(/:\s*(.+)$/i)
  if (colonMatch) return colonMatch[1].trim()
  return null
}

function capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// SECTION: Main TabAudit component
export default function TabAudit({ jobId }) {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLogs() {
      const { data } = await supabase
        .from('audit_log')
        .select('id, action, portal, created_at, user_id, table_name, old_value, new_value')
        .eq('record_id', jobId)
        .order('created_at', { ascending: false })

      if (!data?.length) { setLogs([]); setLoading(false); return }

      // Fetch user names
      const userIds = [...new Set(data.map(l => l.user_id).filter(Boolean))]
      const userMap = {}
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .rpc('lookup_technician_names', { p_ids: userIds })
        ;(users || []).forEach(u => { userMap[u.id] = u.full_name })
      }

      setLogs(data.map(l => ({ ...l, userName: userMap[l.user_id] || 'System' })))
      setLoading(false)
    }
    fetchLogs()
  }, [jobId])

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!logs.length) {
    return (
      <div className="card text-center py-10">
        <Clock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-400 font-medium">No activity recorded yet</p>
        <p className="text-gray-400 text-sm mt-1">
          Actions taken on this job will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2 animate-fade-in">
      <p className="text-sm text-gray-400 mb-4">
        {logs.length} event{logs.length !== 1 ? 's' : ''} recorded
      </p>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-5 bottom-0 w-px bg-gray-100" />

        <div className="space-y-3">
          {logs.map(log => {
            const entry = parseAuditEntry(log)
            const Icon  = entry.icon

            return (
              <div key={log.id} className="flex items-start gap-4 animate-fade-in">

                {/* Icon circle */}
                <div className={`w-10 h-10 rounded-full border-2 flex items-center
                                 justify-center flex-shrink-0 bg-white z-10
                                 ${entry.border}`}>
                  <Icon className={`w-4 h-4 ${entry.colour}`} />
                </div>

                {/* Content */}
                <div className={`flex-1 rounded-xl border p-3.5 ${entry.bg} ${entry.border}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className={`font-semibold text-sm ${entry.colour}`}>
                      {entry.heading}
                    </p>
                    <span className="text-xs text-gray-400 flex-shrink-0 text-right">
                      {entry.time}
                    </span>
                  </div>
                  <p className="text-gray-600 text-xs mt-0.5">{entry.detail}</p>
                </div>

              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

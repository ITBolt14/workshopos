// src/portals/workshop/pages/JobView.jsx
// Read-only job view for Tier 1 users who scan a QR code or search.
// Sticky header shows vehicle details + back/sign-out buttons while scrolling.
// Shows stage history with clocking times + add note functionality.

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CheckCheck, Clock, User,
  Send, LogOut, Lock, Zap, CheckCircle2
} from 'lucide-react'
import { supabaseWorkshop as supabase } from '../../../lib/supabaseWorkshop'
import { getWorkshopUser, clearWorkshopUser } from '../WorkshopPortal'

// SECTION: Helpers
function formatDuration(mins) {
  if (!mins && mins !== 0) return null
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatTime(ts) {
  if (!ts) return null
  return new Date(ts).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(ts) {
  if (!ts) return null
  return new Date(ts).toLocaleString('en-ZA', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit'
  })
}

// SECTION: Live elapsed timer
function ElapsedTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState('')
  useEffect(() => {
    function update() {
      const diff = Math.floor((Date.now() - new Date(startedAt)) / 1000)
      const h = Math.floor(diff / 3600)
      const m = Math.floor((diff % 3600) / 60)
      const s = diff % 60
      if (h > 0) setElapsed(`${h}h ${m}m`)
      else if (m > 0) setElapsed(`${m}m ${s}s`)
      else setElapsed(`${s}s`)
    }
    update()
    const i = setInterval(update, 1000)
    return () => clearInterval(i)
  }, [startedAt])
  return <span>{elapsed}</span>
}

export default function JobView() {
  const { jobId }  = useParams()
  const navigate   = useNavigate()
  const user       = getWorkshopUser()

  const [job,       setJob]       = useState(null)
  const [stages,    setStages]    = useState([])
  const [clocking,  setClocking]  = useState([])
  const [notes,     setNotes]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [note,      setNote]      = useState('')
  const [saving,    setSaving]    = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)

  // SECTION: Fetch all job data
  const fetchData = useCallback(async () => {
    const [jobRes, stagesRes, clockingRes, notesRes] = await Promise.all([
      supabase.rpc('get_workshop_job', { p_job_id: jobId }),
      supabase.from('job_stages').select('*').eq('job_id', jobId).order('sort_order'),
      supabase.from('workshop_clocking')
        .select('id, job_stage_id, technician_id, clocked_on_at, clocked_off_at, duration_minutes, auto_clocked_off')
        .eq('job_id', jobId)
        .order('clocked_on_at', { ascending: true }),
      supabase.from('job_notes')
        .select('id, note, created_by, created_at')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false }),
    ])

    if (!jobRes.data?.length) { navigate('/workshop/home', { replace: true }); return }

    const jobRow = jobRes.data[0]
    setJob({
      id:         jobRow.id,
      job_number: jobRow.job_number,
      status:     jobRow.status,
      branch_id:  jobRow.branch_id,
      vehicles: {
        registration: jobRow.registration,
        make:         jobRow.make,
        model:        jobRow.model,
        year:         jobRow.year,
        colour:       jobRow.colour,
        owner_name:   jobRow.owner_name,
      }
    })

    // Fetch names for all technicians and note authors
    const techIds       = [...new Set((clockingRes.data || []).map(s => s.technician_id))]
    const noteAuthorIds = [...new Set((notesRes.data || []).map(n => n.created_by).filter(Boolean))]
    const allIds        = [...new Set([...techIds, ...noteAuthorIds])]
    const techMap       = {}

    if (allIds.length > 0) {
      const { data: techs } = await supabase
        .rpc('lookup_technician_names', { p_ids: allIds })
      ;(techs || []).forEach(t => { techMap[t.id] = t.full_name })
    }

    setStages(stagesRes.data || [])
    setClocking((clockingRes.data || []).map(s => ({
      ...s, techName: techMap[s.technician_id] || 'Technician'
    })))
    setNotes((notesRes.data || []).map(n => ({
      ...n, authorName: techMap[n.created_by] || 'Staff'
    })))
    setLoading(false)
  }, [jobId, navigate])

  useEffect(() => { fetchData() }, [fetchData])

  // SECTION: Save note
  async function handleSaveNote() {
    if (!note.trim() || saving) return
    setSaving(true)
    const { error } = await supabase.from('job_notes').insert({
      job_id:     jobId,
      branch_id:  job.branch_id,
      note:       note.trim(),
      created_by: user.id,
    })
    setSaving(false)
    if (error) { console.error('Note save error:', error); return }
    setNote('')
    setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 3000)
    fetchData()
  }

  // SECTION: Sign out
  function handleSignOut() {
    clearWorkshopUser()
    navigate('/workshop/login', { replace: true })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const vehicle         = job?.vehicles
  const nonSystemStages = stages.filter(s => !s.system_stage)
  const completedStages = nonSystemStages.filter(s => s.status === 'complete' || s.status === 'skipped').length

  // SECTION: Render
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* SECTION: Sticky header — stays visible while scrolling */}
      <div className="sticky top-0 z-30 bg-gray-900 border-b border-gray-800 flex-shrink-0">

        {/* Top bar: back + job info + sign out */}
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/workshop/home')}
              className="w-10 h-10 flex items-center justify-center rounded-xl
                         bg-gray-800 border border-gray-700 text-gray-400
                         hover:text-white transition-all duration-150 flex-shrink-0
                         active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="font-mono font-bold text-brand-400 text-lg leading-tight">
                {job?.job_number}
              </p>
              <p className="text-gray-500 text-xs truncate">
                {vehicle?.make} {vehicle?.model}
                {vehicle?.colour ? ` · ${vehicle.colour}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-white text-sm font-medium leading-tight">{user?.full_name}</p>
              <p className="text-gray-500 text-xs capitalize">
                {user?.tier1_role?.replace(/_/g, ' ')}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-10 h-10 flex items-center justify-center rounded-xl
                         bg-gray-800 border border-gray-700 text-gray-400
                         hover:text-red-400 transition-all duration-150 active:scale-95"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Vehicle identity strip — sticky, always visible */}
        <div className="px-4 pb-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gray-800 rounded-xl px-3 py-1.5">
              <p className="font-mono text-white font-black text-xl tracking-wider">
                {vehicle?.registration}
              </p>
            </div>
            {vehicle?.owner_name && (
              <p className="text-gray-400 text-sm truncate">{vehicle.owner_name}</p>
            )}
          </div>
          {/* Progress pill */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right">
              <p className="text-white text-sm font-bold leading-tight">
                {completedStages}
                <span className="text-gray-600">/{nonSystemStages.length}</span>
              </p>
              <p className="text-gray-600 text-xs">stages</p>
            </div>
            <div className="w-16 h-1.5 bg-gray-800 rounded-full">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-500"
                style={{ width: `${nonSystemStages.length > 0 ? (completedStages / nonSystemStages.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

      </div>

      {/* SECTION: Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 pb-8">

        {/* SECTION: Stage history */}
        <div>
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">
            Stage Progress
          </p>
          <div className="space-y-2">
            {stages.map(stage => {
              const stageSessions = clocking.filter(s => s.job_stage_id === stage.id)
              const activeSession = stageSessions.find(s => !s.clocked_off_at)
              const isComplete    = stage.status === 'complete'
              const isActive      = stage.status === 'active'
              const isSkipped     = stage.status === 'skipped'

              return (
                <div key={stage.id}
                  className={`rounded-2xl p-4 border ${
                    isComplete    ? 'bg-green-950/40 border-green-900/60' :
                    isActive      ? 'bg-blue-950/40 border-blue-900/60 ring-1 ring-blue-700/40' :
                    isSkipped     ? 'bg-gray-900/30 border-gray-800 opacity-50' :
                    stage.system_stage ? 'bg-gray-900/20 border-gray-800/40' :
                    'bg-gray-900/60 border-gray-800'
                  }`}>

                  {/* Stage header row */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs text-gray-600 w-4 flex-shrink-0">
                        {stage.sort_order}
                      </span>
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: `#${stage.colour || '6366f1'}` }}
                      />
                      <p className={`font-semibold text-sm truncate ${
                        isComplete    ? 'text-green-300' :
                        isActive      ? 'text-blue-300'  :
                        isSkipped     ? 'text-gray-500 line-through' :
                        stage.system_stage ? 'text-gray-600' :
                        'text-gray-300'
                      }`}>
                        {stage.name}
                      </p>
                      {stage.system_stage && <Lock className="w-3 h-3 text-gray-700 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isComplete && <CheckCheck className="w-4 h-4 text-green-500" />}
                      {isActive && (
                        <span className="flex items-center gap-1 text-blue-400 text-xs font-medium">
                          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                          Active
                        </span>
                      )}
                      {stage.duration_minutes != null && (
                        <span className="text-gray-500 text-xs">
                          {formatDuration(stage.duration_minutes)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stage timestamps */}
                  {(stage.started_at || stage.completed_at) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5
                                    text-xs text-gray-500 ml-6 mb-1">
                      {stage.started_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Started {formatDateTime(stage.started_at)}
                        </span>
                      )}
                      {stage.completed_at && (
                        <span>→ Done {formatTime(stage.completed_at)}</span>
                      )}
                    </div>
                  )}

                  {/* Active session — live timer */}
                  {isActive && activeSession && (
                    <div className="ml-6 flex items-center gap-2 mt-1">
                      <Zap className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                      <span className="text-blue-300 text-sm font-medium">
                        {activeSession.techName}
                      </span>
                      <span className="text-blue-600 text-xs">·</span>
                      <span className="text-blue-500 text-xs font-mono">
                        <ElapsedTimer startedAt={activeSession.clocked_on_at} />
                      </span>
                    </div>
                  )}

                  {/* Clocking history for completed sessions */}
                  {stageSessions.filter(s => s.clocked_off_at).map(s => (
                    <div key={s.id}
                      className="flex items-center gap-2 text-xs text-gray-500 ml-6 mt-1">
                      <User className="w-3 h-3 text-gray-600 flex-shrink-0" />
                      <span className="font-medium text-gray-400">{s.techName}</span>
                      <span className="text-gray-600">
                        {formatTime(s.clocked_on_at)}
                        {s.clocked_off_at && ` → ${formatTime(s.clocked_off_at)}`}
                      </span>
                      {s.duration_minutes != null && (
                        <span className="text-gray-600">
                          ({formatDuration(s.duration_minutes)})
                        </span>
                      )}
                      {s.auto_clocked_off && (
                        <span className="text-gray-700 italic">auto</span>
                      )}
                    </div>
                  ))}

                </div>
              )
            })}
          </div>
        </div>

        {/* SECTION: Add internal note */}
        <div>
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">
            Add Internal Note
          </p>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-3">
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note visible to all staff in the main portal…"
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5
                         text-white text-sm placeholder:text-gray-600
                         focus:outline-none focus:ring-2 focus:ring-brand-500
                         focus:border-transparent resize-none transition-all duration-200"
            />
            <button
              onClick={handleSaveNote}
              disabled={!note.trim() || saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                         bg-brand-600 hover:bg-brand-700 active:bg-brand-800
                         text-white font-semibold text-sm
                         transition-all duration-150 active:scale-98
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent
                                rounded-full animate-spin" />
              ) : noteSaved ? (
                <><CheckCircle2 className="w-4 h-4" /> Note saved!</>
              ) : (
                <><Send className="w-4 h-4" /> Save Note</>
              )}
            </button>
          </div>
        </div>

        {/* SECTION: Previous notes */}
        {notes.length > 0 && (
          <div>
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">
              Previous Notes ({notes.length})
            </p>
            <div className="space-y-2">
              {notes.map(n => (
                <div key={n.id}
                  className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300 text-sm font-semibold">
                      {n.authorName}
                    </span>
                    <span className="text-gray-600 text-xs">
                      {formatDateTime(n.created_at)}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">{n.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

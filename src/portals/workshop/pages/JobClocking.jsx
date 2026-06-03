// src/portals/workshop/pages/JobClocking.jsx
// Job stage clocking screen for workshop technicians.
// Shows all stages for a job — technician can only clock onto stages
// matching their department. DB trigger handles auto-clock-off of previous stage.
// Shows 4-second success screen after clock-on, then returns to PIN login.

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, Lock, Clock, User,
  ChevronRight, Zap, CheckCheck
} from 'lucide-react'
import { supabaseWorkshop as supabase } from '../../../lib/supabaseWorkshop'
import { getWorkshopUser, clearWorkshopUser } from '../WorkshopPortal'

// SECTION: Department group → allowed stage department_groups
const DEPT_ACCESS = {
  panel:    ['panel'],
  paint:    ['paint'],
  quality:  ['quality'],
  mechanical: ['mechanical'],
  general:  ['general'],
  // Quality controllers also have access via tier1_role check
}

// SECTION: Stage status badge
function StageBadge({ status }) {
  const config = {
    pending:  { label: 'Pending',  classes: 'bg-gray-800 text-gray-400 border-gray-700' },
    active:   { label: 'Active',   classes: 'bg-blue-900/60 text-blue-300 border-blue-700' },
    complete: { label: 'Complete', classes: 'bg-green-900/60 text-green-300 border-green-700' },
    skipped:  { label: 'Skipped',  classes: 'bg-gray-800 text-gray-500 border-gray-700' },
  }
  const c = config[status] || config.pending
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${c.classes}`}>
      {c.label}
    </span>
  )
}

// SECTION: Duration formatter
function formatDuration(minutes) {
  if (!minutes) return null
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// SECTION: Elapsed time display (live counter)
function ElapsedTime({ startedAt }) {
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
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  return <span>{elapsed}</span>
}

// SECTION: Success screen shown after clock-on
function SuccessScreen({ techName, stageName, jobNumber, registration, clockedOnAt, onReturn }) {
  useEffect(() => {
    const timer = setTimeout(onReturn, 4000)
    return () => clearTimeout(timer)
  }, [onReturn])

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6
                    animate-fade-in">
      {/* Big green checkmark */}
      <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center
                      mb-6 ring-4 ring-green-500/30 animate-scale-in">
        <CheckCircle2 className="w-12 h-12 text-green-400" />
      </div>

      <h1 className="font-display text-white text-3xl font-bold mb-1">Clocked On!</h1>

      <p className="text-green-400 font-bold text-xl mb-6">{techName}</p>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm
                      space-y-3 mb-8">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Stage</span>
          <span className="text-white font-semibold">{stageName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Job</span>
          <span className="text-brand-400 font-mono font-bold">{jobNumber}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Vehicle</span>
          <span className="text-white font-bold">{registration}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Clocked on at</span>
          <span className="text-white font-medium">
            {new Date(clockedOnAt).toLocaleTimeString('en-ZA', {
              hour: '2-digit', minute: '2-digit'
            })}
          </span>
        </div>
      </div>

      <p className="text-gray-600 text-sm mb-4">Returning to PIN screen…</p>

      <button
        onClick={onReturn}
        className="text-brand-400 hover:text-brand-300 text-sm font-medium
                   transition-colors duration-150"
      >
        Return now
      </button>
    </div>
  )
}

// SECTION: Main JobClocking component
export default function JobClocking() {
  const { jobId }  = useParams()
  const navigate   = useNavigate()
  const user       = getWorkshopUser()

  const [job,          setJob]          = useState(null)
  const [stages,       setStages]       = useState([])
  const [clockingSessions, setClockingSessions] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [clockingOn,   setClockingOn]   = useState(null)  // stageId being clocked onto
  const [successData,  setSuccessData]  = useState(null)

  // SECTION: Fetch job data
  // Uses SECURITY DEFINER RPC functions — bypasses RLS for anon workshop portal.
  const fetchJob = useCallback(async () => {
    // Fetch job+vehicle, stages and clocking in parallel
    const [jobRes, stagesRes, clockingRes] = await Promise.all([
      supabase.rpc('get_workshop_job', { p_job_id: jobId }),

      supabase
        .from('job_stages')
        .select('*')
        .eq('job_id', jobId)
        .order('sort_order'),

      supabase
        .from('workshop_clocking')
        .select('id, job_stage_id, technician_id, clocked_on_at, clocked_off_at, auto_clocked_off, duration_minutes')
        .eq('job_id', jobId)
        .order('clocked_on_at', { ascending: false }),
    ])

    if (jobRes.error || !jobRes.data?.length) {
      navigate('/workshop/home', { replace: true })
      return
    }

    const jobRow = jobRes.data[0]

    // Fetch technician names for clocking sessions
    const techIds = [...new Set((clockingRes.data || []).map(s => s.technician_id))]
    const techMap = {}
    if (techIds.length > 0) {
      const { data: techData } = await supabase
        .rpc('lookup_technician_names', { p_ids: techIds })
      ;(techData || []).forEach(t => { techMap[t.id] = t.full_name })
    }

    const clockingWithNames = (clockingRes.data || []).map(s => ({
      ...s,
      profiles: { full_name: techMap[s.technician_id] || 'Technician' }
    }))

    setJob({
      id:         jobRow.id,
      job_number: jobRow.job_number,
      status:     jobRow.status,
      branch_id:  jobRow.branch_id,
      vehicle_id: jobRow.vehicle_id,
      vehicles: {
        registration: jobRow.registration,
        make:         jobRow.make,
        model:        jobRow.model,
        year:         jobRow.year,
        colour:       jobRow.colour,
        owner_name:   jobRow.owner_name,
      }
    })
    setStages(stagesRes.data || [])
    setClockingSessions(clockingWithNames)
    setLoading(false)
  }, [jobId, navigate])

  useEffect(() => { fetchJob() }, [fetchJob])

  // SECTION: Department access check
  function canAccessStage(stage) {
    if (stage.system_stage) return false

    // Quality controllers (tier1 or tier2) can access quality stages
    if (
      user.tier1_role === 'quality_controller' ||
      user.tier2_role === 'quality_controller'
    ) {
      return stage.department_group === 'quality' ||
             DEPT_ACCESS[user.department_group]?.includes(stage.department_group)
    }

    if (!user.department_group) return false
    const allowed = DEPT_ACCESS[user.department_group] || []
    return allowed.includes(stage.department_group)
  }

  // SECTION: Get active clocking session for a stage
  function getActiveSession(stageId) {
    return clockingSessions.find(
      s => s.job_stage_id === stageId && !s.clocked_off_at
    ) || null
  }

  // SECTION: Clock on handler
  async function handleClockOn(stage) {
    if (clockingOn) return
    setClockingOn(stage.id)

    const { error } = await supabase
      .from('workshop_clocking')
      .insert({
        branch_id:    user.branch_id,
        job_id:       jobId,
        job_stage_id: stage.id,
        technician_id: user.id,
        clocked_on_at: new Date().toISOString(),
      })

    if (error) {
      console.error('[JobClocking] Clock-on error:', error)
      setClockingOn(null)
      return
    }

    // Show success screen
    setSuccessData({
      techName:    user.full_name,
      stageName:   stage.name,
      jobNumber:   job.job_number,
      registration: job.vehicles?.registration,
      clockedOnAt: new Date().toISOString(),
    })

    setClockingOn(null)
  }

  // SECTION: Return to PIN screen after success
  function handleSuccessReturn() {
    clearWorkshopUser()
    navigate('/workshop/login', { replace: true })
  }

  // SECTION: Progress calculation (non-system stages only)
  const nonSystemStages  = stages.filter(s => !s.system_stage)
  const completedStages  = nonSystemStages.filter(s => s.status === 'complete').length
  const progressPct      = nonSystemStages.length > 0
    ? Math.round((completedStages / nonSystemStages.length) * 100)
    : 0

  // SECTION: Render — loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent
                        rounded-full animate-spin" />
      </div>
    )
  }

  // SECTION: Render — success screen
  if (successData) {
    return <SuccessScreen {...successData} onReturn={handleSuccessReturn} />
  }

  const vehicle = job?.vehicles

  // SECTION: Render — main clocking screen
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col select-none">

      {/* SECTION: Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate('/workshop/home')}
            className="w-9 h-9 flex items-center justify-center rounded-xl
                       bg-gray-800 hover:bg-gray-700 border border-gray-700
                       text-gray-400 hover:text-white transition-all duration-150"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-brand-400 font-bold text-lg">
                {job?.job_number}
              </span>
              <span className="text-white font-bold text-lg">
                {vehicle?.registration}
              </span>
            </div>
            <p className="text-gray-400 text-xs">
              {vehicle?.make} {vehicle?.model}
              {vehicle?.year ? ` · ${vehicle.year}` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-white text-sm font-medium">{user?.full_name}</p>
            <p className="text-gray-500 text-xs">
              {user?.workshop_role?.name || user?.tier2_role?.replace(/_/g, ' ')}
            </p>
          </div>
        </div>

        {/* Owner subtitle */}
        {vehicle?.owner_name && (
          <div className="px-4 pb-2">
            <p className="text-gray-600 text-xs">{vehicle.owner_name}</p>
          </div>
        )}

        {/* Progress bar */}
        <div className="px-4 pb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{completedStages} of {nonSystemStages.length} stages complete</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* SECTION: Stage list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {stages.map(stage => {
          const activeSession = getActiveSession(stage.id)
          const isMySession   = activeSession?.technician_id === user.id
          const isSomeoneElse = activeSession && !isMySession
          const isComplete    = stage.status === 'complete'
          const isSkipped     = stage.status === 'skipped'
          const canAccess     = canAccessStage(stage)
          const isClockingThis = clockingOn === stage.id

          // Get all clocking history for this stage
          const stageHistory = clockingSessions.filter(
            s => s.job_stage_id === stage.id && s.clocked_off_at
          )

          // COMPLETE stage
          if (isComplete) {
            return (
              <div key={stage.id}
                className="bg-green-950/40 border border-green-900/60 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 font-mono text-xs w-5">{stage.sort_order}</span>
                    <span className="text-green-300 font-semibold">{stage.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {stage.duration_minutes && (
                      <span className="text-green-600 text-xs">{formatDuration(stage.duration_minutes)}</span>
                    )}
                    <CheckCheck className="w-4 h-4 text-green-500" />
                  </div>
                </div>
                {stage.completed_at && (
                  <p className="text-green-800 text-xs ml-7">
                    Completed {new Date(stage.completed_at).toLocaleTimeString('en-ZA', {
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                )}
                {/* Clocking history */}
                {stageHistory.length > 0 && (
                  <div className="mt-2 ml-7 space-y-1">
                    {stageHistory.map(s => (
                      <div key={s.id} className="flex items-center gap-2 text-xs text-green-800">
                        <User className="w-3 h-3" />
                        <span>{s.profiles?.full_name}</span>
                        {s.duration_minutes && <span>· {formatDuration(s.duration_minutes)}</span>}
                        {s.auto_clocked_off && (
                          <span className="text-green-900">(auto)</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          // SYSTEM STAGE (Ready for Collection)
          if (stage.system_stage) {
            return (
              <div key={stage.id}
                className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 opacity-60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 font-mono text-xs w-5">{stage.sort_order}</span>
                    <span className="text-gray-500 font-medium">{stage.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 text-xs">Managed by reception</span>
                    <Lock className="w-3.5 h-3.5 text-gray-700" />
                  </div>
                </div>
              </div>
            )
          }

          // ACTIVE — someone else clocked on
          if (isSomeoneElse) {
            return (
              <div key={stage.id}
                className="bg-blue-950/40 border border-blue-900/60 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 font-mono text-xs w-5">{stage.sort_order}</span>
                    <span className="text-blue-300 font-semibold">{stage.name}</span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                    </span>
                  </div>
                  <StageBadge status="active" />
                </div>
                <div className="ml-7 flex items-center gap-2 text-sm">
                  <User className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-blue-400 font-medium">
                    {activeSession.profiles?.full_name || 'Technician'}
                  </span>
                  <span className="text-blue-700">·</span>
                  <span className="text-blue-600 text-xs">
                    <ElapsedTime startedAt={activeSession.clocked_on_at} />
                  </span>
                </div>
              </div>
            )
          }

          // ACTIVE — current technician is clocked on
          if (isMySession) {
            return (
              <div key={stage.id}
                className="bg-brand-950/40 border border-brand-800/60 rounded-2xl p-4
                           ring-1 ring-brand-600/40">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 font-mono text-xs w-5">{stage.sort_order}</span>
                    <span className="text-brand-300 font-semibold">{stage.name}</span>
                    <span className="w-2 h-2 bg-brand-400 rounded-full animate-pulse" />
                  </div>
                  <StageBadge status="active" />
                </div>
                <div className="ml-7 flex items-center gap-2 text-sm">
                  <Zap className="w-3.5 h-3.5 text-brand-500" />
                  <span className="text-brand-400 font-medium">You are clocked on</span>
                  <span className="text-brand-700">·</span>
                  <span className="text-brand-600 text-xs">
                    <ElapsedTime startedAt={activeSession.clocked_on_at} />
                  </span>
                </div>
              </div>
            )
          }

          // OUTSIDE DEPARTMENT
          if (!canAccess) {
            const deptLabel = stage.department_group
              ? stage.department_group.charAt(0).toUpperCase() + stage.department_group.slice(1) + ' department only'
              : 'Restricted'
            return (
              <div key={stage.id}
                className="bg-gray-900/40 border border-gray-800 rounded-2xl p-4 opacity-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 font-mono text-xs w-5">{stage.sort_order}</span>
                    <span className="text-gray-600 font-medium">{stage.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 text-xs">{deptLabel}</span>
                    <Lock className="w-3.5 h-3.5 text-gray-700" />
                  </div>
                </div>
              </div>
            )
          }

          // SKIPPED
          if (isSkipped) {
            return (
              <div key={stage.id}
                className="bg-gray-900/40 border border-gray-800 rounded-2xl p-4 opacity-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 font-mono text-xs w-5">{stage.sort_order}</span>
                    <span className="text-gray-500 font-medium line-through">{stage.name}</span>
                  </div>
                  <StageBadge status="skipped" />
                </div>
              </div>
            )
          }

          // AVAILABLE TO CLOCK ON
          return (
            <div key={stage.id}
              className="bg-gray-900 border border-gray-700 hover:border-gray-600
                         rounded-2xl p-4 transition-all duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-gray-500 font-mono text-xs w-5">{stage.sort_order}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold">{stage.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: `#${stage.colour || '6366f1'}` }}
                      />
                      <span className="text-gray-500 text-xs capitalize">
                        {stage.department_group} department
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleClockOn(stage)}
                  disabled={!!clockingOn}
                  className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700
                             active:bg-brand-800 text-white font-bold text-sm
                             px-4 py-2.5 rounded-xl transition-all duration-150
                             active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                             flex-shrink-0 ml-3"
                >
                  {isClockingThis ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent
                                    rounded-full animate-spin" />
                  ) : (
                    <>
                      <Clock className="w-4 h-4" />
                      CLOCK ON
                      <ChevronRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}

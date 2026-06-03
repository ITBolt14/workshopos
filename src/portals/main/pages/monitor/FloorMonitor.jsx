// src/portals/main/pages/monitor/FloorMonitor.jsx
// THE most important screen for the client demo.
// Real-time workshop floor status board — stage columns, vehicle cards,
// live technician clocking, auto-refresh every 30s, fullscreen mode.
// Design: Dark industrial command centre aesthetic.

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Maximize2, Minimize2, RefreshCw, Wrench,
  Clock, Zap, CheckCheck
} from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { useAuth } from '../../../../hooks/useAuth'

// SECTION: Realtime channel ref — kept outside component to survive re-renders
let realtimeChannel = null

// SECTION: Stage colour map — hex to Tailwind-safe inline styles
function stageAccent(hex) {
  return {
    borderColor: `#${hex || '6366f1'}`,
    color:       `#${hex || '6366f1'}`,
  }
}

function stageBg(hex, alpha = '18') {
  return { backgroundColor: `#${hex || '6366f1'}${alpha}` }
}

// SECTION: Pulse dot for active technician
function PulseDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full
                       bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
    </span>
  )
}

// SECTION: Elapsed timer for floor monitor cards
function FloorElapsedTimer({ startedAt }) {
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

// SECTION: Vehicle card — compact status board view
function VehicleCard({ job, activeTech, clockedOnAt, stageStartedAt, isReady }) {
  const isOverdue = job.estimated_completion &&
    new Date(job.estimated_completion) < new Date() &&
    job.status !== 'ready_for_collection' &&
    job.status !== 'collected' &&
    job.status !== 'released'
  return (
    <div className={`rounded-xl p-3 border transition-all duration-300
                     ${isReady
                       ? 'bg-green-950/60 border-green-800/60'
                       : 'bg-gray-800/80 border-gray-700/60'
                     }`}>

      {/* Overdue banner */}
      {isOverdue && (
        <div className="bg-red-900/60 border border-red-700/60 rounded-lg px-2 py-0.5 mb-1.5
                        flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse flex-shrink-0" />
          <span className="text-red-300 text-xs font-semibold">OVERDUE</span>
        </div>
      )}

      {/* Job number */}
      <p className={`font-mono text-xs font-bold mb-0.5
                     ${isReady ? 'text-green-400' : isOverdue ? 'text-red-400' : 'text-brand-400'}`}>
        {job.job_number}
      </p>

      {/* Registration — most prominent */}
      <p className={`font-mono font-black text-base leading-tight tracking-wide truncate
                     ${isReady ? 'text-green-300' : 'text-white'}`}>
        {job.registration || '—'}
      </p>

      {/* Technician */}
      <div className="flex items-center gap-1.5 mt-1.5">
        {activeTech ? (
          <>
            <PulseDot />
            <p className="text-gray-300 text-xs truncate">{activeTech}</p>
          </>
        ) : (
          <p className="text-gray-600 text-xs italic">Unassigned</p>
        )}
      </div>

      {/* Stage started time + elapsed */}
      {stageStartedAt && (
        <div className="mt-1.5 space-y-0.5">
          <p className="text-gray-600 text-xs">
            Started {new Date(stageStartedAt).toLocaleTimeString('en-ZA', {
              hour: '2-digit', minute: '2-digit'
            })}
          </p>
          {clockedOnAt && (
            <p className={`text-xs font-mono font-medium ${isReady ? 'text-green-600' : 'text-brand-500'}`}>
              <FloorElapsedTimer startedAt={clockedOnAt} />
            </p>
          )}
        </div>
      )}

    </div>
  )
}

// SECTION: Stage column
function StageColumn({ stage, jobs, clockingMap }) {
  const isReady = stage.name.toLowerCase().includes('ready for collection')
  const count   = jobs.length

  return (
    <div className="flex flex-col flex-1 min-w-0">

      {/* Column header */}
      <div
        className="rounded-xl p-3 mb-3 border-l-4"
        style={{
          ...stageBg(stage.colour, '20'),
          borderLeftColor: `#${stage.colour || '6366f1'}`,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-white font-semibold text-xs leading-tight break-words hyphens-auto">
            {stage.name}
          </p>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{
              ...stageBg(stage.colour, '30'),
              ...stageAccent(stage.colour),
            }}
          >
            {count}
          </span>
        </div>
      </div>

      {/* Vehicle cards */}
      <div className="space-y-2 flex-1">
        {count === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700/50
                          p-4 text-center">
            <p className="text-gray-600 text-xs">Empty</p>
          </div>
        ) : (
          jobs.map(job => (
            <VehicleCard
              key={job.id}
              job={job}
              activeTech={clockingMap[job.id]?.name || null}
              clockedOnAt={clockingMap[job.id]?.clockedOnAt || null}
              stageStartedAt={clockingMap[job.id]?.stageStartedAt || null}
              isReady={isReady}
            />
          ))
        )}
      </div>

    </div>
  )
}

// SECTION: Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="flex gap-4 p-6 overflow-x-auto">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="min-w-[180px] space-y-3">
          <div className="h-14 bg-gray-800 rounded-xl animate-pulse" />
          <div className="h-20 bg-gray-800/60 rounded-xl animate-pulse" />
          <div className="h-20 bg-gray-800/60 rounded-xl animate-pulse" />
        </div>
      ))}
    </div>
  )
}

// SECTION: Main FloorMonitor component
export default function FloorMonitor() {
  const { branch, profile } = useAuth()
  const branchId = branch?.id || profile?.branch_id

  const [stages,      setStages]      = useState([])
  const [jobsByStage, setJobsByStage] = useState({}) // stageId → [job]
  const [clockingMap, setClockingMap] = useState({}) // jobId → techName
  const [loading,     setLoading]     = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [fullscreen,  setFullscreen]  = useState(false)
  const [refreshing,  setRefreshing]  = useState(false)
  const containerRef  = useRef(null)
  const intervalRef   = useRef(null)

  // SECTION: Fetch all floor data
  const fetchFloorData = useCallback(async () => {
    if (!branchId) return
    setRefreshing(true)

    try {
      // Fetch stage templates for column order
      const { data: stageTemplates } = await supabase
        .from('stage_templates')
        .select('id, name, sort_order, colour')
        .eq('branch_id', branchId)
        .eq('active', true)
        .order('sort_order')

      if (!stageTemplates?.length) {
        setStages([])
        setJobsByStage({})
        setLoading(false)
        setRefreshing(false)
        return
      }

      // Fetch all active jobs for the branch
      const { data: activeJobs } = await supabase
        .from('jobs')
        .select('id, job_number, status, vehicle_id, estimated_completion')
        .eq('branch_id', branchId)
        .not('status', 'in', '(collected,on_hold,released)')

      if (!activeJobs?.length) {
        setStages(stageTemplates)
        setJobsByStage({})
        setClockingMap({})
        setLoading(false)
        setRefreshing(false)
        setLastUpdated(new Date())
        return
      }

      const jobIds      = activeJobs.map(j => j.id)
      const vehicleIds  = [...new Set(activeJobs.map(j => j.vehicle_id).filter(Boolean))]

      // Fetch vehicles, active job stages, and open clocking sessions in parallel
      const [vehiclesRes, jobStagesRes, clockingRes] = await Promise.all([
        supabase
          .from('vehicles')
          .select('id, registration')
          .in('id', vehicleIds),

        supabase
          .from('job_stages')
          .select('id, job_id, stage_template_id, status, sort_order, started_at')
          .in('job_id', jobIds)
          .eq('status', 'active'),

        supabase
          .from('workshop_clocking')
          .select('job_id, technician_id, clocked_on_at, job_stage_id')
          .in('job_id', jobIds)
          .is('clocked_off_at', null),
      ])

      // Build vehicle map
      const vehicleMap = {}
      ;(vehiclesRes.data || []).forEach(v => { vehicleMap[v.id] = v.registration })

      // Build clocking map (jobId → techName)
      const techIds = [...new Set((clockingRes.data || []).map(s => s.technician_id))]
      const techMap = {}
      if (techIds.length > 0) {
        const { data: techs } = await supabase
          .rpc('lookup_technician_names', { p_ids: techIds })
        ;(techs || []).forEach(t => { techMap[t.id] = t.full_name })
      }

      // Build stageStartedAt map (jobStageId → started_at)
      const stageStartedMap = {}
      ;(jobStagesRes.data || []).forEach(js => {
        stageStartedMap[js.id] = js.started_at
      })

      const newClockingMap = {}
      ;(clockingRes.data || []).forEach(s => {
        newClockingMap[s.job_id] = {
          name:          techMap[s.technician_id] || 'Technician',
          clockedOnAt:   s.clocked_on_at,
          stageStartedAt: stageStartedMap[s.job_stage_id] || s.clocked_on_at,
        }
      })

      // Map job_id → active stage_template_id
      const jobStageMap = {}
      ;(jobStagesRes.data || []).forEach(js => {
        jobStageMap[js.job_id] = js.stage_template_id
      })

      // Build jobsByStage — group jobs by their active stage template
      const grouped = {}
      stageTemplates.forEach(st => { grouped[st.id] = [] })

      // Also handle ready_for_collection status specially
      const readyStage = stageTemplates.find(st =>
        st.name.toLowerCase().includes('ready for collection')
      )

      // Special virtual columns for statuses not tied to a stage
      const VIRTUAL_AUTHORIZED      = '__authorized__'
      const VIRTUAL_AWAITING_PARTS  = '__awaiting_parts__'
      grouped[VIRTUAL_AUTHORIZED]     = []
      grouped[VIRTUAL_AWAITING_PARTS] = []

      activeJobs.forEach(job => {
        const enriched = {
          ...job,
          registration: vehicleMap[job.vehicle_id] || '—',
        }

        if (job.status === 'ready_for_collection' && readyStage) {
          grouped[readyStage.id].push(enriched)
        } else if (job.status === 'authorized' || job.status === 'checked_in' || job.status === 'awaiting_authorization') {
          grouped[VIRTUAL_AUTHORIZED].push(enriched)
        } else if (job.status === 'awaiting_parts') {
          grouped[VIRTUAL_AWAITING_PARTS].push(enriched)
        } else {
          const activeStageTemplateId = jobStageMap[job.id]
          if (activeStageTemplateId && grouped[activeStageTemplateId] !== undefined) {
            grouped[activeStageTemplateId].push(enriched)
          }
        }
      })

      setStages(stageTemplates)
      setJobsByStage(grouped)
      setClockingMap(newClockingMap)
      setLastUpdated(new Date())

    } catch (err) {
      console.error('[FloorMonitor] Fetch error:', err)
    }

    setLoading(false)
    setRefreshing(false)
  }, [branchId])

  // SECTION: Initial fetch + 30s auto-refresh
  useEffect(() => {
    if (!branchId) return
    fetchFloorData()

    intervalRef.current = setInterval(fetchFloorData, 30000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchFloorData, branchId])

  // SECTION: Supabase Realtime subscription
  useEffect(() => {
    if (!branchId) return

    // Clean up any existing channel
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
    }

    realtimeChannel = supabase
      .channel(`floor-monitor-${branchId}`)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'job_stages',
        filter: `branch_id=eq.${branchId}`,
      }, () => fetchFloorData())
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'workshop_clocking',
        filter: `branch_id=eq.${branchId}`,
      }, () => fetchFloorData())
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'jobs',
        filter: `branch_id=eq.${branchId}`,
      }, () => fetchFloorData())
      .subscribe()

    return () => {
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel)
        realtimeChannel = null
      }
    }
  }, [branchId, fetchFloorData])

  // SECTION: Fullscreen toggle
  function toggleFullscreen() {
    if (!fullscreen) {
      containerRef.current?.requestFullscreen?.().catch(() => {})
      setFullscreen(true)
    } else {
      document.exitFullscreen?.().catch(() => {})
      setFullscreen(false)
    }
  }

  // Listen for ESC key exiting fullscreen
  useEffect(() => {
    function handleFsChange() {
      if (!document.fullscreenElement) setFullscreen(false)
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  // SECTION: Stats
  const totalVehicles = Object.values(jobsByStage).reduce((sum, jobs) => sum + jobs.length, 0)
  const activeCount   = Object.values(clockingMap).length

  // SECTION: Render
  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-gray-950 h-screen
                  ${fullscreen ? 'fixed inset-0 z-50' : ''}`}
      style={{
        backgroundImage: `radial-gradient(ellipse at 20% 0%, rgba(37,99,235,0.06) 0%, transparent 50%),
                          radial-gradient(ellipse at 80% 100%, rgba(16,185,129,0.04) 0%, transparent 50%)`,
      }}
    >

      {/* SECTION: Header bar */}
      <div className="flex items-center justify-between px-6 py-4
                      border-b border-gray-800/80 flex-shrink-0">

        {/* Left — logo + title */}
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-display text-white font-bold text-lg leading-none">
              Workshop Floor Monitor
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">{branch?.name || '…'}</p>
          </div>
        </div>

        {/* Centre — live stats */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-brand-500 rounded-full" />
            <span className="text-gray-400 text-sm">
              <span className="text-white font-bold">{totalVehicles}</span> vehicles on floor
            </span>
          </div>
          <div className="flex items-center gap-2">
            <PulseDot />
            <span className="text-gray-400 text-sm">
              <span className="text-white font-bold">{activeCount}</span> technicians active
            </span>
          </div>
        </div>

        {/* Right — timestamp + controls */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-gray-500 text-xs">
            <Clock className="w-3.5 h-3.5" />
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Loading…'
            }
          </div>

          <button
            onClick={() => fetchFloorData()}
            disabled={refreshing}
            className="w-9 h-9 flex items-center justify-center rounded-xl
                       bg-gray-800 hover:bg-gray-700 border border-gray-700
                       text-gray-400 hover:text-white transition-all duration-150
                       disabled:opacity-40"
            title="Refresh now"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={toggleFullscreen}
            className="w-9 h-9 flex items-center justify-center rounded-xl
                       bg-gray-800 hover:bg-gray-700 border border-gray-700
                       text-gray-400 hover:text-white transition-all duration-150"
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen
              ? <Minimize2 className="w-4 h-4" />
              : <Maximize2 className="w-4 h-4" />
            }
          </button>
        </div>
      </div>

      {/* SECTION: Stage columns */}
      {loading ? (
        <LoadingSkeleton />
      ) : stages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Wrench className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No stage templates configured</p>
            <p className="text-gray-600 text-sm mt-1">
              Set up stage templates in Admin → Stage Templates
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex gap-3 h-full">

            {/* Virtual: Authorized / Checked In column */}
            <StageColumn
              stage={{ id: '__authorized__', name: 'Authorized / Checked In', colour: '6366f1', sort_order: 0 }}
              jobs={jobsByStage['__authorized__'] || []}
              clockingMap={clockingMap}
            />

            {/* Real stage columns */}
            {stages.map((stage, idx) => (
              <div
                key={stage.id}
                className="animate-fade-in flex-1 min-w-0"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <StageColumn
                  stage={stage}
                  jobs={jobsByStage[stage.id] || []}
                  clockingMap={clockingMap}
                />
              </div>
            ))}

            {/* Virtual: Awaiting Parts column */}
            <StageColumn
              stage={{ id: '__awaiting_parts__', name: 'Awaiting Parts', colour: 'f97316', sort_order: 99 }}
              jobs={jobsByStage['__awaiting_parts__'] || []}
              clockingMap={clockingMap}
            />

          </div>
        </div>
      )}

      {/* SECTION: Footer bar — auto-refresh indicator */}
      <div className="flex items-center justify-between px-6 py-2
                      border-t border-gray-800/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <span className="text-gray-600 text-xs">Live — auto-refreshes every 30 seconds</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-700">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-green-800 rounded border border-green-700" />
            Ready for Collection
          </span>
          <span className="flex items-center gap-1.5">
            <PulseDot />
            Technician active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-gray-600 italic text-xs">Unassigned</span>
            No technician
          </span>
        </div>
      </div>

    </div>
  )
}
// src/portals/main/pages/monitor/FloorMonitor.jsx
// Airport departures-board style floor monitor.
// Columns: No | Registration | Vehicle | Client | Ins. | Repair Stage | H/J/E | Notes
//
// H/J/E = initials of the customer liaison officer assigned to the job.
//         Set on the job detail page (TabOverview). Displayed here read-only.
//
// Notes = latest note from job_notes. Notes added in Job Detail → Notes tab.

import { useState, useEffect, useCallback, useRef } from 'react'
import { Maximize2, Minimize2, RefreshCw, Wrench } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { useAuth } from '../../../../hooks/useAuth'

let realtimeChannel = null

// SECTION: Live wall clock
function WallClock() {
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')
  useEffect(() => {
    function tick() {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-ZA', { hour12: false }))
      setDate(now.toLocaleDateString('en-ZA', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }).toUpperCase())
    }
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [])
  return (
    <div className="text-right">
      <div style={{ fontFamily:"'Courier New',monospace", fontSize:'28px', fontWeight:700, color:'#e8b840', letterSpacing:'3px', lineHeight:1 }}>{time}</div>
      <div style={{ fontFamily:"'Courier New',monospace", fontSize:'11px', color:'#4a5568', letterSpacing:'1px', marginTop:'4px' }}>{date}</div>
    </div>
  )
}

// SECTION: Stage pill
function StagePill({ stageName, stageColour }) {
  const hex = stageColour || '6366f1'
  return (
    <span style={{
      fontFamily:"'Courier New',monospace", fontSize:'12px', fontWeight:700,
      letterSpacing:'1px', padding:'4px 10px', borderRadius:'3px',
      display:'inline-block', background:`#${hex}22`, color:`#${hex}`,
      border:`1px solid #${hex}44`, whiteSpace:'nowrap',
      maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis',
    }}>{stageName}</span>
  )
}

// SECTION: Refresh progress bar
function RefreshBar({ interval = 30000 }) {
  const [pct, setPct] = useState(0)
  const startRef = useRef(Date.now())
  useEffect(() => {
    startRef.current = Date.now()
    const i = setInterval(() => {
      const elapsed = Date.now() - startRef.current
      setPct(Math.min((elapsed / interval) * 100, 100))
      if (elapsed >= interval) startRef.current = Date.now()
    }, 200)
    return () => clearInterval(i)
  }, [interval])
  return (
    <div style={{ height:'2px', background:'#1c1f26' }}>
      <div style={{ height:'100%', background:'#e8b840', width:`${pct}%`, transition:'width 0.2s linear' }} />
    </div>
  )
}

// SECTION: Loading skeleton
function LoadingSkeleton() {
  return (
    <div style={{ padding:'32px 24px' }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{ height:'50px', background:'#111316', borderRadius:'4px', marginBottom:'3px', opacity:1 - i * 0.15 }} />
      ))}
    </div>
  )
}

// SECTION: Resolve current stage display
function resolveStageDisplay(job, stages, jobStageMap) {
  if (job.status === 'ready_for_collection')   return { name:'Ready for Collection',    colour:'22c55e' }
  if (job.status === 'awaiting_parts')          return { name:'Awaiting Parts',           colour:'f97316' }
  if (job.status === 'awaiting_authorization')  return { name:'Awaiting Authorization',   colour:'a78bfa' }
  if (job.status === 'authorized' || job.status === 'checked_in') return { name:'Authorized / Checked In', colour:'6366f1' }
  if (job.status === 'quality_check')           return { name:'Quality Check',            colour:'ec4899' }
  const tplId = jobStageMap[job.id]
  if (tplId) {
    const tpl = stages.find(s => s.id === tplId)
    if (tpl) return { name:tpl.name, colour:tpl.colour || '6366f1' }
  }
  return { name:'In Progress', colour:'6366f1' }
}

// SECTION: Single table row
function JobRow({ job, rowNum, stages, jobStageMap }) {
  const stage  = resolveStageDisplay(job, stages, jobStageMap)
  const isEven = rowNum % 2 === 0

  const tdBase = (w, extra = {}) => ({
    padding: '13px 8px',
    width: w,
    borderBottom: '1px solid #1e2530',
    verticalAlign: 'middle',
    overflow: 'hidden',
    ...extra,
  })

  const mono = (size, color, extra = {}) => ({
    fontFamily:"'Courier New',monospace",
    fontSize: size, color, letterSpacing:'1px',
    whiteSpace:'nowrap', overflow:'hidden',
    textOverflow:'ellipsis', display:'block',
    ...extra,
  })

  return (
    <tr style={{ background: isEven ? '#0a0c10' : '#0f1218' }}>

      {/* No */}
      <td style={tdBase('52px', { padding:'13px 8px 13px 20px', textAlign:'center' })}>
        <span style={mono('13px','#4a5568', { textAlign:'center' })}>{rowNum}</span>
      </td>

      {/* Registration */}
      <td style={tdBase('130px')}>
        <span style={{
          fontFamily:"'Courier New',monospace", fontSize:'14px', fontWeight:700,
          color:'#ffffff', letterSpacing:'2px', background:'#161b24',
          padding:'3px 8px', borderRadius:'3px', border:'1px solid #252d3a',
          display:'inline-block', whiteSpace:'nowrap',
        }}>
          {job.registration || '—'}
        </span>
      </td>

      {/* Vehicle */}
      <td style={tdBase('180px')}>
        <span style={mono('13px','#e8e0d0')}>
          {job.make ? `${job.make} ${job.model || ''}`.trim() : '—'}
        </span>
      </td>

      {/* Client */}
      <td style={tdBase('160px')}>
        <span style={mono('13px','#c8d4e0')}>{job.owner_name || '—'}</span>
      </td>

      {/* Ins. */}
      <td style={tdBase('130px')}>
        <span style={mono('12px','#8899aa')}>
          {job.insurer_name || (job.job_type === 'private' ? 'Private' : '—')}
        </span>
      </td>

      {/* Repair Stage */}
      <td style={tdBase('200px')}>
        <StagePill stageName={stage.name} stageColour={stage.colour} />
      </td>

      {/* H/J/E */}
      <td style={tdBase('70px', { textAlign:'center' })}>
        <span style={{
          fontFamily:"'Courier New',monospace", fontSize:'16px', fontWeight:700,
          color: job.liaison_initials ? '#e8b840' : '#2a3040',
          letterSpacing:'2px', display:'block', textAlign:'center',
        }}>
          {job.liaison_initials || '—'}
        </span>
      </td>

      {/* Notes */}
      <td style={tdBase('auto', { padding:'13px 20px 13px 8px' })}>
        {job.latest_note ? (
          <div>
            <span style={{ fontFamily:"'Courier New',monospace", fontSize:'12px', color:'#b8c4d0', letterSpacing:'0.5px', lineHeight:'1.4', display:'block' }}>
              {job.latest_note}
            </span>
            <span style={{ fontFamily:"'Courier New',monospace", fontSize:'10px', color:'#353d4a', letterSpacing:'1px', marginTop:'3px', display:'block' }}>
              {job.latest_note_by ? `${job.latest_note_by} · ` : ''}{job.latest_note_at}
            </span>
          </div>
        ) : (
          <span style={mono('12px','#2a3040', { fontStyle:'italic' })}>—</span>
        )}
      </td>

    </tr>
  )
}

// SECTION: Main FloorMonitor component
export default function FloorMonitor() {
  const { branch, profile } = useAuth()
  const branchId = branch?.id || profile?.branch_id

  const [stages,      setStages]      = useState([])
  const [jobStageMap, setJobStageMap] = useState({})
  const [allJobs,     setAllJobs]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [fullscreen,  setFullscreen]  = useState(false)
  const [refreshing,  setRefreshing]  = useState(false)
  const containerRef = useRef(null)
  const intervalRef  = useRef(null)

  // SECTION: Fetch all floor data
  const fetchFloorData = useCallback(async () => {
    if (!branchId) return
    setRefreshing(true)

    try {
      const { data: stageTemplates } = await supabase
        .from('stage_templates')
        .select('id, name, sort_order, colour')
        .eq('branch_id', branchId)
        .eq('active', true)
        .order('sort_order')

      if (!stageTemplates?.length) {
        setStages([]); setAllJobs([])
        setLoading(false); setRefreshing(false)
        return
      }

      const { data: activeJobs } = await supabase
        .from('jobs')
        .select('id, job_number, status, vehicle_id, insurer_id, job_type, estimated_completion, liaison_initials')
        .eq('branch_id', branchId)
        .not('status', 'in', '(collected,on_hold,released)')

      if (!activeJobs?.length) {
        setStages(stageTemplates); setAllJobs([])
        setLoading(false); setRefreshing(false)
        setLastUpdated(new Date())
        return
      }

      const jobIds     = activeJobs.map(j => j.id)
      const vehicleIds = [...new Set(activeJobs.map(j => j.vehicle_id).filter(Boolean))]
      const insurerIds = [...new Set(activeJobs.map(j => j.insurer_id).filter(Boolean))]

      const [vehiclesRes, jobStagesRes, notesRes, insurersRes] = await Promise.all([
        supabase.from('vehicles')
          .select('id, registration, make, model, owner_name')
          .in('id', vehicleIds),

        supabase.from('job_stages')
          .select('id, job_id, stage_template_id, status')
          .in('job_id', jobIds)
          .eq('status', 'active'),

        supabase.from('job_notes')
          .select('job_id, note, created_at, created_by')
          .in('job_id', jobIds)
          .order('created_at', { ascending: false }),

        insurerIds.length > 0
          ? supabase.from('insurers').select('id, name').in('id', insurerIds)
          : Promise.resolve({ data: [] }),
      ])

      // Vehicle map
      const vehicleMap = {}
      ;(vehiclesRes.data || []).forEach(v => { vehicleMap[v.id] = v })

      // Insurer map
      const insurerMap = {}
      ;(insurersRes.data || []).forEach(i => { insurerMap[i.id] = i.name })

      // Job → active stage template
      const newJobStageMap = {}
      ;(jobStagesRes.data || []).forEach(js => { newJobStageMap[js.job_id] = js.stage_template_id })

      // Latest note per job (notes already ordered desc)
      const latestNoteMap = {}
      ;(notesRes.data || []).forEach(n => {
        if (!latestNoteMap[n.job_id]) latestNoteMap[n.job_id] = n
      })

      // Note author names
      const noteAuthorIds = [...new Set(Object.values(latestNoteMap).map(n => n.created_by).filter(Boolean))]
      const noteAuthorMap = {}
      if (noteAuthorIds.length > 0) {
        const { data: authors } = await supabase.rpc('lookup_technician_names', { p_ids: noteAuthorIds })
        ;(authors || []).forEach(a => { noteAuthorMap[a.id] = a.full_name })
      }

      // Enrich
      const enriched = activeJobs.map(job => {
        const note = latestNoteMap[job.id]
        return {
          ...job,
          registration:   vehicleMap[job.vehicle_id]?.registration || '—',
          make:           vehicleMap[job.vehicle_id]?.make || '',
          model:          vehicleMap[job.vehicle_id]?.model || '',
          owner_name:     vehicleMap[job.vehicle_id]?.owner_name || '',
          insurer_name:   insurerMap[job.insurer_id] || null,
          latest_note:    note?.note || null,
          latest_note_by: note ? (noteAuthorMap[note.created_by] || null) : null,
          latest_note_at: note
            ? new Date(note.created_at).toLocaleString('en-ZA', {
                day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'
              })
            : null,
        }
      })

      // Sort: overdue first, then delivery date, then job number
      const sorted = [...enriched].sort((a, b) => {
        const aOver = a.estimated_completion && new Date(a.estimated_completion) < new Date()
        const bOver = b.estimated_completion && new Date(b.estimated_completion) < new Date()
        if (aOver && !bOver) return -1
        if (!aOver && bOver) return 1
        if (a.estimated_completion && b.estimated_completion)
          return new Date(a.estimated_completion) - new Date(b.estimated_completion)
        return a.job_number.localeCompare(b.job_number)
      })

      setStages(stageTemplates)
      setJobStageMap(newJobStageMap)
      setAllJobs(sorted)
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
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchFloorData, branchId])

  // SECTION: Realtime subscriptions — jobs, stages and notes all trigger refresh
  useEffect(() => {
    if (!branchId) return
    if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null }
    realtimeChannel = supabase
      .channel(`floor-monitor-${branchId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'job_stages', filter:`branch_id=eq.${branchId}` }, () => fetchFloorData())
      .on('postgres_changes', { event:'*', schema:'public', table:'jobs',       filter:`branch_id=eq.${branchId}` }, () => fetchFloorData())
      .on('postgres_changes', { event:'*', schema:'public', table:'job_notes',  filter:`branch_id=eq.${branchId}` }, () => fetchFloorData())
      .subscribe()
    return () => { if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null } }
  }, [branchId, fetchFloorData])

  // SECTION: Fullscreen
  function toggleFullscreen() {
    if (!fullscreen) { containerRef.current?.requestFullscreen?.().catch(() => {}); setFullscreen(true) }
    else { document.exitFullscreen?.().catch(() => {}); setFullscreen(false) }
  }
  useEffect(() => {
    function onFs() { if (!document.fullscreenElement) setFullscreen(false) }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const overdueCount = allJobs.filter(j =>
    j.estimated_completion && new Date(j.estimated_completion) < new Date() &&
    !['ready_for_collection','collected','released'].includes(j.status)
  ).length

  const COLS = [
    { lbl:'No',           w:'52px',  pl:'20px', center:true  },
    { lbl:'Registration', w:'130px', pl:'8px',  center:false },
    { lbl:'Vehicle',      w:'180px', pl:'8px',  center:false },
    { lbl:'Client',       w:'160px', pl:'8px',  center:false },
    { lbl:'Ins.',         w:'130px', pl:'8px',  center:false },
    { lbl:'Repair Stage', w:'200px', pl:'8px',  center:false },
    { lbl:'H/J/E',        w:'70px',  pl:'8px',  center:true  },
    { lbl:'Notes',        w:'auto',  pl:'8px',  center:false },
  ]

  return (
    <div ref={containerRef} style={{ display:'flex', flexDirection:'column', background:'#09090b', height:'100vh', ...(fullscreen ? { position:'fixed', inset:0, zIndex:50 } : {}) }}>

      {/* SECTION: Header */}
      <div style={{ background:'#111115', borderBottom:'2px solid #1c1f26', padding:'14px 24px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'6px' }}>
            <div style={{ width:'36px', height:'36px', background:'#1d4ed8', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Wrench size={18} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontFamily:"'Courier New',monospace", fontSize:'18px', fontWeight:700, color:'#e8b840', letterSpacing:'4px' }}>WORKSHOPOS</div>
              <div style={{ fontFamily:"'Courier New',monospace", fontSize:'10px', color:'#4a5263', letterSpacing:'2px', marginTop:'2px' }}>
                WORKSHOP FLOOR MONITOR &nbsp;&bull;&nbsp; {(branch?.name || '').toUpperCase()}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:'24px', marginTop:'4px' }}>
            {[
              { val:allJobs.length, lbl:'VEHICLES ON FLOOR' },
              { val:overdueCount,   lbl:'OVERDUE', warn:overdueCount > 0 },
            ].map(s => (
              <div key={s.lbl} style={{ fontFamily:"'Courier New',monospace", fontSize:'11px', letterSpacing:'1px' }}>
                <span style={{ color:s.warn ? '#d04040' : '#e8b840', fontWeight:700, marginRight:'5px' }}>{s.val}</span>
                <span style={{ color:'#4a5263' }}>{s.lbl}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'flex-start', gap:'16px' }}>
          <WallClock />
          <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
            <button onClick={() => fetchFloorData()} disabled={refreshing} style={{ width:'34px', height:'34px', background:'#1c1f26', border:'1px solid #2a2f3a', borderRadius:'6px', color:'#6a7888', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', opacity:refreshing ? 0.4 : 1 }}>
              <RefreshCw size={15} style={refreshing ? { animation:'spin 1s linear infinite' } : {}} />
            </button>
            <button onClick={toggleFullscreen} style={{ width:'34px', height:'34px', background:'#1c1f26', border:'1px solid #2a2f3a', borderRadius:'6px', color:'#6a7888', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>
        </div>
      </div>

      <RefreshBar interval={30000} />

      {/* SECTION: Table */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {loading ? <LoadingSkeleton /> : allJobs.length === 0 ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', textAlign:'center' }}>
            <div>
              <Wrench size={48} color="#1c1f26" style={{ margin:'0 auto 16px' }} />
              <div style={{ fontFamily:"'Courier New',monospace", color:'#353d4a', fontSize:'14px', letterSpacing:'2px' }}>NO ACTIVE JOBS ON FLOOR</div>
            </div>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
            <thead>
              <tr style={{ background:'#0d0f12', borderBottom:'2px solid #2a3348' }}>
                {COLS.map(col => (
                  <th key={col.lbl} style={{ width:col.w, padding:`10px 8px 10px ${col.pl}`, textAlign:col.center ? 'center' : 'left', fontFamily:"'Courier New',monospace", fontSize:'11px', color:'#d0d8e8', letterSpacing:'2px', fontWeight:700, textTransform:'uppercase', ...(col.lbl === 'Notes' ? { paddingRight:'20px' } : {}) }}>
                    {col.lbl}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allJobs.map((job, idx) => (
                <JobRow key={job.id} job={job} rowNum={idx + 1} stages={stages} jobStageMap={jobStageMap} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* SECTION: Footer */}
      <div style={{ background:'#0d0f12', borderTop:'2px solid #1c1f26', padding:'10px 24px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <div style={{ fontFamily:"'Courier New',monospace", fontSize:'10px', color:'#4a5568', letterSpacing:'2px', display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#3ab840', display:'inline-block' }} />
          LIVE &nbsp;&bull;&nbsp; AUTO-REFRESHES EVERY 30 SECONDS
          {lastUpdated && (
            <span style={{ color:'#2a3040', marginLeft:'8px' }}>
              LAST UPDATED {lastUpdated.toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false })}
            </span>
          )}
        </div>
        <div style={{ fontFamily:"'Courier New',monospace", fontSize:'10px', color:'#e8b840', letterSpacing:'3px', opacity:0.4 }}>WORKSHOPOS</div>
      </div>

    </div>
  )
}
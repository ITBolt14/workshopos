// src/portals/main/pages/reports/ClockingReports.jsx
// Clocking reports — per job or per technician for a selectable date range.
// Viewable on screen, printable and exportable to CSV (Excel-compatible).

import React, { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { Search, Download, Printer, Clock, User, Car, ChevronDown } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { useAuth } from '../../../../hooks/useAuth'

// SECTION: Format duration in minutes to Xh Ym
function fmtDuration(mins) {
  if (!mins && mins !== 0) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// SECTION: Format date string
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// SECTION: Print report
// Uses visibility:hidden on body then visibility:visible on the print
// container — same pattern as QR sticker which works reliably.
function printReport(title, tableEl) {
  // Clone the table so we don't move it out of React's DOM
  const tableClone = tableEl.cloneNode(true)

  const container = document.createElement('div')
  container.id = '__report_print__'
  container.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:#fff;z-index:99999;padding:20px;box-sizing:border-box;visibility:hidden'

  const heading = document.createElement('h1')
  heading.style.cssText = 'font-family:sans-serif;font-size:18px;font-weight:700;margin:0 0 4px;color:#111'
  heading.textContent = title

  const sub = document.createElement('p')
  sub.style.cssText = 'font-family:sans-serif;font-size:12px;color:#666;margin:0 0 16px'
  sub.textContent = 'Printed ' + new Date().toLocaleString('en-ZA')

  container.appendChild(heading)
  container.appendChild(sub)
  container.appendChild(tableClone)
  document.body.appendChild(container)

  const style = document.createElement('style')
  style.id = '__report_print_style__'
  style.textContent = `
    @media print {
      body * { visibility: hidden !important; }
      #__report_print__,
      #__report_print__ * { visibility: visible !important; }
      #__report_print__ {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        padding: 16px !important;
        font-family: sans-serif;
        font-size: 12px;
        color: #111;
        background: #fff !important;
      }
      #__report_print__ table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      #__report_print__ th {
        text-align: left;
        padding: 6px 8px;
        font-size: 11px;
        text-transform: uppercase;
        color: #374151;
        border-bottom: 2px solid #111;
        font-weight: 700;
      }
      #__report_print__ td {
        padding: 6px 8px;
        border-bottom: 1px solid #ccc;
      }
      #__report_print__ tfoot td {
        font-weight: 700;
        border-top: 2px solid #111;
        border-bottom: none;
      }
      @page { margin: 12mm; size: A4 portrait; }
    }
  `
  document.head.appendChild(style)

  window.print()

  setTimeout(() => {
    container.remove()
    style.remove()
  }, 1000)
}

// SECTION: Export rows to CSV
function exportCSV(rows, filename) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// SECTION: Per-Job Report table
function JobReport({ rows, jobNumber }) {
  if (!rows.length) return (
    <div className="card text-center py-12 text-gray-400">No clocking records found for this job.</div>
  )

  const totalMins = rows.reduce((sum, r) => sum + (r.duration_minutes || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{rows.length} clocking record{rows.length !== 1 ? 's' : ''} · Total: <span className="font-semibold text-gray-800">{fmtDuration(totalMins)}</span></p>
        <div className="flex gap-2">
          <button onClick={() => {
              const tbl = document.getElementById('job-report-table')
              if (tbl) printReport(`Job Clocking Report — ${jobNumber}`, tbl)
            }} className="btn-secondary flex items-center gap-2 text-sm py-1.5">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={() => exportCSV(rows.map(r => ({
            'Technician': r.technician_name,
            'Stage': r.stage_name,
            'Clocked On': fmtDate(r.clocked_on_at),
            'Clocked Off': fmtDate(r.clocked_off_at),
            'Duration': fmtDuration(r.duration_minutes),
            'Auto Clocked Off': r.auto_clocked_off ? 'Yes' : 'No',
          })), `${jobNumber}_clocking.csv`)} className="btn-primary flex items-center gap-2 text-sm py-1.5">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table id="job-report-table" className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Technician</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stage</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Clocked On</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Clocked Off</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Auto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{r.technician_name}</td>
                <td className="px-4 py-3 text-gray-600">{r.stage_name}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(r.clocked_on_at)}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.clocked_off_at ? fmtDate(r.clocked_off_at) : <span className="text-green-600 font-medium">Active</span>}</td>
                <td className="px-4 py-3 text-right font-mono font-medium text-gray-800">{fmtDuration(r.duration_minutes)}</td>
                <td className="px-4 py-3 text-center">
                  {r.auto_clocked_off && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Auto</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-200">
              <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">{fmtDuration(totalMins)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// SECTION: Per-Technician Report table
function TechReport({ rows, techName, dateFrom, dateTo }) {
  if (!rows.length) return (
    <div className="card text-center py-12 text-gray-400">No clocking records found for this technician in the selected period.</div>
  )

  const totalMins = rows.reduce((sum, r) => sum + (r.duration_minutes || 0), 0)

  // Group by date for summary
  const byDate = {}
  rows.forEach(r => {
    const d = new Date(r.clocked_on_at).toLocaleDateString('en-ZA', { day:'2-digit', month:'short', year:'numeric' })
    byDate[d] = (byDate[d] || 0) + (r.duration_minutes || 0)
  })

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-brand-600">{fmtDuration(totalMins)}</p>
          <p className="text-xs text-gray-400 mt-1">Total Time</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-gray-800">{rows.length}</p>
          <p className="text-xs text-gray-400 mt-1">Sessions</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-gray-800">{Object.keys(byDate).length}</p>
          <p className="text-xs text-gray-400 mt-1">Days Worked</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{rows.length} session{rows.length !== 1 ? 's' : ''} across {Object.keys(byDate).length} day{Object.keys(byDate).length !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <button onClick={() => {
              const tbl = document.getElementById('tech-report-table')
              if (tbl) printReport(`Technician Report — ${techName} (${dateFrom} to ${dateTo})`, tbl)
            }} className="btn-secondary flex items-center gap-2 text-sm py-1.5">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={() => exportCSV(rows.map(r => ({
            'Technician': r.technician_name,
            'Job No.': r.job_number,
            'Stage': r.stage_name,
            'Date': new Date(r.clocked_on_at).toLocaleDateString('en-ZA'),
            'Clocked On': fmtDate(r.clocked_on_at),
            'Clocked Off': fmtDate(r.clocked_off_at),
            'Duration (mins)': r.duration_minutes || 0,
            'Duration': fmtDuration(r.duration_minutes),
            'Auto Clocked Off': r.auto_clocked_off ? 'Yes' : 'No',
          })), `${techName.replace(/\s+/g, '_')}_${dateFrom}_${dateTo}.csv`)} className="btn-primary flex items-center gap-2 text-sm py-1.5">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table id="tech-report-table" className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Job No.</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stage</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Clocked On</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Clocked Off</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, i) => {
              const date = new Date(r.clocked_on_at).toLocaleDateString('en-ZA', { weekday:'short', day:'2-digit', month:'short' })
              const prevDate = i > 0 ? new Date(rows[i-1].clocked_on_at).toLocaleDateString('en-ZA', { weekday:'short', day:'2-digit', month:'short' }) : null
              const showDate = date !== prevDate
              return (
                <React.Fragment key={i}>
                  {showDate && i > 0 && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-4 py-1.5 text-xs text-gray-400">
                        Daily total for {prevDate}:{' '}
                        <span className="font-semibold text-gray-600">
                          {fmtDuration(
                            rows
                              .slice(0, i)
                              .filter(x =>
                                new Date(x.clocked_on_at).toLocaleDateString('en-ZA', {
                                  weekday:'short', day:'2-digit', month:'short'
                                }) === prevDate
                              )
                              .reduce((s, x) => s + (x.duration_minutes || 0), 0)
                          )}
                        </span>
                      </td>
                      <td />
                    </tr>
                  )}
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{showDate ? date : ''}</td>
                    <td className="px-4 py-3 font-mono text-brand-700 font-medium">{r.job_number}</td>
                    <td className="px-4 py-3 text-gray-600">{r.stage_name}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(r.clocked_on_at).toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit', hour12:false })}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {r.clocked_off_at
                        ? new Date(r.clocked_off_at).toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit', hour12:false })
                        : <span className="text-green-600 font-medium">Active</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-gray-800">{fmtDuration(r.duration_minutes)}</td>
                  </tr>
                </React.Fragment>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-200">
              <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-700">Grand Total</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">{fmtDuration(totalMins)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// SECTION: Main ClockingReports component
export default function ClockingReports() {
  const { branch, profile } = useAuth()
  const branchId = branch?.id || profile?.branch_id

  const [mode,        setMode]        = useState('technician') // 'technician' | 'job'
  const [loading,     setLoading]     = useState(false)
  const [results,     setResults]     = useState(null)

  // Filters
  const [dateFrom,    setDateFrom]    = useState(() => {
    const d = new Date(); d.setDate(1)
    return d.toISOString().slice(0, 10)
  })
  const [dateTo,      setDateTo]      = useState(() => new Date().toISOString().slice(0, 10))

  // Technician mode
  const [techList,    setTechList]    = useState([])
  const [selectedTech,setSelectedTech]= useState('')

  // Job mode
  const [jobQuery,    setJobQuery]    = useState('')
  const [jobResults,  setJobResults]  = useState([])
  const [selectedJob, setSelectedJob] = useState(null)
  const [jobSearching,setJobSearching]= useState(false)

  // SECTION: Load technician list on mount
  useEffect(() => {
    if (!branchId) return
    supabase
      .from('profiles')
      .select('id, full_name, tier2_role')
      .eq('branch_id', branchId)
      .eq('active', true)
      .not('tier2_role', 'is', null)
      .order('full_name')
      .then(({ data }) => setTechList(data || []))
  }, [branchId])

  // SECTION: Job search
  useEffect(() => {
    if (!jobQuery.trim() || !branchId) { setJobResults([]); return }
    const timer = setTimeout(async () => {
      setJobSearching(true)
      const { data } = await supabase
        .from('jobs')
        .select('id, job_number')
        .eq('branch_id', branchId)
        .ilike('job_number', `%${jobQuery}%`)
        .order('job_number', { ascending: false })
        .limit(10)
      setJobResults(data || [])
      setJobSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [jobQuery, branchId])

  // SECTION: Run report
  async function runReport() {
    if (mode === 'technician' && !selectedTech) { toast.error('Please select a technician'); return }
    if (mode === 'job' && !selectedJob) { toast.error('Please select a job'); return }
    setLoading(true)
    setResults(null)

    try {
      const fromTs = `${dateFrom}T00:00:00`
      const toTs   = `${dateTo}T23:59:59`

      let clockingData = []

      if (mode === 'technician') {
        const { data } = await supabase
          .from('workshop_clocking')
          .select('id, job_id, job_stage_id, technician_id, clocked_on_at, clocked_off_at, duration_minutes, auto_clocked_off')
          .eq('branch_id', branchId)
          .eq('technician_id', selectedTech)
          .gte('clocked_on_at', fromTs)
          .lte('clocked_on_at', toTs)
          .order('clocked_on_at', { ascending: true })
        clockingData = data || []
      } else {
        const { data } = await supabase
          .from('workshop_clocking')
          .select('id, job_id, job_stage_id, technician_id, clocked_on_at, clocked_off_at, duration_minutes, auto_clocked_off')
          .eq('branch_id', branchId)
          .eq('job_id', selectedJob.id)
          .gte('clocked_on_at', fromTs)
          .lte('clocked_on_at', toTs)
          .order('clocked_on_at', { ascending: true })
        clockingData = data || []
      }

      if (!clockingData.length) { setResults([]); setLoading(false); return }

      // Resolve technician names
      const techIds = [...new Set(clockingData.map(r => r.technician_id).filter(Boolean))]
      const techMap = {}
      if (techIds.length) {
        const { data: techs } = await supabase.rpc('lookup_technician_names', { p_ids: techIds })
        ;(techs || []).forEach(t => { techMap[t.id] = t.full_name })
      }

      // Resolve stage names
      const stageIds = [...new Set(clockingData.map(r => r.job_stage_id).filter(Boolean))]
      const stageMap = {}
      if (stageIds.length) {
        const { data: stages } = await supabase
          .from('job_stages')
          .select('id, name')
          .in('id', stageIds)
        ;(stages || []).forEach(s => { stageMap[s.id] = s.name })
      }

      // Resolve job numbers (for technician report)
      const jobIds = [...new Set(clockingData.map(r => r.job_id).filter(Boolean))]
      const jobMap = {}
      if (jobIds.length) {
        const { data: jobs } = await supabase
          .from('jobs')
          .select('id, job_number')
          .in('id', jobIds)
        ;(jobs || []).forEach(j => { jobMap[j.id] = j.job_number })
      }

      const enriched = clockingData.map(r => ({
        ...r,
        technician_name: techMap[r.technician_id] || 'Unknown',
        stage_name:      stageMap[r.job_stage_id]  || 'Unknown Stage',
        job_number:      jobMap[r.job_id]           || '—',
      }))

      setResults(enriched)
    } catch (err) {
      console.error('[ClockingReports]', err)
      toast.error('Failed to load report')
    }

    setLoading(false)
  }

  const selectedTechName = techList.find(t => t.id === selectedTech)?.full_name || ''

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* SECTION: Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clocking Reports</h1>
          <p className="text-gray-500 text-sm mt-1">View technician time records by job or by staff member.</p>
        </div>

        {/* SECTION: Filter card */}
        <div className="card space-y-5">

          {/* Mode toggle */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {[
              { key: 'technician', icon: User,  label: 'By Technician' },
              { key: 'job',        icon: Car,   label: 'By Job' },
            ].map(m => (
              <button key={m.key} onClick={() => { setMode(m.key); setResults(null) }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${mode === m.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                <m.icon className="w-4 h-4" />
                {m.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Date from */}
            <div>
              <label className="label">Date From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field" />
            </div>

            {/* Date to */}
            <div>
              <label className="label">Date To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field" />
            </div>

            {/* Technician or job selector */}
            {mode === 'technician' ? (
              <div>
                <label className="label">Technician</label>
                <div className="relative">
                  <select value={selectedTech} onChange={e => setSelectedTech(e.target.value)} className="input-field appearance-none pr-8">
                    <option value="">Select technician…</option>
                    {techList.map(t => (
                      <option key={t.id} value={t.id}>{t.full_name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            ) : (
              <div className="relative">
                <label className="label">Job Number</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={selectedJob ? selectedJob.job_number : jobQuery}
                    onChange={e => { setJobQuery(e.target.value); setSelectedJob(null) }}
                    placeholder="Search job number…"
                    className="input-field pl-9"
                  />
                </div>
                {jobResults.length > 0 && !selectedJob && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {jobResults.map(j => (
                      <button key={j.id} onClick={() => { setSelectedJob(j); setJobQuery(''); setJobResults([]) }}
                        className="w-full text-left px-4 py-2.5 text-sm font-mono hover:bg-gray-50 border-b last:border-0">
                        {j.job_number}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={runReport} disabled={loading} className="btn-primary flex items-center gap-2">
              {loading
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Clock className="w-4 h-4" />
              }
              {loading ? 'Loading…' : 'Run Report'}
            </button>
            {results !== null && (
              <p className="text-sm text-gray-400">
                {results.length} record{results.length !== 1 ? 's' : ''} found
              </p>
            )}
          </div>
        </div>

        {/* SECTION: Results */}
        {results !== null && (
          mode === 'job'
            ? <JobReport rows={results} jobNumber={selectedJob?.job_number || ''} />
            : <TechReport rows={results} techName={selectedTechName} dateFrom={dateFrom} dateTo={dateTo} />
        )}

      </div>
    </div>
  )
}
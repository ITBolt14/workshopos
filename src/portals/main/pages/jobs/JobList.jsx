// src/portals/main/pages/jobs/JobList.jsx
// Full job list with search, filters, sort and pagination.
// CRITICAL: insurers fetched in separate one-time useEffect — never in useCallback deps.

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, X, ChevronUp, ChevronDown } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { useAuth } from '../../../../hooks/useAuth'

// SECTION: Config
const PAGE_SIZE = 20

const STATUS_OPTIONS = [
  { value: '',                    label: 'All Statuses'   },
  { value: 'checked_in',          label: 'Checked In'     },
  { value: 'authorized',          label: 'Authorized'     },
  { value: 'in_progress',         label: 'In Progress'    },
  { value: 'quality_check',       label: 'Quality Check'  },
  { value: 'awaiting_parts',      label: 'Awaiting Parts' },
  { value: 'ready_for_collection',label: 'Ready'          },
  { value: 'collected',           label: 'Collected'      },
  { value: 'on_hold',             label: 'On Hold'        },
]

const STATUS_CONFIG = {
  checked_in:           { bg: 'bg-blue-100',   text: 'text-blue-700'   },
  authorized:           { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  in_progress:          { bg: 'bg-amber-100',  text: 'text-amber-700'  },
  quality_check:        { bg: 'bg-purple-100', text: 'text-purple-700' },
  awaiting_parts:       { bg: 'bg-orange-100', text: 'text-orange-700' },
  ready_for_collection: { bg: 'bg-green-100',  text: 'text-green-700'  },
  collected:            { bg: 'bg-gray-100',   text: 'text-gray-600'   },
  on_hold:              { bg: 'bg-red-100',    text: 'text-red-700'    },
}

const PRIORITY_COLOURS = {
  1: 'bg-gray-300', 2: 'bg-blue-400', 3: 'bg-amber-400',
  4: 'bg-orange-500', 5: 'bg-red-500',
}

// SECTION: Sort header cell
function SortHeader({ label, field, sortField, sortDir, onSort }) {
  const active = sortField === field
  return (
    <th
      onClick={() => onSort(field)}
      className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase
                 tracking-wider cursor-pointer hover:text-gray-600 select-none
                 transition-colors duration-150 whitespace-nowrap"
    >
      <div className="flex items-center gap-1">
        {label}
        <span className="flex flex-col">
          <ChevronUp   className={`w-2.5 h-2.5 ${active && sortDir === 'asc'  ? 'text-brand-600' : 'text-gray-300'}`} />
          <ChevronDown className={`w-2.5 h-2.5 ${active && sortDir === 'desc' ? 'text-brand-600' : 'text-gray-300'}`} />
        </span>
      </div>
    </th>
  )
}

// SECTION: Main JobList
export default function JobList() {
  const navigate  = useNavigate()
  const { branch, profile } = useAuth()

  // Use profile.branch_id as fallback if branch not yet loaded
  const branchId = branch?.id || profile?.branch_id

  // SECTION: Insurers — fetched once, never in useCallback deps
  const [insurers, setInsurers] = useState([])
  useEffect(() => {
    if (!branchId) return
    supabase
      .from('insurers')
      .select('id, name')
      .eq('branch_id', branchId)
      .eq('active', true)
      .order('name')
      .then(({ data }) => setInsurers(data || []))
  }, [branchId])

  // SECTION: Filter/sort state
  const [search,    setSearch]    = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [sortField, setSortField] = useState('created_at')
  const [sortDir,   setSortDir]   = useState('desc')
  const [page,      setPage]      = useState(1)

  // SECTION: Jobs state
  const [jobs,      setJobs]      = useState([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)

  // SECTION: Debounced search — triggers fetch 400ms after user stops typing
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  // SECTION: Fetch jobs
  const fetchJobs = useCallback(async () => {
    if (!branchId) return
    setLoading(true)

    let query = supabase
      .from('jobs')
      .select('id, job_number, status, priority, job_type, check_in_date, estimated_completion, vehicle_id, insurer_id', { count: 'exact' })
      .eq('branch_id', branchId)

    if (statusFilter)   query = query.eq('status', statusFilter)
    if (priorityFilter) query = query.eq('priority', parseInt(priorityFilter))
    query = query.order(sortField, { ascending: sortDir === 'asc' })
    query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    const { data: jobData, count, error } = await query

    if (error) {
      console.error('[JobList] Fetch error:', error)
      setLoading(false)
      return
    }

    // Fetch vehicle data separately
    const vehicleIds = [...new Set((jobData || []).map(j => j.vehicle_id).filter(Boolean))]
    const vehicleMap = {}
    if (vehicleIds.length > 0) {
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('id, registration, make, model, owner_name')
        .in('id', vehicleIds)
      ;(vehicles || []).forEach(v => { vehicleMap[v.id] = v })
    }

    // Fetch insurer names separately
    const insurerIds = [...new Set((jobData || []).map(j => j.insurer_id).filter(Boolean))]
    const insurerMap = {}
    if (insurerIds.length > 0) {
      const { data: ins } = await supabase
        .from('insurers').select('id, name').in('id', insurerIds)
      ;(ins || []).forEach(i => { insurerMap[i.id] = i.name })
    }

    let combined = (jobData || []).map(job => ({
      ...job,
      vehicle: vehicleMap[job.vehicle_id] || null,
      insurer: insurerMap[job.insurer_id] || null,
    }))

    // Client-side search filter (job_number, registration, owner_name)
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase()
      combined = combined.filter(job =>
        job.job_number?.toLowerCase().includes(q) ||
        job.vehicle?.registration?.toLowerCase().includes(q) ||
        job.vehicle?.owner_name?.toLowerCase().includes(q)
      )
    }

    setJobs(combined)
    setTotal(count || 0)
    setLoading(false)
  }, [branchId, statusFilter, priorityFilter, sortField, sortDir, page, debouncedSearch])
  // NOTE: insurers intentionally NOT in deps

  useEffect(() => { fetchJobs() }, [fetchJobs])

  // SECTION: Sort handler
  function handleSort(field) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
    setPage(1)
  }

  // SECTION: Clear filters
  function clearFilters() {
    setSearch('')
    setStatusFilter('')
    setPriorityFilter('')
    setPage(1)
  }

  const hasFilters = search || statusFilter || priorityFilter
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // SECTION: Render
  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Jobs</h1>
        <button onClick={() => navigate('/main/jobs/new')}
          className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Check-In
        </button>
      </div>

      {/* SECTION: Filters */}
      <div className="card p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Job number, registration, owner…"
              className="input-field pl-9"
            />
          </div>

          {/* Status filter */}
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="input-field w-auto">
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Priority filter */}
          <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1) }}
            className="input-field w-auto">
            <option value="">All Priorities</option>
            {[1,2,3,4,5].map(p => <option key={p} value={p}>Priority {p}</option>)}
          </select>

          {/* Clear */}
          {hasFilters && (
            <button onClick={clearFilters}
              className="btn-secondary flex items-center gap-1.5 text-sm">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* SECTION: Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {loading ? 'Loading…' : `${total} job${total !== 1 ? 's' : ''}`}
          </p>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 font-medium">No jobs found</p>
            {hasFilters && (
              <button onClick={clearFilters} className="text-brand-600 text-sm mt-2 hover:underline">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <SortHeader label="Job #"       field="job_number"   sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortHeader label="Vehicle"     field="vehicle_id"   sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Owner</th>
                    <SortHeader label="Status"      field="status"       sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortHeader label="Priority"    field="priority"     sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Insurer</th>
                    <SortHeader label="Check-In"    field="check_in_date" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {jobs.map(job => {
                    const sc = STATUS_CONFIG[job.status] || { bg: 'bg-gray-100', text: 'text-gray-600' }
                    const statusLabel = STATUS_OPTIONS.find(s => s.value === job.status)?.label || job.status
                    return (
                      <tr key={job.id} onClick={() => navigate(`/main/jobs/${job.id}`)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors duration-100">
                        <td className="px-4 py-3.5">
                          <span className="font-mono font-bold text-brand-600">{job.job_number}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-gray-900">{job.vehicle?.registration || '—'}</p>
                          <p className="text-gray-400 text-xs">{job.vehicle?.make} {job.vehicle?.model}</p>
                          {job.check_in_date && job.estimated_completion &&
                           new Date(job.estimated_completion) < new Date() &&
                           !['ready_for_collection','released','collected'].includes(job.status) && (
                            <span className="inline-flex items-center gap-1 text-red-600
                                             text-xs font-semibold mt-0.5">
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                              Overdue
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-gray-600">{job.vehicle?.owner_name || '—'}</td>
                        <td className="px-4 py-3.5">
                          <span className={`badge ${sc.bg} ${sc.text}`}>{statusLabel}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${PRIORITY_COLOURS[job.priority] || 'bg-gray-300'}`} />
                            <span className="text-gray-500 text-xs">{job.priority}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-gray-500 text-xs hidden lg:table-cell">
                          {job.insurer || <span className="text-gray-300">Private</span>}
                        </td>
                        <td className="px-4 py-3.5 text-gray-400 text-xs">
                          {job.check_in_date ? new Date(job.check_in_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-brand-600 text-xs font-medium hover:underline">View</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="btn-secondary text-sm disabled:opacity-40 py-1.5">← Prev</button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="btn-secondary text-sm disabled:opacity-40 py-1.5">Next →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

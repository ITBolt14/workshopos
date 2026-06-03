// src/portals/main/pages/Dashboard.jsx
// Main dashboard — stat cards with live counts, recent jobs table, quick actions.
// Each stat card fetches its own count independently.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, Wrench, CheckCircle2, LogIn,
  Plus, MonitorCheck, TrendingUp, Clock, RefreshCw,
  Copy, Check, Smartphone
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'

// SECTION: Status badge config
const STATUS_CONFIG = {
  checked_in:           { label: 'Checked In',           bg: 'bg-blue-100',    text: 'text-blue-700'    },
  authorized:           { label: 'Authorized',            bg: 'bg-indigo-100',  text: 'text-indigo-700'  },
  in_progress:          { label: 'In Progress',           bg: 'bg-amber-100',   text: 'text-amber-700'   },
  quality_check:        { label: 'Quality Check',         bg: 'bg-purple-100',  text: 'text-purple-700'  },
  awaiting_parts:       { label: 'Awaiting Parts',        bg: 'bg-orange-100',  text: 'text-orange-700'  },
  ready_for_collection: { label: 'Ready for Collection',  bg: 'bg-green-100',   text: 'text-green-700'   },
  collected:            { label: 'Collected',             bg: 'bg-gray-100',    text: 'text-gray-600'    },
  on_hold:              { label: 'On Hold',               bg: 'bg-red-100',     text: 'text-red-700'     },
}

// SECTION: Priority dot colours
const PRIORITY_COLOURS = {
  1: 'bg-gray-300',
  2: 'bg-blue-400',
  3: 'bg-amber-400',
  4: 'bg-orange-500',
  5: 'bg-red-500',
}

// SECTION: Stat card component
function StatCard({ icon: Icon, label, value, colour, loading, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`card text-left w-full transition-all duration-200
                  hover:shadow-md hover:-translate-y-0.5 active:translate-y-0
                  ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colour}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <TrendingUp className="w-4 h-4 text-gray-300" />
      </div>
      <div>
        {loading ? (
          <div className="h-8 w-16 bg-gray-100 rounded-lg animate-pulse mb-1" />
        ) : (
          <p className="font-display text-3xl font-bold text-gray-900 leading-none mb-1">
            {value ?? '—'}
          </p>
        )}
        <p className="text-sm text-gray-500 font-medium">{label}</p>
      </div>
    </button>
  )
}

// SECTION: Status badge
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`badge ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
  )
}

// SECTION: Workshop setup card — shows code + URL for tablet setup
function WorkshopSetupCard({ branch }) {
  const [codeCopied, setCodeCopied] = useState(false)
  const [urlCopied,  setUrlCopied]  = useState(false)

  if (!branch?.id || !branch?.workshop_code) return null

  const workshopUrl = `${window.location.origin}/workshop/login`

  function copyCode() {
    navigator.clipboard.writeText(branch.workshop_code).then(() => {
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 3000)
    })
  }

  function copyUrl() {
    navigator.clipboard.writeText(workshopUrl).then(() => {
      setUrlCopied(true)
      setTimeout(() => setUrlCopied(false), 3000)
    })
  }

  return (
    <div className="card border-brand-200 bg-brand-50 mb-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center
                        justify-center flex-shrink-0">
          <Smartphone className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-brand-900 text-sm mb-0.5">
            Workshop Tablet Setup
          </h3>
          <p className="text-brand-700 text-xs mb-4">
            On the workshop tablet or phone, open the URL below and bookmark it.
            Technicians enter the workshop code then their PIN to log in.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Workshop code */}
            <div className="bg-white border border-brand-200 rounded-xl p-3">
              <p className="text-brand-600 text-xs font-semibold uppercase
                            tracking-wider mb-2">Workshop Code</p>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-brand-900 text-xl font-black tracking-widest">
                  {branch.workshop_code}
                </span>
                <button onClick={copyCode}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs
                              font-semibold transition-all duration-200
                              ${codeCopied
                                ? 'bg-green-600 text-white'
                                : 'bg-brand-600 hover:bg-brand-700 text-white'
                              }`}>
                  {codeCopied
                    ? <><Check className="w-3 h-3" /> Copied</>
                    : <><Copy className="w-3 h-3" /> Copy</>
                  }
                </button>
              </div>
              <p className="text-brand-500 text-xs mt-1">
                Share this code with your technicians
              </p>
            </div>

            {/* Workshop URL */}
            <div className="bg-white border border-brand-200 rounded-xl p-3">
              <p className="text-brand-600 text-xs font-semibold uppercase
                            tracking-wider mb-2">Workshop URL</p>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-brand-800 text-xs truncate">
                  {workshopUrl}
                </span>
                <button onClick={copyUrl}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs
                              font-semibold transition-all duration-200 flex-shrink-0
                              ${urlCopied
                                ? 'bg-green-600 text-white'
                                : 'bg-brand-600 hover:bg-brand-700 text-white'
                              }`}>
                  {urlCopied
                    ? <><Check className="w-3 h-3" /> Copied</>
                    : <><Copy className="w-3 h-3" /> Copy</>
                  }
                </button>
              </div>
              <p className="text-brand-500 text-xs mt-1">
                Bookmark on the workshop tablet
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// SECTION: Main Dashboard component
export default function Dashboard() {
  const { branch: authBranch, profile, isFullAccess } = useAuth()

  // Fetch branch directly so workshop_code changes in Settings reflect immediately
  // AuthContext caches branch on login — this ensures the dashboard always shows current data
  const [liveBranch, setLiveBranch] = useState(null)
  useEffect(() => {
    const id = authBranch?.id || profile?.branch_id
    if (!id) return
    supabase.from('branches').select('*').eq('id', id).maybeSingle()
      .then(({ data }) => { if (data) setLiveBranch(data) })
  }, [authBranch?.id, profile?.branch_id])

  const branch = liveBranch || authBranch
  const navigate   = useNavigate()

  // SECTION: Stat counts — each fetched independently
  const [counts,       setCounts]       = useState({ active: null, inProgress: null, ready: null, checkedInToday: null })
  const [countsLoading, setCountsLoading] = useState(true)

  // SECTION: Recent jobs
  const [recentJobs,   setRecentJobs]   = useState([])
  const [jobsLoading,  setJobsLoading]  = useState(true)

  const [lastUpdated,  setLastUpdated]  = useState(null)

  // SECTION: Fetch all dashboard data
  // Uses profile.branch_id as fallback if branch object not yet loaded
  const branchId = branch?.id || profile?.branch_id

  async function fetchDashboard() {
    if (!branchId) return

    setCountsLoading(true)
    setJobsLoading(true)

    const today = new Date().toISOString().split('T')[0]

    const [activeRes, inProgressRes, readyRes, todayRes, recentRes] = await Promise.all([
      // Total active jobs (not collected or on_hold)
      supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', branchId)
        .not('status', 'in', '(collected,on_hold)'),

      // In progress
      supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', branchId)
        .eq('status', 'in_progress'),

      // Ready for collection
      supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', branchId)
        .eq('status', 'ready_for_collection'),

      // Checked in today
      supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', branchId)
        .eq('check_in_date', today),

      // Recent jobs — last 10
      supabase
        .from('jobs')
        .select('id, job_number, status, priority, check_in_date, vehicle_id, insurer_id')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    setCounts({
      active:        activeRes.count ?? 0,
      inProgress:    inProgressRes.count ?? 0,
      ready:         readyRes.count ?? 0,
      checkedInToday: todayRes.count ?? 0,
    })
    setCountsLoading(false)

    // Fetch vehicle data for recent jobs
    if (recentRes.data?.length > 0) {
      const vehicleIds = [...new Set(recentRes.data.map(j => j.vehicle_id).filter(Boolean))]
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('id, registration, make, model, owner_name')
        .in('id', vehicleIds)

      const vehicleMap = {}
      ;(vehicles || []).forEach(v => { vehicleMap[v.id] = v })

      // Fetch insurer names
      const insurerIds = [...new Set(recentRes.data.map(j => j.insurer_id).filter(Boolean))]
      const insurerMap = {}
      if (insurerIds.length > 0) {
        const { data: insurers } = await supabase
          .from('insurers')
          .select('id, name')
          .in('id', insurerIds)
        ;(insurers || []).forEach(i => { insurerMap[i.id] = i.name })
      }

      const combined = recentRes.data.map(job => ({
        ...job,
        vehicle:  vehicleMap[job.vehicle_id]  || null,
        insurer:  insurerMap[job.insurer_id]  || null,
      }))
      setRecentJobs(combined)
    } else {
      setRecentJobs([])
    }

    setJobsLoading(false)
    setLastUpdated(new Date())
  }

  // Re-fetch whenever branchId becomes available (handles return from workshop portal)
  useEffect(() => {
    if (branchId) fetchDashboard()
  }, [branchId]) // eslint-disable-line react-hooks/exhaustive-deps

  // SECTION: Greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // SECTION: Render
  return (
    <div className="h-full overflow-y-auto p-6 max-w-7xl mx-auto animate-fade-in">

      {/* SECTION: Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title mb-0.5">{greeting}</h1>
          <p className="text-gray-400 text-sm">
            {lastUpdated
              ? `Last updated ${lastUpdated.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`
              : 'Loading dashboard…'
            }
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* SECTION: Workshop URL card — only shown to full access roles */}
      {isFullAccess && <WorkshopSetupCard branch={branch} />}

      {/* SECTION: Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={ClipboardList}
          label="Total Active Jobs"
          value={counts.active}
          colour="bg-brand-600"
          loading={countsLoading}
          onClick={() => navigate('/main/jobs')}
        />
        <StatCard
          icon={Wrench}
          label="In Progress"
          value={counts.inProgress}
          colour="bg-amber-500"
          loading={countsLoading}
          onClick={() => navigate('/main/jobs')}
        />
        <StatCard
          icon={CheckCircle2}
          label="Ready for Collection"
          value={counts.ready}
          colour="bg-green-600"
          loading={countsLoading}
          onClick={() => navigate('/main/jobs')}
        />
        <StatCard
          icon={LogIn}
          label="Checked In Today"
          value={counts.checkedInToday}
          colour="bg-indigo-500"
          loading={countsLoading}
        />
      </div>

      {/* SECTION: Quick actions */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={() => navigate('/main/jobs/new')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Check-In
        </button>
        <button
          onClick={() => navigate('/main/monitor')}
          className="btn-secondary flex items-center gap-2"
        >
          <MonitorCheck className="w-4 h-4" />
          Floor Monitor
        </button>
      </div>

      {/* SECTION: Recent jobs table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <h2 className="section-heading">Recent Jobs</h2>
          </div>
          <button
            onClick={() => navigate('/main/jobs')}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium
                       transition-colors duration-150"
          >
            View all
          </button>
        </div>

        {jobsLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : recentJobs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No jobs yet</p>
            <p className="text-gray-400 text-sm mt-1">
              Check in your first vehicle to get started
            </p>
            <button
              onClick={() => navigate('/main/jobs/new')}
              className="btn-primary mt-4 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Check-In
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Job
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Vehicle
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">
                    Owner
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                    Insurer
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                    Priority
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                    Check-In
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentJobs.map(job => (
                  <tr
                    key={job.id}
                    onClick={() => navigate(`/main/jobs/${job.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors duration-100"
                  >
                    <td className="px-6 py-3.5">
                      <span className="font-mono font-bold text-brand-600 text-sm">
                        {job.job_number}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div>
                        <p className="font-bold text-gray-900">{job.vehicle?.registration || '—'}</p>
                        <p className="text-gray-400 text-xs">
                          {job.vehicle?.make} {job.vehicle?.model}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 hidden md:table-cell">
                      {job.vehicle?.owner_name || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-gray-500 text-xs hidden lg:table-cell">
                      {job.insurer || <span className="text-gray-300">Private</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${PRIORITY_COLOURS[job.priority] || 'bg-gray-300'}`} />
                        <span className="text-gray-500 text-xs">{job.priority}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-400 text-xs hidden lg:table-cell">
                      {job.check_in_date
                        ? new Date(job.check_in_date).toLocaleDateString('en-ZA', {
                            day: 'numeric', month: 'short'
                          })
                        : '—'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}

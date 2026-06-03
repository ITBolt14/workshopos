// src/portals/workshop/pages/WorkshopHome.jsx
// Job search screen for workshop technicians.
// On-screen QWERTY keyboard — native device keyboard must NEVER appear.
// Searches jobs by job_number and vehicle registration.

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, LogOut, Delete, ChevronRight } from 'lucide-react'
import { supabaseWorkshop as supabase } from '../../../lib/supabaseWorkshop'
import { getWorkshopUser, clearWorkshopUser } from '../WorkshopPortal'

// SECTION: Job status config
const STATUS_CONFIG = {
  checked_in:          { label: 'Checked In',          bg: 'bg-blue-900/60',   text: 'text-blue-300',   border: 'border-blue-700' },
  authorized:          { label: 'Authorized',           bg: 'bg-indigo-900/60', text: 'text-indigo-300', border: 'border-indigo-700' },
  in_progress:         { label: 'In Progress',          bg: 'bg-amber-900/60',  text: 'text-amber-300',  border: 'border-amber-700' },
  quality_check:       { label: 'Quality Check',        bg: 'bg-purple-900/60', text: 'text-purple-300', border: 'border-purple-700' },
  awaiting_parts:      { label: 'Awaiting Parts',       bg: 'bg-orange-900/60', text: 'text-orange-300', border: 'border-orange-700' },
  ready_for_collection:{ label: 'Ready for Collection', bg: 'bg-green-900/60',  text: 'text-green-300',  border: 'border-green-700' },
}

// SECTION: On-screen keyboard layout
const KB_ROWS = [
  ['1','2','3','4','5','6','7','8','9','0'],
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M'],
]

function OnScreenKeyboard({ onKey, onBackspace, onSearch, disabled }) {
  return (
    <div className="w-full max-w-2xl mx-auto px-2 pb-4 space-y-2">
      {KB_ROWS.map((row, ri) => (
        <div key={ri} className="flex justify-center gap-1.5">
          {row.map(key => (
            <button
              key={key}
              onPointerDown={e => { e.preventDefault(); onKey(key) }}
              disabled={disabled}
              className="h-12 min-w-[2.4rem] flex-1 max-w-[3rem]
                         bg-gray-800 hover:bg-gray-700 active:bg-brand-700
                         border border-gray-700 rounded-lg
                         text-white font-mono text-sm font-semibold
                         transition-all duration-100 active:scale-95
                         disabled:opacity-40 select-none"
            >
              {key}
            </button>
          ))}
        </div>
      ))}

      {/* Bottom row: SPACE | BACKSPACE | SEARCH */}
      <div className="flex gap-2 mt-1">
        <button
          onPointerDown={e => { e.preventDefault(); onKey(' ') }}
          disabled={disabled}
          className="flex-1 h-12 bg-gray-800 hover:bg-gray-700 active:bg-gray-600
                     border border-gray-700 rounded-lg text-gray-400 text-sm font-medium
                     transition-all duration-100 active:scale-95 disabled:opacity-40 select-none"
        >
          SPACE
        </button>
        <button
          onPointerDown={e => { e.preventDefault(); onBackspace() }}
          disabled={disabled}
          className="w-24 h-12 bg-gray-800 hover:bg-gray-700 active:bg-gray-600
                     border border-gray-700 rounded-lg text-gray-300
                     flex items-center justify-center
                     transition-all duration-100 active:scale-95 disabled:opacity-40 select-none"
          aria-label="Backspace"
        >
          <Delete className="w-5 h-5" />
        </button>
        <button
          onPointerDown={e => { e.preventDefault(); onSearch() }}
          disabled={disabled}
          className="w-28 h-12 bg-brand-600 hover:bg-brand-700 active:bg-brand-800
                     rounded-lg text-white text-sm font-bold
                     flex items-center justify-center gap-2
                     transition-all duration-100 active:scale-95 disabled:opacity-40 select-none"
        >
          <Search className="w-4 h-4" />
          SEARCH
        </button>
      </div>
    </div>
  )
}

// SECTION: Job result card
function JobCard({ job, onSelect }) {
  const status = STATUS_CONFIG[job.status] || STATUS_CONFIG.checked_in
  return (
    <button
      onClick={() => onSelect(job)}
      className="w-full text-left bg-gray-800 hover:bg-gray-750 active:bg-gray-700
                 border border-gray-700 hover:border-gray-600
                 rounded-2xl p-4 transition-all duration-150 active:scale-98
                 flex items-center justify-between gap-4 animate-slide-up"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <span className="font-mono text-brand-400 font-bold text-base">
            {job.job_number}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                            ${status.bg} ${status.text} ${status.border}`}>
            {status.label}
          </span>
        </div>
        <p className="text-white font-bold text-lg leading-tight">
          {job.vehicles?.registration}
        </p>
        <p className="text-gray-400 text-sm">
          {job.vehicles?.make} {job.vehicles?.model}
          {job.vehicles?.year ? ` · ${job.vehicles.year}` : ''}
        </p>
        {job.vehicles?.owner_name && (
          <p className="text-gray-500 text-xs mt-0.5">{job.vehicles.owner_name}</p>
        )}
      </div>
      <ChevronRight className="w-5 h-5 text-gray-600 flex-shrink-0" />
    </button>
  )
}

// SECTION: Main WorkshopHome component
export default function WorkshopHome() {
  const navigate   = useNavigate()
  const user       = getWorkshopUser()

  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState([])
  const [searched, setSearched] = useState(false)
  const [loading,  setLoading]  = useState(false)

  // SECTION: Sign out
  function handleSignOut() {
    clearWorkshopUser()
    navigate('/workshop/login', { replace: true })
  }

  // SECTION: Keyboard handlers — use onPointerDown to prevent native keyboard
  function handleKey(key) {
    setQuery(q => q + key)
  }

  function handleBackspace() {
    setQuery(q => q.slice(0, -1))
  }

  // SECTION: Search handler
  // Uses SECURITY DEFINER RPC functions — bypasses RLS for anon workshop portal users.
  const handleSearch = useCallback(async () => {
    const q = query.trim()
    if (!q) return

    setLoading(true)
    setSearched(false)
    setResults([])

    try {
      // Search vehicles and jobs by job_number in parallel
      const [vehicleRes, jobRes] = await Promise.all([
        supabase.rpc('search_workshop_vehicles', {
          p_branch_id: user.branch_id,
          p_query:     q,
        }),
        supabase.rpc('search_workshop_jobs', {
          p_branch_id: user.branch_id,
          p_query:     q,
        }),
      ])

      // Build vehicle map from vehicle search results
      const vehicleMap = {}
      ;(vehicleRes.data || []).forEach(v => { vehicleMap[v.id] = v })

      // Get jobs from job search
      let jobs = jobRes.data || []

      // Also find jobs matching searched vehicles by vehicle_id
      if (vehicleRes.data?.length > 0) {
        const vehicleIds = vehicleRes.data.map(v => v.id)
        const { data: jobsByVehicle } = await supabase.rpc('search_workshop_jobs_by_vehicle', {
          p_branch_id:  user.branch_id,
          p_vehicle_ids: vehicleIds,
        })
        // Merge, deduplicating by id
        const existingIds = new Set(jobs.map(j => j.id))
        ;(jobsByVehicle || []).forEach(j => {
          if (!existingIds.has(j.id)) jobs.push(j)
        })
      }

      // Fetch vehicle details for any jobs not already in vehicleMap
      const missingIds = [...new Set(jobs.map(j => j.vehicle_id).filter(id => id && !vehicleMap[id]))]
      if (missingIds.length > 0) {
        const { data: extraVehicles } = await supabase.rpc('search_workshop_vehicles_by_ids', {
          p_ids: missingIds,
        })
        ;(extraVehicles || []).forEach(v => { vehicleMap[v.id] = v })
      }

      const combined = jobs.map(job => ({
        ...job,
        vehicles: vehicleMap[job.vehicle_id] || null,
      }))

      setResults(combined)
    } catch (err) {
      console.error('[WorkshopHome] Search error:', err)
      setResults([])
    }

    setLoading(false)
    setSearched(true)
  }, [query, user.branch_id])

  // SECTION: Navigate to correct screen based on role
  // Tier 1 users → job view (stage history + notes)
  // Tier 2 users → job clocking screen
  function handleSelectJob(job) {
    const isTier1 = !!user?.tier1_role
    if (isTier1) {
      navigate(`/workshop/view/${job.id}`)
    } else {
      navigate(`/workshop/job/${job.id}`)
    }
  }

  // SECTION: Role display
  const roleLabel = user?.workshop_role?.name
    || user?.tier2_role?.replace(/_/g, ' ')
    || user?.tier1_role?.replace(/_/g, ' ')
    || 'Staff'

  const roleColour = user?.workshop_role?.colour || '6366f1'

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col select-none"
      style={{
        backgroundImage: `radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.08) 0%, transparent 50%)`,
      }}
    >

      {/* SECTION: Top bar */}
      <div className="flex items-center justify-between px-4 py-3
                      bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div>
          <p className="text-white font-semibold text-base leading-tight">
            {user?.full_name}
          </p>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: `#${roleColour}25`,
              color:           `#${roleColour}`,
              border:          `1px solid #${roleColour}50`,
            }}
          >
            {roleLabel}
          </span>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-gray-400 hover:text-white
                     bg-gray-800 hover:bg-gray-700 border border-gray-700
                     px-3 py-2 rounded-xl text-sm font-medium
                     transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* SECTION: Search display bar */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl
                        px-4 py-3 flex items-center gap-3">
          <Search className="w-5 h-5 text-gray-500 flex-shrink-0" />
          <span className={`flex-1 font-mono text-lg tracking-wider ${
            query ? 'text-white' : 'text-gray-600'
          }`}>
            {query || 'Job number or registration…'}
          </span>
          {loading && (
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent
                            rounded-full animate-spin flex-shrink-0" />
          )}
        </div>
      </div>

      {/* SECTION: Results area */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {searched && results.length === 0 && !loading && (
          <div className="text-center py-10 animate-fade-in">
            <p className="text-gray-500 text-base font-medium">No jobs found</p>
            <p className="text-gray-600 text-sm mt-1">
              Try a different job number or registration
            </p>
          </div>
        )}

        {results.map(job => (
          <JobCard key={job.id} job={job} onSelect={handleSelectJob} />
        ))}

        {!searched && results.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-600 text-sm">
              Type a job number or vehicle registration to search
            </p>
          </div>
        )}
      </div>

      {/* SECTION: On-screen keyboard — always visible at bottom */}
      <div className="bg-gray-900 border-t border-gray-800 pt-3 flex-shrink-0">
        <OnScreenKeyboard
          onKey={handleKey}
          onBackspace={handleBackspace}
          onSearch={handleSearch}
          disabled={loading}
        />
      </div>

    </div>
  )
}

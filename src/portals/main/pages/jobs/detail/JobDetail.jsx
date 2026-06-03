// src/portals/main/pages/jobs/detail/JobDetail.jsx
// Job detail page container — fetches job data and renders tabs.

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { supabase } from '../../../../../lib/supabase'
import { useAuth } from '../../../../../hooks/useAuth'
import JobDetailHeader from './JobDetailHeader'
import TabOverview    from './TabOverview'
import TabClaim       from './TabClaim'
import TabStages      from './TabStages'
import TabNotes       from './TabNotes'
import TabAudit       from './TabAudit'

// SECTION: Tab config
const TABS = [
  { id: 'overview',  label: 'Overview'      },
  { id: 'claim',     label: 'Claim Details' },
  { id: 'stages',    label: 'Stages'        },
  { id: 'notes',     label: 'Notes'         },
  { id: 'audit',     label: 'Audit Log'     },
  { id: 'estimating',label: 'Estimating'    },
]

export default function JobDetail() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { profile, branch } = useAuth()

  // SECTION: State
  const [job,      setJob]      = useState(null)
  const [vehicle,  setVehicle]  = useState(null)
  const [claim,    setClaim]    = useState(null)
  const [insurer,  setInsurer]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [editMode, setEditMode] = useState(false)

  // SECTION: Fetch job
  const fetchJob = useCallback(async () => {
    const { data: jobData, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !jobData) {
      toast.error('Job not found')
      navigate('/main/jobs')
      return
    }

    setJob(jobData)

    // Fetch related data in parallel
    const promises = [
      jobData.vehicle_id
        ? supabase.from('vehicles').select('*').eq('id', jobData.vehicle_id).single()
        : Promise.resolve({ data: null }),
      jobData.insurer_id
        ? supabase.from('insurers').select('*').eq('id', jobData.insurer_id).single()
        : Promise.resolve({ data: null }),
      supabase.from('job_claims').select('*').eq('job_id', id).maybeSingle(),
    ]

    const [vehicleRes, insurerRes, claimRes] = await Promise.all(promises)
    setVehicle(vehicleRes.data)
    setInsurer(insurerRes.data)
    setClaim(claimRes.data)
    setLoading(false)
  }, [id, navigate])

  useEffect(() => { fetchJob() }, [fetchJob])

  // SECTION: Status change
  async function handleStatusChange(newStatus) {
    const { error } = await supabase
      .from('jobs')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) { toast.error('Failed to update status'); return }

    // Write audit log
    await supabase.from('audit_log').insert({
      branch_id: branch.id, user_id: profile.id, portal: 'main',
      action: `Status changed to ${newStatus}`, table_name: 'jobs',
      record_id: id,
      old_value: { status: job.status },
      new_value: { status: newStatus },
    })

    setJob(j => ({ ...j, status: newStatus }))
    toast.success('Status updated')
  }

  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-6 space-y-4">
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  // SECTION: Render
  return (
    <div className="animate-fade-in flex flex-col h-full">

      {/* Header */}
      <JobDetailHeader
        job={job}
        vehicle={vehicle}
        insurer={insurer}
        editMode={editMode}
        onEditToggle={() => setEditMode(e => !e)}
        onStatusChange={handleStatusChange}
        onRefresh={fetchJob}
      />

      {/* SECTION: Tabs */}
      <div className="border-b border-gray-200 bg-white px-6">
        <div className="flex gap-0 -mb-px">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all duration-150
                          ${activeTab === tab.id
                            ? 'border-brand-600 text-brand-700'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION: Tab content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-5xl">
        {activeTab === 'overview'  && <TabOverview  job={job} vehicle={vehicle} insurer={insurer} editMode={editMode} onSaved={fetchJob} onEditOff={() => setEditMode(false)} />}
        {activeTab === 'claim'     && <TabClaim     job={job} claim={claim} editMode={editMode} onSaved={fetchJob} onEditOff={() => setEditMode(false)} />}
        {activeTab === 'stages'    && <TabStages    job={job} onJobUpdated={fetchJob} />}
        {activeTab === 'notes'     && <TabNotes     job={job} />}
        {activeTab === 'audit'     && <TabAudit     jobId={id} />}
        {activeTab === 'estimating' && (
          <div className="card text-center py-12">
            <p className="text-gray-400 font-medium">No estimate yet</p>
            <p className="text-gray-400 text-sm mt-1">Estimating module coming in a future update</p>
          </div>
        )}
      </div>

    </div>
  )
}

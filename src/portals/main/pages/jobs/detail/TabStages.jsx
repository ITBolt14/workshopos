// src/portals/main/pages/jobs/detail/TabStages.jsx
// Stage management with manual controls, QC sign-off, and clocking history.

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { CheckCheck, Play, SkipForward, Lock, User, Zap, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../../../../lib/supabase'
import { useAuth } from '../../../../../hooks/useAuth'

function formatDuration(mins) {
  if (!mins) return null
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const STATUS_COLOURS = {
  pending:  'bg-gray-100 border-gray-200',
  active:   'bg-blue-50 border-blue-200',
  complete: 'bg-green-50 border-green-200',
  skipped:  'bg-gray-50 border-gray-200 opacity-60',
}

export default function TabStages({ job, onJobUpdated }) {
  const { profile, branch, isFullAccess, isQualityController } = useAuth()
  const [stages,   setStages]   = useState([])
  const [clocking, setClocking] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [acting,   setActing]   = useState(null)

  const fetchStages = useCallback(async () => {
    const [stagesRes, clockingRes] = await Promise.all([
      supabase.from('job_stages').select('*').eq('job_id', job.id).order('sort_order'),
      supabase.from('workshop_clocking')
        .select('id, job_stage_id, technician_id, clocked_on_at, clocked_off_at, duration_minutes, auto_clocked_off')
        .eq('job_id', job.id)
        .order('clocked_on_at', { ascending: false }),
    ])

    setStages(stagesRes.data || [])

    // Fetch technician names
    const techIds = [...new Set((clockingRes.data || []).map(s => s.technician_id))]
    const techMap = {}
    if (techIds.length > 0) {
      const { data: techs } = await supabase
        .rpc('lookup_technician_names', { p_ids: techIds })
      ;(techs || []).forEach(t => { techMap[t.id] = t.full_name })
    }

    setClocking((clockingRes.data || []).map(s => ({
      ...s, techName: techMap[s.technician_id] || 'Technician'
    })))
    setLoading(false)
  }, [job.id])

  useEffect(() => { fetchStages() }, [fetchStages])

  async function handleAction(stage, action) {
    setActing(stage.id + action)
    let error

    if (action === 'activate') {
      const { error: e } = await supabase.from('job_stages')
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('id', stage.id)
      error = e

      if (!e) {
        await supabase.from('workshop_clocking').insert({
          branch_id:     branch.id,
          job_id:        job.id,
          job_stage_id:  stage.id,
          technician_id: profile.id,
          clocked_on_at: new Date().toISOString(),
        })
        await supabase.from('audit_log').insert({
          branch_id: branch.id, user_id: profile.id, portal: 'main',
          action: `Stage activated: ${stage.name}`,
          table_name: 'job_stages', record_id: job.id,
        })
      }
    } else if (action === 'complete') {
      const { error: e } = await supabase.from('job_stages')
        .update({ status: 'complete', completed_at: new Date().toISOString() })
        .eq('id', stage.id)
      error = e
      if (!e) {
        await supabase.from('audit_log').insert({
          branch_id: branch.id, user_id: profile.id, portal: 'main',
          action: `Stage completed: ${stage.name}`,
          table_name: 'job_stages', record_id: job.id,
        })
      }
    } else if (action === 'skip') {
      const { error: e } = await supabase.from('job_stages')
        .update({ status: 'skipped' })
        .eq('id', stage.id)
      error = e
      if (!e) {
        await supabase.from('audit_log').insert({
          branch_id: branch.id, user_id: profile.id, portal: 'main',
          action: `Stage skipped: ${stage.name}`,
          table_name: 'job_stages', record_id: job.id,
        })
      }
    } else if (action === 'signoff') {
      // Mark complete + trigger final QC if last quality stage
      const { error: e } = await supabase.from('job_stages')
        .update({ status: 'complete', completed_at: new Date().toISOString() })
        .eq('id', stage.id)
      error = e

      if (!e) {
        // Close any open clocking session for this stage
        await supabase.from('workshop_clocking')
          .update({
            clocked_off_at:   new Date().toISOString(),
            auto_clocked_off: false,
            off_reason:       'manual',
          })
          .eq('job_stage_id', stage.id)
          .is('clocked_off_at', null)

        await supabase.from('audit_log').insert({
          branch_id: branch.id, user_id: profile.id, portal: 'main',
          action: `QC signed off: ${stage.name}`,
          table_name: 'job_stages', record_id: stage.id,
        })
      }
    }

    setActing(null)
    if (error) { toast.error('Action failed: ' + error.message); return }

    toast.success('Stage updated')
    await fetchStages()
    onJobUpdated()
  }

  if (loading) return <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>

  const canQC = isFullAccess || isQualityController

  return (
    <div className="space-y-3 animate-fade-in">
      {stages.map(stage => {
        const sessionHistory = clocking.filter(s => s.job_stage_id === stage.id && s.clocked_off_at)
        const activeSession  = clocking.find(s => s.job_stage_id === stage.id && !s.clocked_off_at)
        const isQualityStage = stage.department_group === 'quality'
        const isFinalQC      = stage.name.toLowerCase().includes('final quality')

        return (
          <div key={stage.id}
            className={`border rounded-2xl p-4 transition-all duration-200 ${STATUS_COLOURS[stage.status] || STATUS_COLOURS.pending}`}>

            {/* Stage header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-400 w-5">{stage.sort_order}</span>
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: `#${stage.colour || '6366f1'}` }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-semibold text-sm ${
                      stage.status === 'complete' ? 'text-green-800' :
                      stage.status === 'active'   ? 'text-blue-800'  :
                      stage.status === 'skipped'  ? 'text-gray-400 line-through' :
                      'text-gray-800'
                    }`}>
                      {stage.name}
                    </p>
                    {stage.system_stage && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> System
                      </span>
                    )}
                    {activeSession && (
                      <span className="flex items-center gap-1 text-xs text-blue-600">
                        <Zap className="w-3 h-3" />
                        {activeSession.techName} clocked on
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                    {stage.started_at && <span>Started {new Date(stage.started_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}</span>}
                    {stage.completed_at && <span>· Completed {new Date(stage.completed_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}</span>}
                    {stage.duration_minutes && <span>· {formatDuration(stage.duration_minutes)}</span>}
                  </div>
                </div>
              </div>

              {/* SECTION: Action buttons */}
              {!stage.system_stage && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  {stage.status === 'pending' && (
                    <>
                      <button onClick={() => handleAction(stage, 'activate')}
                        disabled={acting === stage.id + 'activate'}
                        className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700
                                   text-white px-2.5 py-1.5 rounded-lg transition-colors duration-150
                                   disabled:opacity-50">
                        <Play className="w-3 h-3" /> Activate
                      </button>
                      <button onClick={() => handleAction(stage, 'skip')}
                        disabled={acting === stage.id + 'skip'}
                        className="flex items-center gap-1.5 text-xs bg-gray-200 hover:bg-gray-300
                                   text-gray-600 px-2.5 py-1.5 rounded-lg transition-colors duration-150
                                   disabled:opacity-50">
                        <SkipForward className="w-3 h-3" /> Skip
                      </button>
                    </>
                  )}
                  {stage.status === 'active' && !isQualityStage && (
                    <button onClick={() => handleAction(stage, 'complete')}
                      disabled={acting === stage.id + 'complete'}
                      className="flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-700
                                 text-white px-2.5 py-1.5 rounded-lg transition-colors duration-150
                                 disabled:opacity-50">
                      <CheckCheck className="w-3 h-3" /> Mark Complete
                    </button>
                  )}
                  {stage.status === 'active' && isQualityStage && canQC && !isFinalQC && (
                    <button onClick={() => handleAction(stage, 'signoff')}
                      disabled={acting === stage.id + 'signoff'}
                      className="flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-700
                                 text-white px-2.5 py-1.5 rounded-lg transition-colors duration-150
                                 disabled:opacity-50">
                      <CheckCircle2 className="w-3 h-3" /> Sign Off
                    </button>
                  )}
                  {stage.status === 'active' && isFinalQC && canQC && (
                    <button onClick={() => handleAction(stage, 'signoff')}
                      disabled={acting === stage.id + 'signoff'}
                      className="flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-700
                                 text-white px-4 py-2 rounded-lg font-semibold
                                 transition-colors duration-150 disabled:opacity-50">
                      <CheckCircle2 className="w-4 h-4" /> Sign Off & Release
                    </button>
                  )}
                  {stage.status === 'complete' && (
                    <CheckCheck className="w-4 h-4 text-green-500" />
                  )}
                </div>
              )}
              {stage.system_stage && <Lock className="w-4 h-4 text-gray-300 flex-shrink-0" />}
            </div>

            {/* Clocking history */}
            {sessionHistory.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                {sessionHistory.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-xs text-gray-500">
                    <User className="w-3 h-3 text-gray-400" />
                    <span className="font-medium">{s.techName}</span>
                    <span>·</span>
                    <span>{new Date(s.clocked_on_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}</span>
                    {s.clocked_off_at && <><span>→</span><span>{new Date(s.clocked_off_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}</span></>}
                    {s.duration_minutes && <span className="text-gray-400">({formatDuration(s.duration_minutes)})</span>}
                    {s.auto_clocked_off && <span className="text-gray-400 italic">auto</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

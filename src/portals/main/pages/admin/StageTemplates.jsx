// src/portals/main/pages/admin/StageTemplates.jsx
// Stage template management — CRUD, reorder, department groups.

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import {
  Plus, ChevronUp, ChevronDown, Save,
  Trash2, AlertCircle, GripVertical
} from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { useAuth } from '../../../../hooks/useAuth'

// SECTION: Colour presets
const COLOUR_PRESETS = [
  { hex: '6366f1', label: 'Indigo'  },
  { hex: 'f59e0b', label: 'Amber'   },
  { hex: 'ec4899', label: 'Pink'    },
  { hex: '8b5cf6', label: 'Purple'  },
  { hex: '3b82f6', label: 'Blue'    },
  { hex: '22c55e', label: 'Green'   },
  { hex: 'f97316', label: 'Orange'  },
  { hex: '14b8a6', label: 'Teal'    },
  { hex: 'ef4444', label: 'Red'     },
  { hex: '6b7280', label: 'Gray'    },
]

const DEPT_OPTIONS = [
  { value: '',           label: 'None'       },
  { value: 'panel',      label: 'Panel'      },
  { value: 'paint',      label: 'Paint'      },
  { value: 'quality',    label: 'Quality'    },
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'general',    label: 'General'    },
]

// SECTION: Colour picker
function ColourPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOUR_PRESETS.map(c => (
        <button
          key={c.hex}
          type="button"
          onClick={() => onChange(c.hex)}
          title={c.label}
          className={`w-7 h-7 rounded-full border-2 transition-all duration-150
                      ${value === c.hex ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'}`}
          style={{ backgroundColor: `#${c.hex}` }}
        />
      ))}
    </div>
  )
}

// SECTION: Stage row component
function StageRow({ stage, index, total, onMoveUp, onMoveDown, onChange, onDelete, disabled }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className={`card p-4 transition-all duration-200
                     ${stage.active ? '' : 'opacity-60'}`}>
      <div className="flex items-start gap-4">

        {/* Sort order + reorder buttons */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-1">
          <span className="font-mono text-xs text-gray-400 w-5 text-center">
            {stage.sort_order}
          </span>
          <button onClick={() => onMoveUp(index)} disabled={index === 0 || disabled}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-20 transition-colors">
            <ChevronUp className="w-4 h-4" />
          </button>
          <button onClick={() => onMoveDown(index)} disabled={index === total - 1 || disabled}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-20 transition-colors">
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Colour dot */}
        <div className="flex-shrink-0 pt-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: `#${stage.colour || '6366f1'}` }}
          />
        </div>

        {/* Main fields */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Stage Name *</label>
              <input
                type="text"
                value={stage.name}
                onChange={e => onChange(index, 'name', e.target.value)}
                placeholder="Stage name"
                className="input-field text-sm"
                disabled={stage.system_stage}
              />
            </div>
            <div>
              <label className="label text-xs">Department</label>
              <select
                value={stage.department_group || ''}
                onChange={e => onChange(index, 'department_group', e.target.value || null)}
                className="input-field text-sm"
                disabled={stage.system_stage}
              >
                {DEPT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label text-xs">Colour</label>
            <ColourPicker
              value={stage.colour}
              onChange={val => onChange(index, 'colour', val)}
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={stage.active}
                onChange={e => onChange(index, 'active', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-600">Active</span>
            </label>

            {stage.system_stage && (
              <span className="badge bg-amber-100 text-amber-700 text-xs">System Stage</span>
            )}

            {!stage.system_stage && !stage._isNew && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-500">Are you sure?</span>
                  <button onClick={() => onDelete(index)}
                    className="text-xs text-red-600 font-semibold hover:text-red-700">
                    Yes, delete
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="text-xs text-gray-500 hover:text-gray-700">
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500
                             transition-colors duration-150">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

// SECTION: Main StageTemplates component
export default function StageTemplates() {
  const { branch, profile } = useAuth()
  const branchId = branch?.id || profile?.branch_id

  const [stages,   setStages]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [isDirty,  setIsDirty]  = useState(false)

  // SECTION: Fetch stages
  const fetchStages = useCallback(async () => {
    if (!branchId) return
    const { data } = await supabase
      .from('stage_templates')
      .select('*')
      .eq('branch_id', branchId)
      .order('sort_order')
    setStages(data || [])
    setLoading(false)
    setIsDirty(false)
  }, [branchId])

  useEffect(() => { fetchStages() }, [fetchStages])

  // SECTION: Field change
  function handleChange(index, field, value) {
    setStages(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
    setIsDirty(true)
  }

  // SECTION: Move up
  function handleMoveUp(index) {
    if (index === 0) return
    setStages(prev => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next.map((s, i) => ({ ...s, sort_order: i + 1 }))
    })
    setIsDirty(true)
  }

  // SECTION: Move down
  function handleMoveDown(index) {
    setStages(prev => {
      if (index === prev.length - 1) return prev
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next.map((s, i) => ({ ...s, sort_order: i + 1 }))
    })
    setIsDirty(true)
  }

  // SECTION: Delete (mark for deletion if existing, remove if new)
  function handleDelete(index) {
    setStages(prev => {
      const next = [...prev]
      next.splice(index, 1)
      return next.map((s, i) => ({ ...s, sort_order: i + 1 }))
    })
    setIsDirty(true)
  }

  // SECTION: Add new stage
  function handleAddStage() {
    setStages(prev => [
      ...prev,
      {
        _isNew:           true,
        id:               `new-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        branch_id:        branchId,
        name:             '',
        sort_order:       prev.length + 1,
        colour:           '6366f1',
        department_group: null,
        system_stage:     false,
        active:           true,
      }
    ])
    setIsDirty(true)
  }

  // SECTION: Save all changes
  async function handleSaveAll() {
    const invalid = stages.find(s => !s.name.trim())
    if (invalid) { toast.error('All stages must have a name'); return }

    setSaving(true)

    try {
      // Separate new vs existing
      const newStages      = stages.filter(s => s._isNew)
      const existingStages = stages.filter(s => !s._isNew)

      // Get original IDs from DB to find deleted ones
      const { data: dbStages } = await supabase
        .from('stage_templates')
        .select('id')
        .eq('branch_id', branchId)

      const dbIds       = (dbStages || []).map(s => s.id)
      const currentIds  = existingStages.map(s => s.id)
      const deletedIds  = dbIds.filter(id => !currentIds.includes(id))

      const ops = []

      // Delete removed stages
      if (deletedIds.length > 0) {
        ops.push(
          supabase.from('stage_templates').delete().in('id', deletedIds)
        )
      }

      // Update existing stages
      existingStages.forEach(s => {
        ops.push(
          supabase.from('stage_templates').update({
            name:             s.name.trim(),
            sort_order:       s.sort_order,
            colour:           s.colour,
            department_group: s.department_group || null,
            active:           s.active,
          }).eq('id', s.id)
        )
      })

      // Insert new stages
      if (newStages.length > 0) {
        ops.push(
          supabase.from('stage_templates').insert(
            newStages.map(({ _isNew, id, ...s }) => ({
              ...s,
              name:      s.name.trim(),
              branch_id: branchId,
              // id omitted — let Supabase generate a real UUID
            }))
          )
        )
      }

      const results = await Promise.all(ops)
      const errors  = results.filter(r => r.error)

      if (errors.length > 0) {
        console.error('[StageTemplates] Save errors:', errors)
        toast.error('Some changes failed to save')
      } else {
        toast.success('Stage templates saved')
        fetchStages()
      }

    } catch (err) {
      console.error('[StageTemplates] Save error:', err)
      toast.error('Failed to save changes')
    }

    setSaving(false)
  }

  // SECTION: Render
  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="page-title">Stage Templates</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {stages.length} stage{stages.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isDirty && (
            <span className="flex items-center gap-1.5 text-amber-600 text-sm font-medium">
              <div className="w-2 h-2 bg-amber-500 rounded-full" />
              Unsaved changes
            </span>
          )}
          <button onClick={handleAddStage} className="btn-secondary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Stage
          </button>
          <button
            onClick={handleSaveAll}
            disabled={!isDirty || saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Save className="w-4 h-4" />
            }
            Save All Changes
          </button>
        </div>
      </div>

      {/* Note */}
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200
                      rounded-xl p-3 mb-6">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-amber-700 text-xs">
          Changes to stage templates apply to <strong>new jobs only</strong>.
          Existing jobs keep their current stages.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : stages.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 font-medium">No stage templates yet</p>
          <button onClick={handleAddStage} className="btn-primary mt-4 inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add First Stage
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {stages.map((stage, index) => (
            <StageRow
              key={stage.id}
              stage={stage}
              index={index}
              total={stages.length}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onChange={handleChange}
              onDelete={handleDelete}
              disabled={saving}
            />
          ))}
        </div>
      )}

    </div>
  )
}

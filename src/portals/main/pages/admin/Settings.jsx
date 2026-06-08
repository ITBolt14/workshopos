// src/portals/main/pages/admin/Settings.jsx
// Branch settings — edit workshop name, city, phone, job prefix, workshop code.
// Only accessible to full access roles (Owner, Branch Manager, General Manager).

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { Save, Copy, Check, Smartphone, Building2, AlertCircle } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { useAuth } from '../../../../hooks/useAuth'

export default function Settings() {
  const { branch, profile } = useAuth()
  const branchId = branch?.id || profile?.branch_id

  // SECTION: Form state
  const [name,          setName]          = useState('')
  const [city,          setCity]          = useState('')
  const [phone,         setPhone]         = useState('')
  const [jobPrefix,     setJobPrefix]     = useState('')
  const [workshopCode,  setWorkshopCode]  = useState('')
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [codeCopied,    setCodeCopied]    = useState(false)
  const [urlCopied,     setUrlCopied]     = useState(false)
  const [codeError,     setCodeError]     = useState('')

  // SECTION: Load branch data
  useEffect(() => {
    if (!branchId) return
    supabase
      .from('branches')
      .select('name, city, phone, job_prefix, workshop_code')
      .eq('id', branchId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setName(data.name || '')
          setCity(data.city || '')
          setPhone(data.phone || '')
          setJobPrefix(data.job_prefix || '')
          setWorkshopCode(data.workshop_code || '')
        }
        setLoading(false)
      })
  }, [branchId])

  // SECTION: Workshop code validation
  function validateCode(code) {
    if (!code.trim()) return 'Workshop code is required'
    if (code.length < 3) return 'Must be at least 3 characters'
    if (code.length > 12) return 'Must be 12 characters or less'
    if (!/^[A-Z0-9]+$/.test(code)) return 'Only letters and numbers allowed (no spaces or symbols)'
    return ''
  }

  function handleCodeChange(val) {
    const cleaned = val.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 12)
    setWorkshopCode(cleaned)
    setCodeError(validateCode(cleaned))
  }

  // SECTION: Save
  async function handleSave() {
    const codeValidation = validateCode(workshopCode)
    if (codeValidation) { setCodeError(codeValidation); return }
    if (!name.trim()) { toast.error('Workshop name is required'); return }

    setSaving(true)

    // Check workshop code is unique (excluding current branch)
    const { data: existing } = await supabase
      .from('branches')
      .select('id')
      .eq('workshop_code', workshopCode)
      .neq('id', branchId)
      .maybeSingle()

    if (existing) {
      setCodeError('This workshop code is already taken. Please choose a different one.')
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('branches')
      .update({
        name:          name.trim(),
        city:          city.trim() || null,
        phone:         phone.trim() || null,
        job_prefix:    jobPrefix.trim().toUpperCase().substring(0, 4) || 'WS',
        workshop_code: workshopCode,
      })
      .eq('id', branchId)

    setSaving(false)

    if (error) {
      toast.error('Failed to save settings')
      return
    }

    toast.success('Settings saved successfully')
  }

  // SECTION: Copy helpers
  function copyCode() {
    navigator.clipboard.writeText(workshopCode).then(() => {
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 3000)
    })
  }

  function copyUrl() {
    const url = `${window.location.origin}/workshop/login`
    navigator.clipboard.writeText(url).then(() => {
      setUrlCopied(true)
      setTimeout(() => setUrlCopied(false), 3000)
    })
  }

  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="space-y-4 max-w-2xl">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // SECTION: Render
  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="text-gray-400 text-sm mt-0.5">Branch details and workshop configuration</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !!codeError}
          className="btn-primary flex items-center gap-2"
        >
          {saving
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Save className="w-4 h-4" />
          }
          Save Changes
        </button>
      </div>

      <div className="max-w-2xl space-y-6">

        {/* SECTION: Branch details */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Building2 className="w-4 h-4 text-gray-400" />
            <h2 className="section-heading">Branch Details</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label">Workshop Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Legends Panel Beaters"
                className="input-field"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">City / Town</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="e.g. Johannesburg"
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="e.g. 011 000 0000"
                  className="input-field"
                />
              </div>
            </div>
            <div>
              <label className="label">Job Number Prefix</label>
              <input
                type="text"
                value={jobPrefix}
                onChange={e => setJobPrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4))}
                placeholder="e.g. BS"
                maxLength={4}
                className="input-field w-32 font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">
                Used in job numbers e.g. {jobPrefix || 'BS'}-2026-00001
              </p>
            </div>
          </div>
        </div>

        {/* SECTION: Workshop portal setup */}
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="w-4 h-4 text-gray-400" />
            <h2 className="section-heading">Workshop Portal</h2>
          </div>
          <p className="text-gray-400 text-sm mb-5">
            Technicians use this code + their PIN to log into the workshop portal.
            Keep it short and memorable.
          </p>

          {/* Workshop code editor */}
          <div className="mb-5">
            <label className="label">
              Workshop Code <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={workshopCode}
                onChange={e => handleCodeChange(e.target.value)}
                placeholder="e.g. STAR1001"
                maxLength={12}
                className={`input-field w-48 font-mono text-lg font-bold tracking-widest uppercase
                            ${codeError ? 'border-red-400 focus:ring-red-400' : ''}`}
              />
              <button
                onClick={copyCode}
                type="button"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm
                            font-semibold transition-all duration-200
                            ${codeCopied
                              ? 'bg-green-600 text-white'
                              : 'btn-secondary'
                            }`}
              >
                {codeCopied
                  ? <><Check className="w-3.5 h-3.5" /> Copied</>
                  : <><Copy className="w-3.5 h-3.5" /> Copy Code</>
                }
              </button>
            </div>

            {codeError ? (
              <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {codeError}
              </p>
            ) : (
              <p className="text-gray-400 text-xs mt-1.5">
                3–12 characters, letters and numbers only. Case-insensitive when entered by technicians.
              </p>
            )}
          </div>

          {/* Workshop URL */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Workshop Portal URL
            </p>
            <div className="flex items-center gap-3">
              <p className="font-mono text-gray-700 text-sm flex-1">
                {window.location.origin}/workshop/login
              </p>
              <button
                onClick={copyUrl}
                type="button"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm
                            font-semibold transition-all duration-200 flex-shrink-0
                            ${urlCopied
                              ? 'bg-green-600 text-white'
                              : 'btn-secondary'
                            }`}
              >
                {urlCopied
                  ? <><Check className="w-3.5 h-3.5" /> Copied</>
                  : <><Copy className="w-3.5 h-3.5" /> Copy URL</>
                }
              </button>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 leading-relaxed">
                <strong className="text-gray-700">How to set up the workshop tablet:</strong><br />
                1. Open the URL above on the tablet and bookmark it<br />
                2. Tell your technicians: the workshop code is <strong className="text-gray-800 font-mono">{workshopCode}</strong>, then enter their PIN
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

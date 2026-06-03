// src/portals/main/pages/jobs/detail/TabOverview.jsx

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from '../../../../../lib/supabase'
import { useAuth } from '../../../../../hooks/useAuth'

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right max-w-xs">{value || <span className="text-gray-300">—</span>}</span>
    </div>
  )
}

export default function TabOverview({ job, vehicle, insurer, editMode, onSaved, onEditOff }) {
  const { branch } = useAuth()
  const [saving, setSaving] = useState(false)

  // Editable fields
  const [make,    setMake]    = useState(vehicle?.make    || '')
  const [model,   setModel]   = useState(vehicle?.model   || '')
  const [year,    setYear]    = useState(vehicle?.year?.toString() || '')
  const [colour,  setColour]  = useState(vehicle?.colour  || '')
  const [vin,     setVin]     = useState(vehicle?.vin     || '')
  const [ownerName,  setOwnerName]  = useState(vehicle?.owner_name  || '')
  const [ownerPhone, setOwnerPhone] = useState(vehicle?.owner_phone || '')
  const [ownerEmail, setOwnerEmail] = useState(vehicle?.owner_email || '')
  const [estCompletion, setEstCompletion] = useState(job?.estimated_completion || '')
  const [specialInstructions, setSpecialInstructions] = useState(job?.special_instructions || '')

  useEffect(() => {
    if (vehicle) {
      setMake(vehicle.make || ''); setModel(vehicle.model || '')
      setYear(vehicle.year?.toString() || ''); setColour(vehicle.colour || '')
      setVin(vehicle.vin || ''); setOwnerName(vehicle.owner_name || '')
      setOwnerPhone(vehicle.owner_phone || ''); setOwnerEmail(vehicle.owner_email || '')
    }
    if (job) {
      setEstCompletion(job.estimated_completion || '')
      setSpecialInstructions(job.special_instructions || '')
    }
  }, [vehicle, job])

  async function handleSave() {
    setSaving(true)
    const [vErr, jErr] = await Promise.all([
      supabase.from('vehicles').update({
        make: make || null, model: model || null,
        year: year ? parseInt(year) : null,
        colour: colour || null, vin: vin || null,
        owner_name: ownerName || null,
        owner_phone: ownerPhone || null,
        owner_email: ownerEmail || null,
      }).eq('id', vehicle.id).then(r => r.error),

      supabase.from('jobs').update({
        estimated_completion: estCompletion || null,
        special_instructions: specialInstructions || null,
      }).eq('id', job.id).then(r => r.error),
    ])

    setSaving(false)
    if (vErr || jErr) { toast.error('Failed to save changes'); return }
    toast.success('Changes saved')
    onSaved()
    onEditOff()
  }

  if (!editMode) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
        <div className="card">
          <h3 className="section-heading mb-4">Vehicle</h3>
          <InfoRow label="Registration" value={vehicle?.registration} />
          <InfoRow label="Make" value={vehicle?.make} />
          <InfoRow label="Model" value={vehicle?.model} />
          <InfoRow label="Year" value={vehicle?.year} />
          <InfoRow label="Colour" value={vehicle?.colour} />
          <InfoRow label="VIN" value={vehicle?.vin} />
        </div>
        <div className="card">
          <h3 className="section-heading mb-4">Owner</h3>
          <InfoRow label="Name" value={vehicle?.owner_name} />
          <InfoRow label="Phone" value={vehicle?.owner_phone} />
          <InfoRow label="Email" value={vehicle?.owner_email} />
        </div>
        <div className="card">
          <h3 className="section-heading mb-4">Job</h3>
          <InfoRow label="Job Type" value={job?.job_type === 'insurance' ? 'Insurance' : 'Private'} />
          <InfoRow label="Insurer" value={insurer?.name} />
          <InfoRow label="Priority" value={job?.priority} />
          <InfoRow label="Check-In Date" value={job?.check_in_date ? new Date(job.check_in_date).toLocaleDateString('en-ZA') : null} />
          <InfoRow label="Est. Completion" value={job?.estimated_completion ? new Date(job.estimated_completion).toLocaleDateString('en-ZA') : null} />
          {job?.special_instructions && (
            <div className="pt-3 border-t border-gray-100 mt-2">
              <p className="text-xs text-gray-400 mb-1">Special Instructions</p>
              <p className="text-sm text-gray-700">{job.special_instructions}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Edit mode
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card">
        <h3 className="section-heading mb-4">Vehicle Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Make</label><input type="text" value={make} onChange={e => setMake(e.target.value)} className="input-field" /></div>
          <div><label className="label">Model</label><input type="text" value={model} onChange={e => setModel(e.target.value)} className="input-field" /></div>
          <div><label className="label">Year</label><input type="number" value={year} onChange={e => setYear(e.target.value)} className="input-field" /></div>
          <div><label className="label">Colour</label><input type="text" value={colour} onChange={e => setColour(e.target.value)} className="input-field" /></div>
          <div className="col-span-2"><label className="label">VIN</label><input type="text" value={vin} onChange={e => setVin(e.target.value.toUpperCase())} className="input-field" /></div>
        </div>
      </div>
      <div className="card">
        <h3 className="section-heading mb-4">Owner Details</h3>
        <div className="space-y-3">
          <div><label className="label">Name</label><input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)} className="input-field" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Phone</label><input type="tel" value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} className="input-field" /></div>
            <div><label className="label">Email</label><input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} className="input-field no-caps" /></div>
          </div>
        </div>
      </div>
      <div className="card">
        <h3 className="section-heading mb-4">Job Details</h3>
        <div className="space-y-3">
          <div><label className="label">Est. Completion</label><input type="date" value={estCompletion} onChange={e => setEstCompletion(e.target.value)} className="input-field" /></div>
          <div><label className="label">Special Instructions</label><textarea value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} rows={3} className="input-field resize-none" /></div>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
          Save Changes
        </button>
        <button onClick={onEditOff} className="btn-secondary">Cancel</button>
      </div>
    </div>
  )
}

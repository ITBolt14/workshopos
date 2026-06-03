// src/portals/main/pages/jobs/detail/TabClaim.jsx

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from '../../../../../lib/supabase'
import { useAuth } from '../../../../../hooks/useAuth'

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value || <span className="text-gray-300">—</span>}</span>
    </div>
  )
}

export default function TabClaim({ job, claim, editMode, onSaved, onEditOff }) {
  const { branch } = useAuth()
  const [saving, setSaving] = useState(false)

  const [claimNumber,    setClaimNumber]    = useState('')
  const [orderNumber,    setOrderNumber]    = useState('')
  const [policyNumber,   setPolicyNumber]   = useState('')
  const [dateOfLoss,     setDateOfLoss]     = useState('')
  const [excessAmount,   setExcessAmount]   = useState('')
  const [thirdParty,     setThirdParty]     = useState(false)
  const [tpName,         setTpName]         = useState('')
  const [tpReg,          setTpReg]          = useState('')
  const [tpInsurer,      setTpInsurer]      = useState('')
  const [incidentDesc,   setIncidentDesc]   = useState('')

  useEffect(() => {
    if (claim) {
      setClaimNumber(claim.claim_number || '')
      setOrderNumber(claim.order_number || '')
      setPolicyNumber(claim.policy_number || '')
      setDateOfLoss(claim.date_of_loss || '')
      setExcessAmount(claim.excess_amount?.toString() || '')
      setThirdParty(claim.third_party_involved || false)
      setTpName(claim.third_party_name || '')
      setTpReg(claim.third_party_vehicle_reg || '')
      setTpInsurer(claim.third_party_insurer || '')
      setIncidentDesc(claim.incident_description || '')
    }
  }, [claim])

  async function handleSave() {
    setSaving(true)
    let error
    if (claim?.id) {
      const { error: e } = await supabase.from('job_claims').update({
        claim_number: claimNumber || null, order_number: orderNumber || null,
        policy_number: policyNumber || null, date_of_loss: dateOfLoss || null,
        excess_amount: excessAmount ? parseFloat(excessAmount) : 0,
        third_party_involved: thirdParty,
        third_party_name: thirdParty ? tpName : null,
        third_party_vehicle_reg: thirdParty ? tpReg : null,
        third_party_insurer: thirdParty ? tpInsurer : null,
        incident_description: incidentDesc || null,
      }).eq('id', claim.id)
      error = e
    } else {
      const { error: e } = await supabase.from('job_claims').insert({
        job_id: job.id, branch_id: branch.id,
        claim_number: claimNumber || null, order_number: orderNumber || null,
        policy_number: policyNumber || null, date_of_loss: dateOfLoss || null,
        excess_amount: excessAmount ? parseFloat(excessAmount) : 0,
        third_party_involved: thirdParty,
        third_party_name: thirdParty ? tpName : null,
        third_party_vehicle_reg: thirdParty ? tpReg : null,
        third_party_insurer: thirdParty ? tpInsurer : null,
        incident_description: incidentDesc || null,
      })
      error = e
    }
    setSaving(false)
    if (error) { toast.error('Failed to save claim'); return }
    toast.success('Claim saved')
    onSaved()
    onEditOff()
  }

  if (job?.job_type === 'private' && !claim) {
    return <div className="card text-center py-10 text-gray-400">Private job — no claim on file.</div>
  }

  if (!editMode) {
    return (
      <div className="card animate-fade-in">
        <h3 className="section-heading mb-4">Claim Details</h3>
        <InfoRow label="Claim Number"   value={claim?.claim_number} />
        <InfoRow label="Order Number"   value={claim?.order_number} />
        <InfoRow label="Policy Number"  value={claim?.policy_number} />
        <InfoRow label="Date of Loss"   value={claim?.date_of_loss ? new Date(claim.date_of_loss).toLocaleDateString('en-ZA') : null} />
        <InfoRow label="Excess Amount"  value={claim?.excess_amount != null ? `R ${parseFloat(claim.excess_amount).toFixed(2)}` : null} />
        <InfoRow label="Third Party"    value={claim?.third_party_involved ? 'Yes' : 'No'} />
        {claim?.third_party_involved && (
          <>
            <InfoRow label="TP Name"      value={claim.third_party_name} />
            <InfoRow label="TP Reg"       value={claim.third_party_vehicle_reg} />
            <InfoRow label="TP Insurer"   value={claim.third_party_insurer} />
          </>
        )}
        {claim?.incident_description && (
          <div className="pt-3 border-t border-gray-100 mt-2">
            <p className="text-xs text-gray-400 mb-1">Incident Description</p>
            <p className="text-sm text-gray-700">{claim.incident_description}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="card space-y-4 animate-fade-in">
      <h3 className="section-heading">Edit Claim Details</h3>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Claim Number</label><input type="text" value={claimNumber} onChange={e => setClaimNumber(e.target.value)} className="input-field" /></div>
        <div><label className="label">Order Number</label><input type="text" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} className="input-field" /></div>
        <div><label className="label">Policy Number</label><input type="text" value={policyNumber} onChange={e => setPolicyNumber(e.target.value)} className="input-field" /></div>
        <div><label className="label">Date of Loss</label><input type="date" value={dateOfLoss} onChange={e => setDateOfLoss(e.target.value)} className="input-field" /></div>
        <div><label className="label">Excess Amount (R)</label><input type="number" value={excessAmount} onChange={e => setExcessAmount(e.target.value)} className="input-field" /></div>
      </div>
      <div className="bg-gray-50 rounded-xl p-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={thirdParty} onChange={e => setThirdParty(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-brand-600" />
          <span className="text-sm font-medium">Third party involved</span>
        </label>
        {thirdParty && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div><label className="label">TP Name</label><input type="text" value={tpName} onChange={e => setTpName(e.target.value)} className="input-field" /></div>
            <div><label className="label">TP Registration</label><input type="text" value={tpReg} onChange={e => setTpReg(e.target.value.toUpperCase())} className="input-field uppercase" /></div>
            <div className="col-span-2"><label className="label">TP Insurer</label><input type="text" value={tpInsurer} onChange={e => setTpInsurer(e.target.value)} className="input-field" /></div>
          </div>
        )}
      </div>
      <div><label className="label">Incident Description</label><textarea value={incidentDesc} onChange={e => setIncidentDesc(e.target.value)} rows={3} className="input-field resize-none" /></div>
      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary">Save Claim</button>
        <button onClick={onEditOff} className="btn-secondary">Cancel</button>
      </div>
    </div>
  )
}

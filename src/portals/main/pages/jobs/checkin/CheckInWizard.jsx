// src/portals/main/pages/jobs/checkin/CheckInWizard.jsx
// 4-step check-in wizard: Vehicle → Job → Claim → Confirm

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import {
  Car, ClipboardList, FileText, CheckCircle2,
  Search, ChevronRight, ChevronLeft, ArrowLeft
} from 'lucide-react'
import { supabase } from '../../../../../lib/supabase'
import { useAuth } from '../../../../../hooks/useAuth'

// SECTION: Step indicator
function StepIndicator({ step }) {
  const steps = [
    { icon: Car,           label: 'Vehicle'  },
    { icon: ClipboardList, label: 'Job'      },
    { icon: FileText,      label: 'Claim'    },
    { icon: CheckCircle2,  label: 'Confirm'  },
  ]
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => {
        const num      = i + 1
        const active   = num === step
        const complete = num < step
        const Icon     = s.icon
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center
                transition-all duration-300 ${
                  complete ? 'bg-brand-600' :
                  active   ? 'bg-brand-600 ring-4 ring-brand-100' :
                             'bg-gray-100'
                }`}>
                {complete
                  ? <CheckCircle2 className="w-4 h-4 text-white" />
                  : <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-400'}`} />
                }
              </div>
              <span className={`text-xs mt-1 font-medium ${
                active ? 'text-brand-700' : complete ? 'text-brand-600' : 'text-gray-400'
              }`}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-12 h-0.5 mb-4 mx-1 transition-colors duration-300 ${
                complete ? 'bg-brand-600' : 'bg-gray-200'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// SECTION: Priority selector
function PrioritySelector({ value, onChange }) {
  const options = [
    { val: 1, colour: 'bg-gray-400',   label: 'Low'      },
    { val: 2, colour: 'bg-blue-400',   label: 'Normal'   },
    { val: 3, colour: 'bg-amber-400',  label: 'Medium'   },
    { val: 4, colour: 'bg-orange-500', label: 'High'     },
    { val: 5, colour: 'bg-red-500',    label: 'Critical' },
  ]
  return (
    <div className="flex gap-2">
      {options.map(o => (
        <button
          key={o.val}
          type="button"
          onClick={() => onChange(o.val)}
          className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl border-2
                      transition-all duration-150
                      ${value === o.val
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }`}
        >
          <span className={`w-3 h-3 rounded-full ${o.colour}`} />
          <span className={`text-xs font-medium ${value === o.val ? 'text-brand-700' : 'text-gray-500'}`}>
            {o.label}
          </span>
        </button>
      ))}
    </div>
  )
}

// SECTION: Main CheckInWizard
export default function CheckInWizard() {
  const navigate = useNavigate()
  const { profile, branch } = useAuth()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // SECTION: Insurers list
  const [insurers, setInsurers] = useState([])
  useEffect(() => {
    if (!branch?.id) return
    supabase
      .from('insurers')
      .select('id, name')
      .eq('branch_id', branch.id)
      .eq('active', true)
      .order('name')
      .then(({ data }) => setInsurers(data || []))
  }, [branch?.id])

  // SECTION: Step 1 — Vehicle data
  const [registration,  setRegistration]  = useState('')
  const [searching,     setSearching]     = useState(false)
  const [existingVehicleId, setExistingVehicleId] = useState(null)
  const [make,          setMake]          = useState('')
  const [model,         setModel]         = useState('')
  const [year,          setYear]          = useState('')
  const [colour,        setColour]        = useState('')
  const [vin,           setVin]           = useState('')
  const [ownerName,     setOwnerName]     = useState('')
  const [ownerPhone,    setOwnerPhone]    = useState('')
  const [ownerEmail,    setOwnerEmail]    = useState('')

  // SECTION: Step 2 — Job data
  const [jobType,          setJobType]          = useState('insurance')
  const [insurerId,        setInsurerId]        = useState('')
  const [claimNumber,      setClaimNumber]      = useState('')
  const [orderNumber,      setOrderNumber]      = useState('')
  const [priority,         setPriority]         = useState(3)
  const [checkInDate,      setCheckInDate]      = useState(new Date().toISOString().split('T')[0])
  const [estimatedCompletion, setEstimatedCompletion] = useState('')
  const [specialInstructions, setSpecialInstructions] = useState('')

  // SECTION: Step 3 — Claim data
  const [policyNumber,       setPolicyNumber]       = useState('')
  const [dateOfLoss,         setDateOfLoss]         = useState('')
  const [excessAmount,       setExcessAmount]       = useState('')
  const [thirdParty,         setThirdParty]         = useState(false)
  const [tpName,             setTpName]             = useState('')
  const [tpReg,              setTpReg]              = useState('')
  const [tpInsurer,          setTpInsurer]          = useState('')
  const [incidentDescription, setIncidentDescription] = useState('')

  // SECTION: Vehicle search
  async function handleVehicleSearch() {
    if (!registration.trim()) return
    setSearching(true)
    const { data } = await supabase
      .from('vehicles')
      .select('*')
      .eq('branch_id', branch.id)
      .ilike('registration', registration.trim())
      .maybeSingle()

    setSearching(false)
    if (data) {
      setExistingVehicleId(data.id)
      setMake(data.make || '')
      setModel(data.model || '')
      setYear(data.year?.toString() || '')
      setColour(data.colour || '')
      setVin(data.vin || '')
      setOwnerName(data.owner_name || '')
      setOwnerPhone(data.owner_phone || '')
      setOwnerEmail(data.owner_email || '')
      toast.success('Vehicle found — details loaded')
    } else {
      setExistingVehicleId(null)
      toast('Vehicle not found — please fill in the details', { icon: 'ℹ️' })
    }
  }

  // SECTION: Step validation
  const step1Valid = registration.trim() && ownerName.trim()
  const step2Valid = jobType && checkInDate
  const step3Valid = true // Claim step is optional fields

  // SECTION: Save handler
  async function handleSave(asDraft = false) {
    if (saving) return
    setSaving(true)

    try {
      // Upsert vehicle
      let vehicleId = existingVehicleId
      if (vehicleId) {
        await supabase.from('vehicles').update({
          make: make || null, model: model || null,
          year: year ? parseInt(year) : null,
          colour: colour || null, vin: vin || null,
          owner_name: ownerName || null,
          owner_phone: ownerPhone || null,
          owner_email: ownerEmail || null,
        }).eq('id', vehicleId)
      } else {
        const { data: newVehicle, error: vErr } = await supabase
          .from('vehicles')
          .insert({
            branch_id: branch.id,
            registration: registration.trim().toUpperCase(),
            make: make || null, model: model || null,
            year: year ? parseInt(year) : null,
            colour: colour || null, vin: vin || null,
            owner_name: ownerName || null,
            owner_phone: ownerPhone || null,
            owner_email: ownerEmail || null,
          })
          .select('id')
          .single()
        if (vErr) throw new Error('Failed to save vehicle: ' + vErr.message)
        vehicleId = newVehicle.id
      }

      // Generate job number
      const { data: jobNum, error: seqErr } = await supabase
        .rpc('generate_job_number', { p_branch_id: branch.id })
      if (seqErr) throw new Error('Failed to generate job number: ' + seqErr.message)

      // Insert job
      const { data: newJob, error: jobErr } = await supabase
        .from('jobs')
        .insert({
          branch_id:            branch.id,
          job_number:           jobNum,
          vehicle_id:           vehicleId,
          insurer_id:           jobType === 'insurance' && insurerId ? insurerId : null,
          job_type:             jobType,
          status:               'checked_in',
          priority:             priority,
          check_in_date:        checkInDate,
          estimated_completion: estimatedCompletion || null,
          special_instructions: specialInstructions || null,
          created_by:           profile.id,
        })
        .select('id')
        .single()
      if (jobErr) throw new Error('Failed to create job: ' + jobErr.message)

      // Insert claim if insurance job
      if (jobType === 'insurance') {
        await supabase.from('job_claims').insert({
          job_id:                newJob.id,
          branch_id:             branch.id,
          claim_number:          claimNumber || null,
          order_number:          orderNumber || null,
          policy_number:         policyNumber || null,
          date_of_loss:          dateOfLoss || null,
          excess_amount:         excessAmount ? parseFloat(excessAmount) : 0,
          third_party_involved:  thirdParty,
          third_party_name:      thirdParty ? tpName : null,
          third_party_vehicle_reg: thirdParty ? tpReg : null,
          third_party_insurer:   thirdParty ? tpInsurer : null,
          incident_description:  incidentDescription || null,
        })
      }

      // Write audit log
      await supabase.from('audit_log').insert({
        branch_id:  branch.id,
        user_id:    profile.id,
        portal:     'main',
        action:     'Job checked in',
        table_name: 'jobs',
        record_id:  newJob.id,
        new_value:  { job_number: jobNum, status: 'checked_in' },
      })

      toast.success(`Job ${jobNum} created successfully!`)
      navigate(`/main/jobs/${newJob.id}`)

    } catch (err) {
      console.error('[CheckInWizard] Save error:', err)
      toast.error(err.message || 'Failed to save job. Please try again.')
      setSaving(false)
    }
  }

  // SECTION: Render
  return (
    <div className="h-full overflow-y-auto p-6 max-w-3xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/main/jobs')}
          className="w-9 h-9 flex items-center justify-center rounded-xl
                     bg-white border border-gray-200 hover:bg-gray-50
                     text-gray-500 transition-all duration-150">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="page-title">New Check-In</h1>
          <p className="text-gray-400 text-sm">Step {step} of 4</p>
        </div>
      </div>

      <div className="card">
        <StepIndicator step={step} />

        {/* ======================== STEP 1: VEHICLE ======================== */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="section-heading mb-4">
              <span className="text-brand-600 font-mono text-sm mr-2">01</span>
              Vehicle Details
            </h2>

            {/* Registration search */}
            <div>
              <label className="label">Registration <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={registration}
                  onChange={e => setRegistration(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleVehicleSearch()}
                  placeholder="e.g. ABC 123 GP"
                  className="input-field uppercase flex-1"
                />
                <button
                  type="button"
                  onClick={handleVehicleSearch}
                  disabled={searching || !registration.trim()}
                  className="btn-secondary flex items-center gap-2 flex-shrink-0"
                >
                  {searching
                    ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    : <Search className="w-4 h-4" />
                  }
                  Search
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Make</label>
                <input type="text" value={make} onChange={e => setMake(e.target.value)} placeholder="e.g. Toyota" className="input-field" />
              </div>
              <div>
                <label className="label">Model</label>
                <input type="text" value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. Hilux" className="input-field" />
              </div>
              <div>
                <label className="label">Year</label>
                <input type="number" value={year} onChange={e => setYear(e.target.value)} placeholder="e.g. 2022" className="input-field" />
              </div>
              <div>
                <label className="label">Colour</label>
                <input type="text" value={colour} onChange={e => setColour(e.target.value)} placeholder="e.g. White" className="input-field" />
              </div>
            </div>

            <div>
              <label className="label">VIN Number</label>
              <input type="text" value={vin} onChange={e => setVin(e.target.value.toUpperCase())} placeholder="17-character VIN" className="input-field" />
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Owner Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="label">Owner Name <span className="text-red-500">*</span></label>
                  <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Full name" className="input-field" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Phone</label>
                    <input type="tel" value={ownerPhone}
                    onChange={e => setOwnerPhone(e.target.value.replace(/[^0-9+\s()-]/g, ''))}
                    placeholder="e.g. 082 000 0000" className="input-field" />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="owner@email.com" className="input-field no-caps" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button type="button" disabled={!step1Valid} onClick={() => setStep(2)}
                className="btn-primary flex items-center gap-2">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ======================== STEP 2: JOB ======================== */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="section-heading mb-4">
              <span className="text-brand-600 font-mono text-sm mr-2">02</span>
              Job Details
            </h2>

            {/* Job type toggle */}
            <div>
              <label className="label">Job Type</label>
              <div className="flex gap-2">
                {['insurance', 'private'].map(type => (
                  <button key={type} type="button" onClick={() => setJobType(type)}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold
                                transition-all duration-150 capitalize
                                ${jobType === type
                                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                }`}>
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {jobType === 'insurance' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Insurer</label>
                  <select value={insurerId} onChange={e => setInsurerId(e.target.value)} className="input-field">
                    <option value="">Select insurer…</option>
                    {insurers.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Claim Number</label>
                  <input type="text" value={claimNumber} onChange={e => setClaimNumber(e.target.value)} placeholder="Claim ref" className="input-field" />
                </div>
                <div>
                  <label className="label">Order Number</label>
                  <input type="text" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="Order ref" className="input-field" />
                </div>
              </div>
            )}

            <div>
              <label className="label">Priority</label>
              <PrioritySelector value={priority} onChange={setPriority} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Check-In Date <span className="text-red-500">*</span></label>
                <input type="date" value={checkInDate} onChange={e => setCheckInDate(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="label">Est. Completion</label>
                <input type="date" value={estimatedCompletion}
                  min={checkInDate}
                  onChange={e => {
                    if (e.target.value && e.target.value < checkInDate) {
                      toast.error('Estimated completion cannot be before the check-in date')
                      return
                    }
                    setEstimatedCompletion(e.target.value)
                  }}
                  className="input-field" />
                {estimatedCompletion && estimatedCompletion < checkInDate && (
                  <p className="text-red-500 text-xs mt-1">Cannot be before check-in date</p>
                )}
              </div>
            </div>

            <div>
              <label className="label">Special Instructions</label>
              <textarea value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)}
                placeholder="Any special notes or instructions…"
                rows={3} className="input-field resize-none" />
            </div>

            <div className="flex justify-between pt-2">
              <button type="button" onClick={() => setStep(1)} className="btn-secondary flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button type="button" disabled={!step2Valid} onClick={() => setStep(3)}
                className="btn-primary flex items-center gap-2">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ======================== STEP 3: CLAIM ======================== */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="section-heading mb-4">
              <span className="text-brand-600 font-mono text-sm mr-2">03</span>
              Claim Details
              {jobType === 'private' && (
                <span className="ml-2 text-xs font-normal text-gray-400">(Private job — no claim required)</span>
              )}
            </h2>

            {jobType === 'insurance' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Policy Number</label>
                    <input type="text" value={policyNumber} onChange={e => setPolicyNumber(e.target.value)} placeholder="Policy ref" className="input-field" />
                  </div>
                  <div>
                    <label className="label">Date of Loss</label>
                    <input type="date" value={dateOfLoss} onChange={e => setDateOfLoss(e.target.value)} className="input-field" />
                  </div>
                  <div>
                    <label className="label">Excess Amount (R)</label>
                    <input type="number" value={excessAmount} onChange={e => setExcessAmount(e.target.value)} placeholder="0.00" className="input-field" />
                  </div>
                </div>

                {/* Third party toggle */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={thirdParty} onChange={e => setThirdParty(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                    <span className="text-sm font-medium text-gray-700">Third party involved</span>
                  </label>
                  {thirdParty && (
                    <div className="mt-4 space-y-3 animate-fade-in">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Third Party Name</label>
                          <input type="text" value={tpName} onChange={e => setTpName(e.target.value)} className="input-field" />
                        </div>
                        <div>
                          <label className="label">Their Registration</label>
                          <input type="text" value={tpReg} onChange={e => setTpReg(e.target.value.toUpperCase())} className="input-field uppercase" />
                        </div>
                      </div>
                      <div>
                        <label className="label">Their Insurer</label>
                        <input type="text" value={tpInsurer} onChange={e => setTpInsurer(e.target.value)} className="input-field" />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="label">Incident Description</label>
                  <textarea value={incidentDescription} onChange={e => setIncidentDescription(e.target.value)}
                    placeholder="Brief description of the incident…"
                    rows={3} className="input-field resize-none" />
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-gray-400">
                <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No claim details required for private jobs.</p>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button type="button" onClick={() => setStep(2)} className="btn-secondary flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button type="button" onClick={() => setStep(4)}
                className="btn-primary flex items-center gap-2">
                Review <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ======================== STEP 4: CONFIRM ======================== */}
        {step === 4 && (
          <div className="space-y-5 animate-fade-in">
            <h2 className="section-heading mb-4">
              <span className="text-brand-600 font-mono text-sm mr-2">04</span>
              Confirm Check-In
            </h2>

            {/* Vehicle summary */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Vehicle</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Registration</span><span className="font-bold text-gray-900">{registration}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Make & Model</span><span className="font-medium text-gray-900">{make} {model}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Year</span><span className="font-medium text-gray-900">{year || '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Colour</span><span className="font-medium text-gray-900">{colour || '—'}</span></div>
                <div className="flex justify-between col-span-2"><span className="text-gray-500">Owner</span><span className="font-medium text-gray-900">{ownerName}</span></div>
              </div>
            </div>

            {/* Job summary */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Job</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium text-gray-900 capitalize">{jobType}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Priority</span><span className="font-medium text-gray-900">{priority}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Check-In Date</span><span className="font-medium text-gray-900">{checkInDate}</span></div>
                {estimatedCompletion && <div className="flex justify-between"><span className="text-gray-500">Est. Completion</span><span className="font-medium text-gray-900">{estimatedCompletion}</span></div>}
                {jobType === 'insurance' && insurerId && <div className="flex justify-between col-span-2"><span className="text-gray-500">Insurer</span><span className="font-medium text-gray-900">{insurers.find(i => i.id === insurerId)?.name || '—'}</span></div>}
                {claimNumber && <div className="flex justify-between"><span className="text-gray-500">Claim No.</span><span className="font-medium text-gray-900">{claimNumber}</span></div>}
              </div>
              {specialInstructions && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Special Instructions</p>
                  <p className="text-sm text-gray-700">{specialInstructions}</p>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-2 gap-3">
              <button type="button" onClick={() => setStep(3)} className="btn-secondary flex items-center gap-2" disabled={saving}>
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button type="button" onClick={() => handleSave(false)} disabled={saving}
                className="btn-primary flex items-center gap-2 flex-1 justify-center">
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                  : <><CheckCircle2 className="w-4 h-4" />Check In</>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

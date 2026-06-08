// src/pages/Register.jsx
// Public registration page — creates a new branch + owner profile on a 14-day trial.
// Three-section wizard with step indicators.

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import {
  Wrench, AlertTriangle, CheckCircle2, Building2,
  User, Lock, ChevronRight, ChevronLeft
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { setRegistrationInProgress } from '../context/AuthContext'
import PasswordInput from '../components/ui/PasswordInput'
import PasswordStrength, { isPasswordValid } from '../components/ui/PasswordStrength'

// SECTION: Tier 1 roles available at registration
const REGISTER_ROLES = [
  { value: 'owner',           label: 'Owner' },
  { value: 'branch_manager',  label: 'Branch Manager' },
  { value: 'general_manager', label: 'General Manager' },
  { value: 'manager',         label: 'Manager' },
  { value: 'reception',       label: 'Reception' },
]

// SECTION: Success screen
function SuccessScreen({ workshopName, email, trialEnd }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center animate-scale-in">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center
                        justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <span className="inline-block bg-brand-100 text-brand-700 text-xs font-semibold
                         px-3 py-1 rounded-full mb-4">
          Registration successful
        </span>
        <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">
          Welcome to WorkshopOS!
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          Your 14-day beta trial has been activated.
        </p>

        <div className="card text-left space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Workshop</span>
            <span className="font-semibold text-gray-900">{workshopName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Account email</span>
            <span className="font-semibold text-gray-900">{email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Access</span>
            <span className="font-semibold text-gray-900">Workshop Monitor module</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Trial ends</span>
            <span className="font-semibold text-gray-900">
              {new Date(trialEnd).toLocaleDateString('en-ZA', {
                day: 'numeric', month: 'long', year: 'numeric'
              })}
            </span>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-left">
          <p className="text-green-800 text-sm font-medium mb-1">Account created successfully!</p>
          <p className="text-green-700 text-xs">
            You can now sign in using <strong>{email}</strong> and the password
            you set during registration.
          </p>
        </div>

        <button onClick={() => navigate('/login')} className="btn-primary w-full">
          Go to sign in
        </button>
      </div>
    </div>
  )
}

// SECTION: Step indicator
function StepIndicator({ step, total }) {
  const steps = [
    { icon: Building2, label: 'Workshop'  },
    { icon: User,      label: 'Your Details' },
    { icon: Lock,      label: 'Password'  },
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
                  complete ? 'bg-brand-600'      :
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
              }`}>
                {s.label}
              </span>
            </div>
            {i < total - 1 && (
              <div className={`w-16 h-0.5 mb-4 mx-1 transition-colors duration-300 ${
                complete ? 'bg-brand-600' : 'bg-gray-200'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// SECTION: Main Register component
export default function Register() {
  const navigate = useNavigate()

  // Step
  const [step, setStep] = useState(1)

  // Section 1 — Workshop Details
  const [workshopName,  setWorkshopName]  = useState('')
  const [workshopCity,  setWorkshopCity]  = useState('')
  const [workshopPhone, setWorkshopPhone] = useState('')

  // Section 2 — Your Details
  const [fullName,  setFullName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [role,      setRole]      = useState('')

  // Section 3 — Password
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [agreed,    setAgreed]    = useState(false)

  // Submission
  const [submitting, setSubmitting] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [success,    setSuccess]    = useState(null) // { workshopName, email, trialEnd }

  // SECTION: Step validation
  const step1Valid = workshopName.trim() && workshopCity.trim() && workshopPhone.trim()
  const step2Valid = fullName.trim() && email.trim() && role
  const passwordsMatch = password === confirm && confirm.length > 0
  const step3Valid = isPasswordValid(password) && passwordsMatch && agreed

  // SECTION: Submit
  async function handleSubmit(e) {
    e.preventDefault()
    if (!step3Valid || submitting) return

    setSubmitting(true)

    try {
      // Lock AuthContext so SIGNED_IN doesn't try to fetch profile
      // before register_new_workshop has finished creating it.
      setRegistrationInProgress(true)

      // 1. Create Supabase auth account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          toast.error('An account with this email already exists.')
        } else {
          toast.error(authError.message || 'Registration failed. Please try again.')
        }
        setSubmitting(false)
        return
      }

      const userId = authData.user?.id
      if (!userId) {
        toast.error('Registration failed. Please try again.')
        setSubmitting(false)
        return
      }

      // 2. Call SECURITY DEFINER function — runs server-side, bypasses RLS safely.
      // Creates branch, profile, stage templates, workshop roles and insurers atomically.
      const { data: regData, error: regError } = await supabase.rpc('register_new_workshop', {
        p_user_id:       userId,
        p_full_name:     fullName.trim(),
        p_email:         email.trim().toLowerCase(),
        p_role:          role,
        p_workshop_name: workshopName.trim(),
        p_city:          workshopCity.trim(),
        p_phone:         workshopPhone.trim(),
      })

      if (regError) {
        console.error('[Register] RPC error:', regError)
        setRegistrationInProgress(false)
        toast.error('Failed to create workshop. Please try again.')
        setSubmitting(false)
        return
      }

      // Profile now exists — release the lock so AuthContext can fetch it
      setRegistrationInProgress(false)

      const trialEndsAt = regData?.trial_ends || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

      setSuccess({
        workshopName: workshopName.trim(),
        email:        email.trim().toLowerCase(),
        trialEnd:     trialEndsAt,
      })

    } catch (err) {
      console.error('[Register] Unexpected error:', err)
      setRegistrationInProgress(false)
      toast.error('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  // SECTION: Show success screen
  if (success) {
    return (
      <SuccessScreen
        workshopName={success.workshopName}
        email={success.email}
        trialEnd={success.trialEnd}
      />
    )
  }

  // SECTION: Main render
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <Wrench className="w-4 h-4 text-white" />
            </div>
            <span className="font-display text-gray-900 font-bold">WorkshopOS</span>
            <span className="bg-brand-100 text-brand-700 text-xs font-semibold
                             px-2 py-0.5 rounded">
              Beta v0.1
            </span>
          </div>
          <Link to="/login"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Already have an account? Sign in
          </Link>
        </div>
      </div>

      {/* Beta notice banner */}
      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-2xl mx-auto px-6 py-3 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 leading-relaxed">
            <strong>Beta Notice:</strong> This is a beta version of WorkshopOS currently under
            active development. You are registering for a 14-day beta test of the Workshop Monitor
            module only. The system is provided as-is for evaluation purposes. No payment required.
          </div>
        </div>
      </div>

      {/* Form container */}
      <div className="max-w-2xl mx-auto px-6 py-10">

        <div className="mb-8 text-center animate-slide-down">
          <h1 className="font-display text-3xl font-bold text-gray-900 mb-2">
            Start your free beta trial
          </h1>
          <p className="text-gray-500 text-sm">
            14 days free. No credit card. No obligations.
          </p>
        </div>

        <div className="card animate-slide-up">

          {/* Step indicator */}
          <StepIndicator step={step} total={3} />

          <form onSubmit={handleSubmit}>

            {/* ========================
                STEP 1: Workshop Details
                ======================== */}
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <h2 className="section-heading mb-4">
                    <span className="text-brand-600 font-mono text-sm mr-2">01</span>
                    Workshop Details
                  </h2>
                </div>

                <div>
                  <label className="label">Workshop name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={workshopName}
                    onChange={e => setWorkshopName(e.target.value)}
                    placeholder="e.g. City Panelbeaters"
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">City / Town <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={workshopCity}
                      onChange={e => setWorkshopCity(e.target.value)}
                      placeholder="e.g. Johannesburg"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label">Workshop phone <span className="text-red-500">*</span></label>
                    <input
                      type="tel"
                      value={workshopPhone}
                      onChange={e => setWorkshopPhone(e.target.value.replace(/[^0-9+ ()-]/g, ""))}
                      placeholder="e.g. 011 000 0000"
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    disabled={!step1Valid}
                    onClick={() => setStep(2)}
                    className="btn-primary flex items-center gap-2"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ========================
                STEP 2: Your Details
                ======================== */}
            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <h2 className="section-heading mb-4">
                    <span className="text-brand-600 font-mono text-sm mr-2">02</span>
                    Your Details
                  </h2>
                </div>

                <div>
                  <label className="label">Full name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. John Smith"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="label">Email address <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@workshop.co.za"
                    autoComplete="email"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="label">Your role <span className="text-red-500">*</span></label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select your role…</option>
                    {REGISTER_ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    type="button"
                    disabled={!step2Valid}
                    onClick={() => setStep(3)}
                    className="btn-primary flex items-center gap-2"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ========================
                STEP 3: Password
                ======================== */}
            {step === 3 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <h2 className="section-heading mb-4">
                    <span className="text-brand-600 font-mono text-sm mr-2">03</span>
                    Set Your Password
                  </h2>
                </div>

                {/* Password + strength */}
                <div>
                  <PasswordInput
                    id="reg-password"
                    label={<>Password <span className="text-red-500">*</span></>}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    disabled={submitting}
                    autoComplete="new-password"
                  />
                  <PasswordStrength password={password} />
                </div>

                {/* Confirm password */}
                <div>
                  <PasswordInput
                    id="reg-confirm"
                    label={<>Confirm password <span className="text-red-500">*</span></>}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    disabled={submitting}
                    autoComplete="new-password"
                  />
                  {confirm.length > 0 && (
                    <p className={`mt-1 text-xs ${passwordsMatch ? 'text-green-600' : 'text-red-500'}`}>
                      {passwordsMatch ? '✓ Passwords match' : 'Passwords do not match'}
                    </p>
                  )}
                </div>

                {/* Beta acknowledgement checkbox */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={e => setAgreed(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-gray-300 text-brand-600
                                 focus:ring-brand-500 cursor-pointer flex-shrink-0"
                    />
                    <span className="text-xs text-gray-600 leading-relaxed">
                      I understand that WorkshopOS is a beta system currently under development.
                      This 14-day registration is for evaluation purposes only. Features may change
                      or be unavailable. No data guarantees are provided during the beta period.
                    </span>
                  </label>
                </div>

                {/* Validation errors shown when user tries to submit */}
                {submitAttempted && !isPasswordValid(password) && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 animate-fade-in">
                    <p className="text-red-700 text-sm font-medium mb-1">Password requirements not met:</p>
                    <ul className="text-red-600 text-xs space-y-0.5 list-disc list-inside">
                      {password.length < 8 && <li>Minimum 8 characters</li>}
                      {!/[A-Z]/.test(password) && <li>At least one uppercase letter (A–Z)</li>}
                      {!/[a-z]/.test(password) && <li>At least one lowercase letter (a–z)</li>}
                      {!/[0-9]/.test(password) && <li>At least one number (0–9)</li>}
                      {!/[^A-Za-z0-9]/.test(password) && <li>At least one special character (!@#$…)</li>}
                    </ul>
                  </div>
                )}
                {submitAttempted && password !== confirm && confirm.length > 0 && (
                  <p className="text-red-500 text-sm">Passwords do not match</p>
                )}
                {submitAttempted && !agreed && (
                  <p className="text-red-500 text-sm">You must accept the beta terms to continue</p>
                )}

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="btn-secondary flex items-center gap-2"
                    disabled={submitting}
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    onClick={() => setSubmitAttempted(true)}
                    className="btn-primary flex items-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent
                                        rounded-full animate-spin" />
                        Creating account…
                      </>
                    ) : (
                      'Start 14-day beta access'
                    )}
                  </button>
                </div>
              </div>
            )}

          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          By registering you agree to our terms. Beta data is not guaranteed to persist
          beyond the trial period.
        </p>
      </div>
    </div>
  )
}

// src/portals/workshop/pages/WorkshopLogin.jsx
// Two-step workshop login:
//   Step 1: Enter workshop code (identifies the branch, POPIA-safe — no list shown)
//   Step 2: Enter 4-digit PIN (identifies the technician within that branch)
//
// Security model:
//   - Workshop code is a short memorable string set by the admin (e.g. LEGENDS)
//   - Wrong code + right PIN always fails — branch is validated first
//   - No company names, lists, or other tenants ever exposed

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench, Delete, ArrowLeft } from 'lucide-react'
import { supabaseWorkshop as supabase } from '../../../lib/supabaseWorkshop'
import { setWorkshopUser } from '../WorkshopPortal'
import { SCAN_REDIRECT_KEY } from './WorkshopScan'

const MAX_ATTEMPTS = 5

export default function WorkshopLogin() {
  const navigate = useNavigate()

  // SECTION: Step state
  const [step,            setStep]            = useState(1) // 1 = code, 2 = PIN
  const [workshopCode,    setWorkshopCode]    = useState('')
  const [resolvedBranchId, setResolvedBranchId] = useState(null)
  const [resolvedBranchName, setResolvedBranchName] = useState('')

  // SECTION: PIN state
  const [pin,          setPin]          = useState('')
  const [attempts,     setAttempts]     = useState(0)
  const [checking,     setChecking]     = useState(false)
  const [errorMsg,     setErrorMsg]     = useState('')
  const [lockedOut,    setLockedOut]    = useState(false)
  const [shakeTrigger, setShakeTrigger] = useState(0)

  // SECTION: Step 1 — resolve workshop code
  async function handleCodeSubmit() {
    const code = workshopCode.trim().toUpperCase()
    if (!code) { setErrorMsg('Please enter your workshop code'); return }

    setChecking(true)
    setErrorMsg('')

    const { data, error } = await supabase
      .rpc('get_branch_by_code', { p_code: code })

    setChecking(false)

    if (error || !data) {
      // Deliberately vague — never reveal whether code exists
      setErrorMsg('Workshop code not recognised. Please check and try again.')
      triggerShake()
      return
    }

    // Code resolved — move to PIN step
    // We store branch name separately via a second safe lookup
    const { data: branchData } = await supabase
      .rpc('get_branch_name_by_id', { p_branch_id: data })

    setResolvedBranchId(data)
    setResolvedBranchName(branchData || code)
    setStep(2)
  }

  // SECTION: Step 2 — auto-submit on 4th digit
  async function handlePinDigit(digit) {
    if (checking || lockedOut) return
    const newPin = pin + digit
    setPin(newPin)
    setErrorMsg('')
    if (newPin.length === 4) {
      await handlePinSubmit(newPin)
    }
  }

  async function handlePinSubmit(enteredPin) {
    setChecking(true)
    setErrorMsg('')

    const { data, error } = await supabase
      .rpc('lookup_workshop_pin', {
        p_pin:       enteredPin,
        p_branch_id: resolvedBranchId,
      })

    if (error || !data || data.length === 0) {
      const newAttempts = attempts + 1
      setAttempts(newAttempts)
      setPin('')
      setChecking(false)
      triggerShake()

      if (newAttempts >= MAX_ATTEMPTS) {
        setLockedOut(true)
        setErrorMsg('Incorrect PIN. Please ask your manager to reset your PIN.')
        setTimeout(() => {
          setLockedOut(false)
          setAttempts(0)
          setErrorMsg('')
        }, 4000)
      } else {
        const remaining = MAX_ATTEMPTS - newAttempts
        setErrorMsg(`Incorrect PIN. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`)
      }
      return
    }

    const profile = data[0]

    // Fetch workshop role separately
    let workshopRole = null
    if (profile.workshop_role_id) {
      const { data: roleData } = await supabase
        .from('workshop_roles')
        .select('id, name, colour')
        .eq('id', profile.workshop_role_id)
        .single()
      workshopRole = roleData || null
    }

    setWorkshopUser({
      id:               profile.id,
      full_name:        profile.full_name,
      branch_id:        profile.branch_id,
      tier2_role:       profile.tier2_role,
      tier1_role:       profile.tier1_role,
      department_group: profile.department_group,
      workshop_role:    workshopRole,
    })

    setChecking(false)

    // Check if user arrived via QR scan
    const scanRedirect = sessionStorage.getItem(SCAN_REDIRECT_KEY)
    if (scanRedirect) {
      sessionStorage.removeItem(SCAN_REDIRECT_KEY)
      const jobIdMatch = scanRedirect.match(/\/workshop\/job\/([^?]+)/)
      if (jobIdMatch && profile.tier1_role) {
        navigate(`/workshop/view/${jobIdMatch[1]}`, { replace: true })
      } else {
        navigate(scanRedirect, { replace: true })
      }
    } else if (profile.tier1_role) {
      navigate('/workshop/home', { replace: true })
    } else {
      navigate('/workshop/home', { replace: true })
    }
  }

  function handleBackspace() {
    if (checking || lockedOut) return
    setPin(p => p.slice(0, -1))
    setErrorMsg('')
  }

  function handleCodeBackspace() {
    setWorkshopCode(c => c.slice(0, -1))
    setErrorMsg('')
  }

  function triggerShake() {
    setShakeTrigger(t => t + 1)
  }

  function handleBackToCode() {
    setStep(1)
    setPin('')
    setErrorMsg('')
    setAttempts(0)
    setLockedOut(false)
    setResolvedBranchId(null)
  }

  // SECTION: Render — Step 1: Workshop Code
  if (step === 1) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 select-none"
        style={{ backgroundImage: `radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.12) 0%, transparent 60%)` }}>

        {/* Logo */}
        <div className="flex flex-col items-center mb-10 animate-slide-down">
          <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center mb-3
                          shadow-lg shadow-brand-600/30">
            <Wrench className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-display text-white text-2xl font-bold tracking-tight">
            Workshop Portal
          </h1>
          <p className="text-gray-500 text-sm mt-1">Enter your workshop code</p>
        </div>

        {/* Code input */}
        <div className="w-full max-w-xs animate-slide-up">
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl px-5 py-4
                       text-center mb-4 min-h-[60px] flex items-center justify-center"
            style={{
              animation: shakeTrigger > 0 ? 'shake 0.4s ease-in-out' : 'none',
            }}
            key={`code-${shakeTrigger}`}
          >
            {workshopCode ? (
              <span className="font-mono text-white text-2xl font-bold tracking-widest">
                {workshopCode}
              </span>
            ) : (
              <span className="text-gray-600 text-base">e.g. LEGENDS</span>
            )}
          </div>

          {/* Error */}
          <div className="h-8 mb-4 flex items-center justify-center">
            {errorMsg && (
              <p className="text-amber-400 text-sm font-medium text-center animate-fade-in">
                {errorMsg}
              </p>
            )}
            {checking && (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                Checking…
              </div>
            )}
          </div>

          {/* Letter keyboard */}
          <div className="space-y-2 mb-4">
            {[
              ['Q','W','E','R','T','Y','U','I','O','P'],
              ['A','S','D','F','G','H','J','K','L'],
              ['Z','X','C','V','B','N','M'],
            ].map((row, ri) => (
              <div key={ri} className="flex justify-center gap-1">
                {row.map(key => (
                  <button
                    key={key}
                    onPointerDown={e => { e.preventDefault(); setWorkshopCode(c => (c + key).substring(0, 12)); setErrorMsg('') }}
                    className="h-11 min-w-[1.9rem] flex-1 max-w-[2.6rem]
                               bg-gray-800 hover:bg-gray-700 active:bg-brand-700
                               border border-gray-700 rounded-lg
                               text-white font-mono text-sm font-semibold
                               transition-all duration-100 active:scale-95 select-none"
                  >
                    {key}
                  </button>
                ))}
              </div>
            ))}

            {/* Number row + backspace */}
            <div className="flex justify-center gap-1">
              {['1','2','3','4','5','6','7','8','9','0'].map(key => (
                <button
                  key={key}
                  onPointerDown={e => { e.preventDefault(); setWorkshopCode(c => (c + key).substring(0, 12)); setErrorMsg('') }}
                  className="h-11 min-w-[1.9rem] flex-1 max-w-[2.6rem]
                             bg-gray-800 hover:bg-gray-700 active:bg-brand-700
                             border border-gray-700 rounded-lg
                             text-white font-mono text-sm font-semibold
                             transition-all duration-100 active:scale-95 select-none"
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          {/* Backspace + Continue */}
          <div className="flex gap-2">
            <button
              onPointerDown={e => { e.preventDefault(); handleCodeBackspace() }}
              className="w-16 h-12 bg-gray-800 hover:bg-gray-700 border border-gray-700
                         rounded-xl text-gray-400 flex items-center justify-center
                         transition-all duration-100 active:scale-95"
            >
              <Delete className="w-5 h-5" />
            </button>
            <button
              onPointerDown={e => { e.preventDefault(); handleCodeSubmit() }}
              disabled={!workshopCode.trim() || checking}
              className="flex-1 h-12 bg-brand-600 hover:bg-brand-700 active:bg-brand-800
                         rounded-xl text-white font-bold text-sm
                         transition-all duration-100 active:scale-95
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {checking ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
              ) : 'Continue'}
            </button>
          </div>
        </div>

        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20%       { transform: translateX(-8px); }
            40%       { transform: translateX(8px); }
            60%       { transform: translateX(-6px); }
            80%       { transform: translateX(6px); }
          }
        `}</style>
      </div>
    )
  }

  // SECTION: Render — Step 2: PIN
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 select-none"
      style={{ backgroundImage: `radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.12) 0%, transparent 60%)` }}>

      {/* Logo */}
      <div className="flex flex-col items-center mb-6 animate-slide-down">
        <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center mb-3
                        shadow-lg shadow-brand-600/30">
          <Wrench className="w-7 h-7 text-white" />
        </div>
        <h1 className="font-display text-white text-2xl font-bold tracking-tight">
          {resolvedBranchName}
        </h1>
        <button
          onClick={handleBackToCode}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300
                     text-sm mt-1.5 transition-colors duration-150"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Change workshop
        </button>
      </div>

      <p className="text-gray-400 text-sm mb-6">Enter your PIN</p>

      {/* PIN dots */}
      <div
        className="flex gap-4 mb-4"
        style={{ animation: shakeTrigger > 0 ? 'shake 0.4s ease-in-out' : 'none' }}
        key={`pin-${shakeTrigger}`}
      >
        {[0,1,2,3].map(i => (
          <div key={i}
            className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
              i < pin.length
                ? 'bg-brand-500 border-brand-500 scale-110'
                : 'bg-transparent border-gray-600'
            }`}
          />
        ))}
      </div>

      {/* Error / checking */}
      <div className="h-8 mb-4 flex items-center">
        {errorMsg && (
          <p className={`text-sm font-medium text-center animate-fade-in ${
            lockedOut ? 'text-red-400' : 'text-amber-400'
          }`}>
            {errorMsg}
          </p>
        )}
        {checking && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            Checking…
          </div>
        )}
      </div>

      {/* Numeric keypad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs animate-slide-up">
        {[1,2,3,4,5,6,7,8,9].map(num => (
          <button
            key={num}
            onClick={() => handlePinDigit(String(num))}
            disabled={checking || lockedOut || pin.length >= 4}
            className="h-16 bg-gray-800 hover:bg-gray-700 active:bg-gray-600
                       border border-gray-700 hover:border-gray-600
                       rounded-2xl text-white font-display text-2xl font-bold
                       transition-all duration-150 active:scale-95
                       disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {num}
          </button>
        ))}
        <div />
        <button
          onClick={() => handlePinDigit('0')}
          disabled={checking || lockedOut || pin.length >= 4}
          className="h-16 bg-gray-800 hover:bg-gray-700 active:bg-gray-600
                     border border-gray-700 rounded-2xl text-white font-display
                     text-2xl font-bold transition-all duration-150 active:scale-95
                     disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          0
        </button>
        <button
          onClick={handleBackspace}
          disabled={checking || lockedOut || pin.length === 0}
          className="h-16 bg-gray-800 hover:bg-gray-700 active:bg-gray-600
                     border border-gray-700 rounded-2xl text-gray-400 hover:text-white
                     transition-all duration-150 active:scale-95
                     disabled:opacity-40 disabled:cursor-not-allowed
                     flex items-center justify-center shadow-sm"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>

      <p className="text-gray-700 text-xs mt-8">
        Management staff? —{' '}
        <a href="/login" className="text-gray-500 hover:text-gray-400 underline">
          Use the management portal
        </a>
      </p>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-6px); }
          80%       { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}

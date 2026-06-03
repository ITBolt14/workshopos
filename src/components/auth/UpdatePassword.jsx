// src/components/auth/UpdatePassword.jsx
// Handles the password update flow after a reset email link is clicked.
// Must detect PASSWORD_RECOVERY event from Supabase before showing the form.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { Wrench, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import PasswordInput from '../ui/PasswordInput'
import PasswordStrength, { isPasswordValid } from '../ui/PasswordStrength'

export default function UpdatePassword() {
  const navigate = useNavigate()

  // SECTION: State
  const [ready,       setReady]       = useState(false)  // true when PASSWORD_RECOVERY detected
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [done,        setDone]        = useState(false)
  const [errorMsg,    setErrorMsg]    = useState('')

  // SECTION: Detect PASSWORD_RECOVERY event
  // Supabase fires this event when the user arrives via a reset email link.
  // We must wait for it before showing the form — without it updateUser will fail.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // SECTION: Validation
  const passwordsMatch = password === confirm && confirm.length > 0
  const canSubmit      = isPasswordValid(password) && passwordsMatch && !submitting

  // SECTION: Submit
  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setErrorMsg('')

    const { error } = await supabase.auth.updateUser({ password })

    setSubmitting(false)

    if (error) {
      setErrorMsg('Failed to update password. Please request a new reset link.')
      return
    }

    setDone(true)
    toast.success('Password updated successfully!')
    setTimeout(() => navigate('/main', { replace: true }), 2000)
  }

  // SECTION: Render — waiting for recovery event
  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center
                          justify-center mx-auto mb-4">
            <Wrench className="w-6 h-6 text-white" />
          </div>
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent
                            rounded-full animate-spin" />
            Verifying reset link…
          </div>
        </div>
      </div>
    )
  }

  // SECTION: Render — success state
  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center animate-scale-in">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center
                          justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="font-display text-xl font-bold text-gray-900 mb-2">
            Password updated
          </h2>
          <p className="text-gray-500 text-sm">Redirecting to your dashboard…</p>
        </div>
      </div>
    )
  }

  // SECTION: Render — form state
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-gray-900 text-lg font-bold">WorkshopOS</span>
        </div>

        <div className="mb-6 animate-slide-up">
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-1">
            Set new password
          </h1>
          <p className="text-gray-500 text-sm">
            Choose a strong password for your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 animate-slide-up">

          {/* Error */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200
                            rounded-lg p-3 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-red-700 text-sm">{errorMsg}</p>
            </div>
          )}

          {/* New password */}
          <div>
            <PasswordInput
              id="new-password"
              label="New password"
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
              id="confirm-password"
              label="Confirm password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              disabled={submitting}
              autoComplete="new-password"
            />
            {/* Match feedback */}
            {confirm.length > 0 && (
              <p className={`mt-1 text-xs ${passwordsMatch ? 'text-green-600' : 'text-red-500'}`}>
                {passwordsMatch ? '✓ Passwords match' : 'Passwords do not match'}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent
                                rounded-full animate-spin" />
                Updating…
              </>
            ) : (
              'Set new password'
            )}
          </button>

        </form>
      </div>
    </div>
  )
}

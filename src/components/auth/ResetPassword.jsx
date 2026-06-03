// src/components/auth/ResetPassword.jsx
// Sends Supabase password reset email.
// redirectTo is set to /update-password so Supabase redirects correctly.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { Mail, ArrowLeft, Wrench, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function ResetPassword() {

  // SECTION: State
  const [email,      setEmail]      = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent,       setSent]       = useState(false)

  // SECTION: Submit
  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim() || submitting) return

    setSubmitting(true)

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/update-password` }
    )

    setSubmitting(false)

    if (error) {
      toast.error('Something went wrong. Please try again.')
      return
    }

    // Always show success — never reveal whether email exists (prevents user enumeration)
    setSent(true)
  }

  // SECTION: Render — success state
  if (sent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center animate-scale-in">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center
                          justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">
            Check your email
          </h1>
          <p className="text-gray-500 text-sm mb-2">
            If an account exists for <strong>{email}</strong>, a password reset
            link has been sent.
          </p>
          <p className="text-gray-400 text-xs mb-8">
            Check your spam folder if you don't see it within a few minutes.
          </p>
          <Link to="/login" className="btn-primary inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>
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

        {/* Heading */}
        <div className="mb-6 animate-slide-up">
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-1">
            Reset password
          </h1>
          <p className="text-gray-500 text-sm">
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 animate-slide-up">
          <div>
            <label htmlFor="email" className="label">Email address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@workshop.co.za"
                autoComplete="email"
                className="input-field pl-9"
                disabled={submitting}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!email.trim() || submitting}
            className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent
                                rounded-full animate-spin" />
                Sending…
              </>
            ) : (
              'Send reset link'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500
                       hover:text-gray-700 transition-colors duration-150"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to sign in
          </Link>
        </div>

      </div>
    </div>
  )
}

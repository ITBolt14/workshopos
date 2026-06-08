// src/components/auth/Login.jsx
// Management portal login page.
// Design: clean industrial — dark left panel with logo, light right panel with form.
//
// BUG FIXED: Profile check used .single() which throws PGRST116 if the profile
// row doesn't exist yet (race condition on new registrations). This caused
// Login.jsx to call signOut() mid-fetch, corrupting AuthContext state.
// FIX: Changed to .maybeSingle() so missing profile returns null gracefully.

import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { Wrench, Mail, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import PasswordInput from '../ui/PasswordInput'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const from     = location.state?.from || '/main'

  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [remember,   setRemember]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg,   setErrorMsg]   = useState('')

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting

  async function handleLogin(e) {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setErrorMsg('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email:    email.trim().toLowerCase(),
      password,
    })

    if (error) {
      setSubmitting(false)
      setErrorMsg('Incorrect email or password. Please try again.')
      return
    }

    // BUG FIX: Use maybeSingle() — .single() throws PGRST116 when profile
    // doesn't exist yet (new user race condition), causing unwanted signOut()
    // which corrupts AuthContext mid-fetch and leaves the app in a broken state.
    const { data: profile } = await supabase
      .from('profiles')
      .select('active, tier1_role')
      .eq('id', data.user.id)
      .maybeSingle()

    // If no profile yet, AuthContext retry loop will handle it —
    // don't sign the user out, just navigate and let the context settle
    if (profile) {
      if (!profile.active) {
        await supabase.auth.signOut()
        setSubmitting(false)
        setErrorMsg('Your account has been deactivated. Please contact your administrator.')
        return
      }

      if (!profile.tier1_role) {
        await supabase.auth.signOut()
        setSubmitting(false)
        setErrorMsg('This account does not have management portal access.')
        return
      }
    }

    toast.success('Welcome back!')
    navigate(from, { replace: true })
  }

  return (
    <div className="min-h-screen flex">

      {/* SECTION: Left panel — brand */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-2/5 bg-gray-900 flex-col justify-between p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              #ffffff 0px, #ffffff 1px,
              transparent 1px, transparent 12px
            )`,
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <span className="font-display text-white text-xl font-bold tracking-tight">
              WorkshopOS
            </span>
          </div>
          <span className="inline-block bg-brand-600/20 text-brand-400 text-xs font-mono
                           px-2 py-0.5 rounded border border-brand-600/30">
            Beta v0.1
          </span>
        </div>
        <div className="relative">
          <h2 className="font-display text-white text-3xl font-bold leading-tight mb-4">
            Workshop management<br />
            <span className="text-brand-400">built for the floor.</span>
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Real-time job tracking, technician clocking, and floor monitoring —
            everything your team needs in one place.
          </p>
        </div>
        <p className="relative text-gray-600 text-xs">
          © {new Date().getFullYear()} IT Legends. All rights reserved.
        </p>
      </div>

      {/* SECTION: Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-sm">

          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
              <Wrench className="w-4 h-4 text-white" />
            </div>
            <span className="font-display text-gray-900 text-lg font-bold">WorkshopOS</span>
          </div>

          <div className="mb-8 animate-slide-up">
            <h1 className="font-display text-2xl font-bold text-gray-900 mb-1">Sign in</h1>
            <p className="text-gray-500 text-sm">Management portal access only</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 animate-slide-up">

            {errorMsg && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200
                              rounded-lg p-3 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-red-700 text-sm">{errorMsg}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="label">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="email" type="email" value={email}
                  onChange={e => { setEmail(e.target.value); setErrorMsg('') }}
                  placeholder="you@workshop.co.za"
                  autoComplete="email"
                  className="input-field pl-9 no-caps"
                  disabled={submitting}
                />
              </div>
            </div>

            <PasswordInput
              id="password" label="Password" value={password}
              onChange={e => { setPassword(e.target.value); setErrorMsg('') }}
              placeholder="Your password" disabled={submitting}
              autoComplete="current-password"
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-brand-600
                             focus:ring-brand-500 cursor-pointer"
                />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
              <Link to="/reset-password"
                className="text-sm text-brand-600 hover:text-brand-700 font-medium
                           transition-colors duration-150">
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={!canSubmit}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent
                                  rounded-full animate-spin" />
                  Signing in…
                </>
              ) : 'Sign in'}
            </button>

          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            New workshop?{' '}
            <Link to="/register"
              className="text-brand-600 hover:text-brand-700 font-medium
                         transition-colors duration-150">
              Start your 14-day beta trial
            </Link>
          </p>

        </div>
      </div>
    </div>
  )
}

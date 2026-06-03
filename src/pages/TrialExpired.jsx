// src/pages/TrialExpired.jsx
// Shown when a trial has expired, or subscription is suspended/cancelled.
// Dark professional design with IT Legends contact details.

import { useNavigate } from 'react-router-dom'
import { Wrench, Clock, ShieldCheck, Phone, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function TrialExpired() {
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">

      {/* Background texture */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg, #ffffff 0px, #ffffff 1px,
            transparent 1px, transparent 14px
          )`,
        }}
      />

      <div className="relative w-full max-w-md animate-scale-in">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <span className="font-display text-white text-xl font-bold">WorkshopOS</span>
        </div>

        {/* Main card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">

          {/* Icon */}
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center
                          justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-gray-400" />
          </div>

          <h1 className="font-display text-2xl font-bold text-white mb-2">
            Beta trial ended
          </h1>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            Your 14-day beta trial has expired. To continue using WorkshopOS
            and access your data, please contact IT Legends to arrange continued access.
          </p>

          {/* Data safety notice */}
          <div className="flex items-center gap-3 bg-gray-800/60 rounded-xl p-4 mb-8 text-left">
            <ShieldCheck className="w-5 h-5 text-green-400 flex-shrink-0" />
            <p className="text-gray-300 text-xs leading-relaxed">
              <strong className="text-white">Your data is safe.</strong> All your workshop jobs,
              vehicles, and records are securely retained. Nothing is deleted.
            </p>
          </div>

          {/* Contact details */}
          <div className="border border-gray-800 rounded-xl p-5 mb-6 text-left space-y-3">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
              Contact IT Legends
            </p>
            <a href="tel:+27000000000"
               className="flex items-center gap-3 text-sm text-gray-300
                          hover:text-white transition-colors duration-150">
              <div className="w-8 h-8 bg-brand-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Phone className="w-3.5 h-3.5 text-brand-400" />
              </div>
              +27 (0) 00 000 0000
            </a>
            <a href="mailto:info@itlegends.co.za"
               className="flex items-center gap-3 text-sm text-gray-300
                          hover:text-white transition-colors duration-150">
              <div className="w-8 h-8 bg-brand-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Mail className="w-3.5 h-3.5 text-brand-400" />
              </div>
              info@itlegends.co.za
            </a>
          </div>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full py-2.5 rounded-lg border border-gray-700 text-gray-400
                       hover:border-gray-500 hover:text-gray-200 text-sm font-medium
                       transition-all duration-200"
          >
            Sign out
          </button>

        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          © {new Date().getFullYear()} IT Legends. All rights reserved.
        </p>
      </div>
    </div>
  )
}

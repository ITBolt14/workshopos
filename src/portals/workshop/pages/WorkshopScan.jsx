// src/portals/workshop/pages/WorkshopScan.jsx
// QR scan landing page — looks up job by qr_token.
// If technician is already logged in → redirect directly to clocking screen.
// If not logged in → save the intended job destination, show PIN login,
//   then redirect to the job after successful PIN entry.

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Wrench, AlertCircle } from 'lucide-react'
import { supabaseWorkshop as supabase } from '../../../lib/supabaseWorkshop'
import { getWorkshopUser } from '../WorkshopPortal'

// Key used to store the intended destination across the PIN login
export const SCAN_REDIRECT_KEY = 'workshop_scan_redirect'

export default function WorkshopScan() {
  const { qrToken } = useParams()
  const navigate    = useNavigate()
  const [status, setStatus] = useState('loading') // loading | error

  useEffect(() => {
    async function handleScan() {
      if (!qrToken) { setStatus('error'); return }

      // Look up job by QR token
      const { data, error } = await supabase
        .rpc('get_job_by_qr_token', { p_token: qrToken })

      if (error || !data?.length) {
        setStatus('error')
        return
      }

      const jobId = data[0].id

      // Check if technician is already logged in
      const workshopUser = getWorkshopUser()

      if (workshopUser) {
        // Tier 1 users (management) → read-only job view with stage history + notes
        // Tier 2 users (technicians) → clocking screen
        const isTier1 = !!workshopUser.tier1_role
        if (isTier1) {
          navigate(`/workshop/view/${jobId}`, { replace: true })
        } else {
          navigate(`/workshop/job/${jobId}`, { replace: true })
        }
      } else {
        // Not logged in — save destination and redirect to login
        sessionStorage.setItem(SCAN_REDIRECT_KEY, `/workshop/job/${jobId}`)
        navigate('/workshop/login', { replace: true })
      }
    }

    handleScan()
  }, [qrToken, navigate])

  // SECTION: Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center">
          <Wrench className="w-6 h-6 text-white" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent
                          rounded-full animate-spin" />
          <span className="text-gray-400 text-sm">Loading job…</span>
        </div>
      </div>
    )
  }

  // SECTION: Error state
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 gap-4">
      <div className="w-14 h-14 bg-red-900/40 rounded-full flex items-center justify-center">
        <AlertCircle className="w-7 h-7 text-red-400" />
      </div>
      <div className="text-center">
        <h2 className="font-display text-white text-xl font-bold mb-2">QR Code Invalid</h2>
        <p className="text-gray-500 text-sm mb-6">
          This QR code is not recognised. Please ask your manager for assistance.
        </p>
        <button
          onClick={() => navigate('/workshop/login', { replace: true })}
          className="btn-primary"
        >
          Go to Workshop Login
        </button>
      </div>
    </div>
  )
}
